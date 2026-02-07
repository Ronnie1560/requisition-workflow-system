import { serve } from 'http/server.ts'
import { createClient } from 'supabase'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@passionchristianministries.org'
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://requisition-workflow.vercel.app'

const corsHeaders = {
  'Access-Control-Allow-Origin': APP_BASE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Create admin client using service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the current user (must be authenticated)
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Please log in again' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    // Get inviter's profile including org_id
    const { data: profile } = await supabaseClient
      .from('users')
      .select('role, org_id')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.org_id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You must belong to an organization to invite users' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      )
    }

    // Verify inviter has admin privileges in their organization
    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', profile.org_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    const isOrgAdmin = membership && ['admin', 'owner'].includes(membership.role)
    const isSuperAdmin = profile.role === 'super_admin'

    if (!isOrgAdmin && !isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Organization admin access required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      )
    }

    // Get request body
    const { email, fullName, role, projects } = await req.json()

    // Validate required fields
    if (!email || !fullName || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, fullName, role' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single()

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        }
      )
    }

    // Generate a temporary password (user will reset on first login)
    const tempPassword = crypto.randomUUID().slice(0, 16) + 'A1!'

    // Create user using admin client with email_confirm: true to skip email verification
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email so they can log in immediately
      user_metadata: {
        full_name: fullName,
        role: role,
      },
    })

    if (authError) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Create user profile
    if (authData.user) {
      // Use inviter's org_id (already fetched and validated above)
      const orgId = profile.org_id

      const { error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email: email,
          full_name: fullName,
          role: role,
          is_active: true,
          org_id: orgId, // Assign to same org as inviter
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        // Try to delete the auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return new Response(
          JSON.stringify({ error: 'Failed to create user profile: ' + profileError.message }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        )
      }

      // Add user to organization_members table
      if (orgId) {
        // Map user role to org member role
        const orgMemberRole = role === 'super_admin' ? 'admin' : 
                              role === 'approver' ? 'admin' : 
                              role === 'reviewer' ? 'admin' : 'member'
        
        const { error: memberError } = await supabaseAdmin
          .from('organization_members')
          .insert({
            organization_id: orgId,
            user_id: authData.user.id,
            role: orgMemberRole,
            invited_by: user.id,
            invited_at: new Date().toISOString(),
            accepted_at: new Date().toISOString(), // Pre-accept since admin invited them
            is_active: true,
          })

        if (memberError) {
          console.error('Organization membership error:', memberError)
          // Don't fail the whole operation if membership fails - DB trigger should handle it
        }
      }

      // Assign to projects if specified (validate they belong to the inviter's org)
      if (projects && projects.length > 0) {
        // Verify all projects belong to the inviter's organization
        const { data: validProjects } = await supabaseAdmin
          .from('projects')
          .select('id')
          .eq('org_id', orgId)
          .in('id', projects)

        const validProjectIds = (validProjects || []).map((p: { id: string }) => p.id)

        if (validProjectIds.length > 0) {
          const assignments = validProjectIds.map((projectId: string) => ({
            user_id: authData.user.id,
            project_id: projectId,
            role: 'submitter',
            assigned_by: user.id,
            is_active: true,
          }))

          const { error: assignError } = await supabaseAdmin
            .from('user_project_assignments')
            .insert(assignments)

          if (assignError) {
            console.error('Project assignment error:', assignError)
          }
        }
      }

      // Generate password reset link
      // NOTE: Link expiration is configured in Supabase Dashboard -> Auth Settings -> Email Templates
      // Set "Recovery" email template token expiration to 86400 seconds (24 hours)
      const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: `${APP_BASE_URL}/reset-password`,
        },
      })

      if (resetError) {
        console.error('Reset link generation error:', resetError)
      }

      // Send invitation email via Resend
      if (RESEND_API_KEY) {
        const resetLink = resetData?.properties?.action_link || `${APP_BASE_URL}/login`
        
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Requisition Workflow System</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 16px;">Hello <strong>${fullName}</strong>,</p>
    
    <p>You have been invited to join the PASSION CHRISTIAN MINISTRIES Requisition System.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <p style="margin: 0;"><strong>Your Role:</strong> ${role.replace('_', ' ').toUpperCase()}</p>
      <p style="margin: 10px 0 0;"><strong>Email:</strong> ${email}</p>
    </div>
    
    <p>To get started, please click the button below to set your password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Set Your Password</a>
    </div>
    
    <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #667eea; font-size: 14px;">${resetLink}</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #666; font-size: 12px; text-align: center;">
      This invitation was sent from the Requisition Workflow System.<br>
      If you did not expect this invitation, please ignore this email.
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
              to: [email],
              subject: 'Welcome to Requisition Workflow System - Set Your Password',
              html: emailHtml,
            }),
          })

          if (!resendResponse.ok) {
            const resendError = await resendResponse.text()
            console.error('Resend API error:', resendError)
          } else {
            console.log('Invitation email sent successfully to:', email)
          }
        } catch (emailError) {
          console.error('Error sending email:', emailError)
          // Don't fail the user creation if email fails
        }
      } else {
        console.warn('RESEND_API_KEY not configured, skipping email')
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authData.user?.id,
          email: email,
          full_name: fullName,
          role: role,
        },
        message: 'User created and invitation email sent',
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
