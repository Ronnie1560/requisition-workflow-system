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
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://pcm-requisition.vercel.app'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow from any origin for signup
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
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

    // Get request body
    const { organization, admin } = await req.json()

    // Validate required fields
    if (!organization?.name || !organization?.slug) {
      return new Response(
        JSON.stringify({ error: 'Organization name and slug are required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    if (!admin?.fullName || !admin?.email || !admin?.password) {
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
    if (!emailRegex.test(admin.email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Validate password strength
    if (admin.password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(organization.slug) || organization.slug.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Organization URL must be at least 3 characters and contain only lowercase letters, numbers, and hyphens' }),
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
      .eq('slug', organization.slug)
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
      .eq('email', admin.email)
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
    const existingAuthUser = authUsers?.users?.find(u => u.email === admin.email)
    
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
      orgName: organization.name, 
      orgSlug: organization.slug, 
      adminEmail: admin.email 
    })

    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: admin.email,
      password: admin.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: admin.fullName,
        phone: admin.phone || null,
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

    // Step 2: Create organization
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: organization.name,
        slug: organization.slug,
        email: organization.email || admin.email,
        plan: organization.plan || 'free',
        status: 'active',
        created_by: userId,
      })
      .select('id')
      .single()

    if (orgError) {
      console.error('Organization creation error:', orgError)
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(
        JSON.stringify({ error: 'Failed to create organization: ' + orgError.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const orgId = orgData.id
    console.log('Created organization:', orgId)

    // Step 3: Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email: admin.email,
        full_name: admin.fullName,
        phone: admin.phone || null,
        role: 'super_admin',
        org_id: orgId,
        is_active: true,
      })

    if (profileError) {
      console.error('User profile creation error:', profileError)
      // Rollback: delete org and auth user
      await supabaseAdmin.from('organizations').delete().eq('id', orgId)
      await supabaseAdmin.auth.admin.deleteUser(userId)
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
        organization_name: organization.name,
        email: organization.email || admin.email,
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

    // Step 7: Send welcome email (optional)
    if (RESEND_API_KEY) {
      const welcomeEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to PCM Requisition System</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 16px;">Hello <strong>${admin.fullName}</strong>,</p>
    
    <p>Congratulations! Your organization <strong>${organization.name}</strong> has been successfully created.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <p style="margin: 0;"><strong>Organization:</strong> ${organization.name}</p>
      <p style="margin: 10px 0 0;"><strong>Your Role:</strong> Owner / Super Admin</p>
      <p style="margin: 10px 0 0;"><strong>Email:</strong> ${admin.email}</p>
    </div>
    
    <p>You can now log in and start setting up your organization:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_BASE_URL}/login" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Go to Dashboard</a>
    </div>
    
    <h3 style="margin-top: 30px;">Next Steps:</h3>
    <ol style="color: #666;">
      <li>Update your organization settings</li>
      <li>Invite team members</li>
      <li>Create projects and expense accounts</li>
      <li>Start submitting requisitions</li>
    </ol>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #666; font-size: 12px; text-align: center;">
      This email was sent from the PCM Requisition System.<br>
      If you did not create this organization, please contact support.
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
            to: [admin.email],
            subject: `Welcome to PCM Requisition System - ${organization.name}`,
            html: welcomeEmailHtml,
          }),
        })

        if (!resendResponse.ok) {
          const resendError = await resendResponse.text()
          console.error('Resend API error:', resendError)
        } else {
          console.log('Welcome email sent successfully to:', admin.email)
        }
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError)
        // Don't fail the signup if email fails
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
