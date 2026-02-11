import { serve } from 'http/server.ts'
import { createClient } from 'supabase'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
}) : null

// Allowed origins for CORS
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [
  'https://www.ledgerworkflow.com',
  'https://ledgerworkflow.com',
  'https://requisition-workflow.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
]

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// Plan configuration (must match client/src/config/plans.js)
const PLAN_LIMITS: Record<string, { maxUsers: number; maxProjects: number; maxRequisitionsPerMonth: number }> = {
  free:         { maxUsers: 3,  maxProjects: 2,  maxRequisitionsPerMonth: 25 },
  starter:      { maxUsers: 10, maxProjects: 10, maxRequisitionsPerMonth: 200 },
  professional: { maxUsers: 25, maxProjects: 25, maxRequisitionsPerMonth: 500 },
  enterprise:   { maxUsers: -1, maxProjects: -1, maxRequisitionsPerMonth: -1 },
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY secret.')
    }

    // Authenticate the user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { priceId, orgId, billingInterval, successUrl, cancelUrl } = body

    if (!priceId || !orgId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: priceId, orgId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is org owner
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!membership || membership.role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Only the organization owner can manage billing' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get or create Stripe customer
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, name, email, stripe_customer_id')
      .eq('id', orgId)
      .single()

    let customerId = org?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: org?.name || undefined,
        metadata: {
          org_id: orgId,
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      // Save customer ID to org
      await supabaseAdmin
        .from('organizations')
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('id', orgId)
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `https://www.ledgerworkflow.com/settings/organization?tab=billing&checkout=success`,
      cancel_url: cancelUrl || `https://www.ledgerworkflow.com/settings/organization?tab=billing&checkout=cancelled`,
      subscription_data: {
        metadata: {
          org_id: orgId,
          billing_interval: billingInterval || 'monthly',
        },
      },
      metadata: {
        org_id: orgId,
      },
    })

    console.log(`Checkout session created: ${session.id} for org ${orgId}`)

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
