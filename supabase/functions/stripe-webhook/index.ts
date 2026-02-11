import { serve } from 'http/server.ts'
import { createClient } from 'supabase'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
}) : null

// Plan configuration (must match client/src/config/plans.js)
const PLAN_LIMITS: Record<string, { maxUsers: number; maxProjects: number; maxRequisitionsPerMonth: number }> = {
  free:         { maxUsers: 3,  maxProjects: 2,  maxRequisitionsPerMonth: 25 },
  starter:      { maxUsers: 10, maxProjects: 10, maxRequisitionsPerMonth: 200 },
  professional: { maxUsers: 25, maxProjects: 25, maxRequisitionsPerMonth: 500 },
  enterprise:   { maxUsers: -1, maxProjects: -1, maxRequisitionsPerMonth: -1 },
}

// Map Stripe Price IDs to plan names
// These should be updated when you create products in Stripe Dashboard
const PRICE_TO_PLAN: Record<string, string> = {
  'STRIPE_STARTER_MONTHLY_PRICE_ID': 'starter',
  'STRIPE_STARTER_YEARLY_PRICE_ID': 'starter',
  'STRIPE_PRO_MONTHLY_PRICE_ID': 'professional',
  'STRIPE_PRO_YEARLY_PRICE_ID': 'professional',
  'STRIPE_ENTERPRISE_MONTHLY_PRICE_ID': 'enterprise',
  'STRIPE_ENTERPRISE_YEARLY_PRICE_ID': 'enterprise',
}

function getPlanFromPriceId(priceId: string): string {
  return PRICE_TO_PLAN[priceId] || 'free'
}

serve(async (req) => {
  // Webhooks don't need CORS — they come from Stripe servers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 })
  }

  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.')
    }

    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET)
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return new Response(
        JSON.stringify({ error: `Webhook Error: ${err.message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`Processing webhook event: ${event.type} (${event.id})`)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.org_id
        const subscriptionId = session.subscription as string

        if (orgId && subscriptionId) {
          // Get subscription details to determine the plan
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const priceId = subscription.items.data[0]?.price.id
          const planName = getPlanFromPriceId(priceId)
          const limits = PLAN_LIMITS[planName] || PLAN_LIMITS.free

          // Update organization
          await supabaseAdmin
            .from('organizations')
            .update({
              plan: planName,
              status: 'active',
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: session.customer as string,
              max_users: limits.maxUsers,
              max_projects: limits.maxProjects,
              max_requisitions_per_month: limits.maxRequisitionsPerMonth,
              subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
              trial_ends_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', orgId)

          // Log billing event
          await supabaseAdmin
            .from('billing_history')
            .insert({
              organization_id: orgId,
              event_type: 'subscription_created',
              plan_to: planName,
              amount_cents: session.amount_total || 0,
              currency: session.currency || 'usd',
              stripe_event_id: event.id,
              stripe_subscription_id: subscriptionId,
            })

          console.log(`✅ Org ${orgId} upgraded to ${planName}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = subscription.metadata?.org_id

        if (orgId) {
          const priceId = subscription.items.data[0]?.price.id
          const planName = getPlanFromPriceId(priceId)
          const limits = PLAN_LIMITS[planName] || PLAN_LIMITS.free

          const status = subscription.status === 'active' ? 'active' :
                         subscription.status === 'trialing' ? 'trial' :
                         subscription.status === 'past_due' ? 'active' : // Grace period
                         'suspended'

          // Get previous plan for logging
          const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('plan')
            .eq('id', orgId)
            .single()

          await supabaseAdmin
            .from('organizations')
            .update({
              plan: planName,
              status,
              max_users: limits.maxUsers,
              max_projects: limits.maxProjects,
              max_requisitions_per_month: limits.maxRequisitionsPerMonth,
              subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', orgId)

          // Log plan change
          if (org?.plan !== planName) {
            await supabaseAdmin
              .from('billing_history')
              .insert({
                organization_id: orgId,
                event_type: 'plan_changed',
                plan_from: org?.plan,
                plan_to: planName,
                stripe_event_id: event.id,
                stripe_subscription_id: subscription.id,
              })
          }

          console.log(`✅ Org ${orgId} subscription updated to ${planName} (${status})`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = subscription.metadata?.org_id

        if (orgId) {
          const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('plan')
            .eq('id', orgId)
            .single()

          // Downgrade to free plan
          const limits = PLAN_LIMITS.free
          await supabaseAdmin
            .from('organizations')
            .update({
              plan: 'free',
              status: 'active',
              stripe_subscription_id: null,
              max_users: limits.maxUsers,
              max_projects: limits.maxProjects,
              max_requisitions_per_month: limits.maxRequisitionsPerMonth,
              subscription_ends_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', orgId)

          await supabaseAdmin
            .from('billing_history')
            .insert({
              organization_id: orgId,
              event_type: 'cancelled',
              plan_from: org?.plan,
              plan_to: 'free',
              stripe_event_id: event.id,
              stripe_subscription_id: subscription.id,
            })

          console.log(`✅ Org ${orgId} subscription cancelled — downgraded to free`)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          // Find org by subscription ID
          const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (org) {
            await supabaseAdmin
              .from('billing_history')
              .insert({
                organization_id: org.id,
                event_type: 'payment_succeeded',
                amount_cents: invoice.amount_paid,
                currency: invoice.currency,
                stripe_event_id: event.id,
                stripe_invoice_id: invoice.id,
                stripe_subscription_id: subscriptionId,
              })

            console.log(`✅ Payment succeeded for org ${org.id}: ${invoice.amount_paid} ${invoice.currency}`)
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (org) {
            await supabaseAdmin
              .from('billing_history')
              .insert({
                organization_id: org.id,
                event_type: 'payment_failed',
                amount_cents: invoice.amount_due,
                currency: invoice.currency,
                stripe_event_id: event.id,
                stripe_invoice_id: invoice.id,
                stripe_subscription_id: subscriptionId,
                metadata: { attempt_count: invoice.attempt_count },
              })

            console.log(`⚠️ Payment failed for org ${org.id}: attempt ${invoice.attempt_count}`)
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
