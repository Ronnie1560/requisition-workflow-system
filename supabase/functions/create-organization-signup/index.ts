import { serve } from 'http/server.ts'
import { createClient } from 'supabase'

/**
 * Edge Function: create-organization-signup
 * 
 * Creates a new organization with an admin user in a single transaction.
 * This is used for self-service organization signup.
 * 
 * Unlike invite-user, this does NOT require authentication.
 * It creates both the user and the organization.
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@passionchristianministries.org'
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://requisition-workflow.vercel.app'

// Allowed origins for CORS (restrict to known domains for security)
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [
  'https://requisition-workflow.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
]

// Helper function to get CORS headers with origin validation
const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// Input sanitization helper to prevent XSS and enforce length limits
const sanitizeInput = (input: string, maxLength: number = 255): string => {
  if (!input) return ''

  // Trim whitespace
  let sanitized = input.trim()

  // Enforce maximum length
  sanitized = sanitized.substring(0, maxLength)

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')

  // Encode HTML special characters to prevent XSS
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')

  return sanitized
}

// Sanitize slug (more restrictive - only lowercase alphanumeric and hyphens)
const sanitizeSlug = (slug: string, maxLength: number = 50): string => {
  if (!slug) return ''

  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '') // Remove any character that's not a-z, 0-9, or hyphen
    .replace(/--+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, maxLength)
}

// Reserved slugs that cannot be used for organizations
const RESERVED_SLUGS = [
  'admin', 'api', 'app', 'www', 'dashboard', 'login', 'signup', 'register',
  'default', 'system', 'support', 'help', 'billing', 'settings', 'account',
  'auth', 'oauth', 'sso', 'mail', 'email', 'static', 'assets', 'cdn',
  'status', 'health', 'metrics', 'webhook', 'webhooks', 'callback',
  'test', 'demo', 'staging', 'production', 'dev', 'development',
  'pcm', 'passion', 'christian', 'ministries'
]

// Check if slug is reserved
const isReservedSlug = (slug: string): boolean => {
  return RESERVED_SLUGS.includes(slug.toLowerCase())
}

// Trial period duration in days
const TRIAL_PERIOD_DAYS = 14

// Rollback helper to clean up created resources on error
interface RollbackState {
  userId?: string
  orgId?: string
}

const rollbackTransaction = async (supabaseAdmin: any, state: RollbackState) => {
  console.log('Rolling back transaction:', state)

  try {
    // Delete in reverse order of creation
    if (state.orgId) {
      // Delete organization members first (foreign key constraint)
      await supabaseAdmin.from('organization_members').delete().eq('organization_id', state.orgId)

      // Delete organization settings
      await supabaseAdmin.from('organization_settings').delete().eq('org_id', state.orgId)

      // Delete fiscal year settings if exists
      await supabaseAdmin.from('fiscal_year_settings').delete().eq('org_id', state.orgId)

      // Delete user profile
      if (state.userId) {
        await supabaseAdmin.from('users').delete().eq('id', state.userId)
      }

      // Delete organization
      await supabaseAdmin.from('organizations').delete().eq('id', state.orgId)
    }

    // Delete auth user last
    if (state.userId) {
      await supabaseAdmin.auth.admin.deleteUser(state.userId)
    }

    console.log('Rollback completed successfully')
  } catch (rollbackError) {
    console.error('ERROR during rollback (orphaned data may exist):', rollbackError)
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create admin client using service role key (no user auth required)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // =====================================================
    // RATE LIMITING CHECK
    // =====================================================

    // Get client IP address (check multiple headers for proxy scenarios)
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      req.headers.get('cf-connecting-ip') || // Cloudflare
      'unknown'

    console.log('Rate limit check for IP:', clientIp)

    // Check rate limit: 5 signup attempts per hour per IP
    const { data: rateLimitResult, error: rateLimitError } = await supabaseAdmin
      .rpc('check_rate_limit', {
        p_endpoint: 'organization-signup',
        p_identifier: clientIp,
        p_max_attempts: 5,
        p_window_minutes: 60
      })

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError)
      // Continue anyway - don't block signup if rate limit check fails
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      console.warn('Rate limit exceeded for IP:', clientIp)
      return new Response(
        JSON.stringify({
          error: 'Too many signup attempts. Please try again later.',
          retry_after: rateLimitResult.retry_after,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': rateLimitResult.retry_after.toString(),
          },
          status: 429,
        }
      )
    }

    if (rateLimitResult?.allowed) {
      console.log('Rate limit check passed. Attempts remaining:', rateLimitResult.attempts_remaining)
    }

    // Get request body
    const { organization, admin } = await req.json()

    // Sanitize all user inputs to prevent XSS and enforce length limits
    const sanitizedOrg = {
      name: sanitizeInput(organization?.name, 100),
      slug: sanitizeSlug(organization?.slug, 50),
      email: organization?.email?.trim().toLowerCase().substring(0, 255) || '',
      plan: organization?.plan || 'free'
    }

    const sanitizedAdmin = {
      fullName: sanitizeInput(admin?.fullName, 100),
      email: admin?.email?.trim().toLowerCase().substring(0, 255) || '',
      password: admin?.password || '', // Don't sanitize password (will be hashed)
      phone: admin?.phone ? sanitizeInput(admin.phone, 20) : null
    }

    // Validate required fields
    if (!sanitizedOrg.name || !sanitizedOrg.slug) {
      return new Response(
        JSON.stringify({ error: 'Organization name and slug are required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    if (!sanitizedAdmin.fullName || !sanitizedAdmin.email || !sanitizedAdmin.password) {
      return new Response(
        JSON.stringify({ error: 'Admin name, email, and password are required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(sanitizedAdmin.email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Validate password strength
    if (sanitizedAdmin.password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Validate slug format (already sanitized, just check length)
    if (sanitizedOrg.slug.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Organization URL must be at least 3 characters' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Check if slug is reserved
    if (isReservedSlug(sanitizedOrg.slug)) {
      return new Response(
        JSON.stringify({ error: 'This organization URL is reserved. Please choose a different name.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Check if slug is already taken
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', sanitizedOrg.slug)
      .maybeSingle()

    if (existingOrg) {
      return new Response(
        JSON.stringify({ error: 'This organization URL is already taken' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        }
      )
    }

    // Check if user email already exists in users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', sanitizedAdmin.email)
      .maybeSingle()

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'A user with this email already exists' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        }
      )
    }

    // Also check if email exists in auth.users (might be orphaned from previous failed signup)
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = authUsers?.users?.find(u => u.email === sanitizedAdmin.email)
    
    if (existingAuthUser) {
      // Check if this user has a profile - if not, it's an orphaned auth user we can delete
      const { data: hasProfile } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', existingAuthUser.id)
        .maybeSingle()
      
      if (!hasProfile) {
        // Delete orphaned auth user so they can sign up again
        console.log('Deleting orphaned auth user:', existingAuthUser.id)
        await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id)
      } else {
        return new Response(
          JSON.stringify({ error: 'A user with this email already exists. Please log in instead.' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409,
          }
        )
      }
    }

    console.log('Creating organization and admin user:', {
      orgName: sanitizedOrg.name,
      orgSlug: sanitizedOrg.slug,
      adminEmail: sanitizedAdmin.email
    })

    // Step 1: Create auth user (with email verification required)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: sanitizedAdmin.email,
      password: sanitizedAdmin.password,
      email_confirm: false, // Require email verification for security
      user_metadata: {
        full_name: sanitizedAdmin.fullName,
        phone: sanitizedAdmin.phone,
      },
    })

    if (authError) {
      console.error('Auth user creation error:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const userId = authData.user.id
    console.log('Created auth user:', userId)

    // Track created resources for rollback
    const rollbackState: RollbackState = { userId }

    // Step 2: Create organization with trial period
    const trialEndsAt = new Date(Date.now() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: sanitizedOrg.name,
        slug: sanitizedOrg.slug,
        email: sanitizedOrg.email || sanitizedAdmin.email,
        plan: sanitizedOrg.plan,
        status: 'active',
        created_by: userId,
        trial_ends_at: trialEndsAt,
      })
      .select('id')
      .single()

    if (orgError) {
      console.error('Organization creation error:', orgError)
      await rollbackTransaction(supabaseAdmin, rollbackState)
      return new Response(
        JSON.stringify({ error: 'Failed to create organization: ' + orgError.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const orgId = orgData.id
    rollbackState.orgId = orgId
    console.log('Created organization:', orgId)

    // Step 3: Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email: sanitizedAdmin.email,
        full_name: sanitizedAdmin.fullName,
        phone: sanitizedAdmin.phone,
        role: 'super_admin',
        org_id: orgId,
        is_active: true,
      })

    if (profileError) {
      console.error('User profile creation error:', profileError)
      await rollbackTransaction(supabaseAdmin, rollbackState)
      return new Response(
        JSON.stringify({ error: 'Failed to create user profile: ' + profileError.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    console.log('Created user profile')

    // Step 4: Add user as organization owner
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: orgId,
        user_id: userId,
        role: 'owner',
        accepted_at: new Date().toISOString(),
        is_active: true,
      })

    if (memberError) {
      console.error('Organization member creation error:', memberError)
      // Continue anyway - this is not critical
    }

    console.log('Added user as organization owner')

    // Step 5: Create organization settings
    const { error: settingsError } = await supabaseAdmin
      .from('organization_settings')
      .insert({
        org_id: orgId,
        organization_name: sanitizedOrg.name,
        email: sanitizedOrg.email || sanitizedAdmin.email,
      })

    if (settingsError) {
      console.error('Organization settings creation error:', settingsError)
      // Continue anyway - settings can be created later
    }

    console.log('Created organization settings')

    // Step 6: Create fiscal year settings (if table exists)
    try {
      const currentYear = new Date().getFullYear()
      await supabaseAdmin
        .from('fiscal_year_settings')
        .insert({
          org_id: orgId,
          fiscal_year_start_month: 1,
          fiscal_year_start_day: 1,
          current_fiscal_year: currentYear,
        })
      console.log('Created fiscal year settings')
    } catch (fiscalError) {
      console.warn('Fiscal year settings creation skipped:', fiscalError)
    }

    // Step 7: Send email verification email
    if (RESEND_API_KEY) {
      // Generate email confirmation link
      const { data: confirmationData, error: confirmError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: sanitizedAdmin.email,
      })

      if (confirmError) {
        console.error('Error generating confirmation link:', confirmError)
      } else {
        const confirmationLink = confirmationData.properties.action_link

        const verificationEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Verify Your Email Address</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 16px;">Hello <strong>${sanitizedAdmin.fullName}</strong>,</p>

    <p>Thank you for creating your organization <strong>${sanitizedOrg.name}</strong> on PCM Requisition System!</p>

    <p>To complete your registration and activate your account, please verify your email address by clicking the button below:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${confirmationLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify Email Address</a>
    </div>

    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="background: white; padding: 12px; border-radius: 6px; word-break: break-all; font-size: 12px; color: #667eea; border: 1px solid #e5e7eb;">
      ${confirmationLink}
    </p>

    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>Important:</strong> This verification link will expire in 24 hours. If you don't verify your email, you won't be able to log in.
      </p>
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <p style="margin: 0;"><strong>Organization:</strong> ${sanitizedOrg.name}</p>
      <p style="margin: 10px 0 0;"><strong>Your Role:</strong> Owner / Super Admin</p>
      <p style="margin: 10px 0 0;"><strong>Email:</strong> ${sanitizedAdmin.email}</p>
    </div>

    <h3 style="margin-top: 30px;">After Verification:</h3>
    <ol style="color: #666;">
      <li>Log in to your dashboard</li>
      <li>Update your organization settings</li>
      <li>Invite team members</li>
      <li>Create projects and expense accounts</li>
      <li>Start submitting requisitions</li>
    </ol>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #666; font-size: 12px; text-align: center;">
      This email was sent from the PCM Requisition System.<br>
      If you did not create this organization, please ignore this email or contact support.
    </p>
  </div>
</body>
</html>
`

        try {
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [sanitizedAdmin.email],
              subject: `Verify your email - ${sanitizedOrg.name} | PCM Requisition System`,
              html: verificationEmailHtml,
            }),
          })

          if (!resendResponse.ok) {
            const resendError = await resendResponse.text()
            console.error('Resend API error:', resendError)
          } else {
            console.log('Verification email sent successfully to:', sanitizedAdmin.email)
          }
        } catch (emailError) {
          console.error('Error sending verification email:', emailError)
          // Don't fail the signup if email fails
        }
      }
    }

    // Success!
    console.log('Organization signup completed successfully')
    
    return new Response(
      JSON.stringify({
        success: true,
        organizationId: orgId,
        userId: userId,
        message: 'Organization created successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
