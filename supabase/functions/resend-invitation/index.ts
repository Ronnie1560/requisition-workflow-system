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
        JSON.stringify({ error: 'Forbidden: You must belong to an organization' }),
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
    const { userId, email } = await req.json()

    // Validate that at least one identifier is provided
    if (!userId && !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: userId or email' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Find the user by userId or email (scoped to inviter's organization)
    let query = supabaseAdmin
      .from('users')
      .select('id, email, full_name, role')
      .eq('org_id', profile.org_id)

    if (userId) {
      query = query.eq('id', userId)
    } else if (email) {
      query = query.eq('email', email)
    }

    const { data: existingUser, error: userLookupError } = await query.single()

    if (userLookupError || !existingUser) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      )
    }

    // Generate password reset link
    // NOTE: Link expiration is configured in Supabase Dashboard -> Auth Settings -> Email Templates
    // Set "Recovery" email template token expiration to 86400 seconds (24 hours)
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: existingUser.email,
      options: {
        redirectTo: `${APP_BASE_URL}/reset-password`,
      },
    })

    if (resetError) {
      console.error('Reset link generation error:', resetError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate reset link: ' + resetError.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // Send invitation email via Resend
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

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
    <h1 style="color: white; margin: 0; font-size: 24px;">Set Your Password</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 16px;">Hello <strong>${existingUser.full_name}</strong>,</p>

    <p>A new password reset link has been generated for your account in the PASSION CHRISTIAN MINISTRIES Requisition System.</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <p style="margin: 0;"><strong>Your Role:</strong> ${existingUser.role.replace('_', ' ').toUpperCase()}</p>
      <p style="margin: 10px 0 0;"><strong>Email:</strong> ${existingUser.email}</p>
    </div>

    <p>To set or reset your password, please click the button below:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Set Your Password</a>
    </div>

    <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #667eea; font-size: 14px;">${resetLink}</p>

    <p style="color: #dc2626; font-size: 14px; background: #fee2e2; padding: 12px; border-radius: 6px; border-left: 4px solid #dc2626;">
      <strong>⚠️ Important:</strong> This link will expire in 24 hours and can only be used once.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #666; font-size: 12px; text-align: center;">
      This invitation was sent from the Requisition Workflow System.<br>
      If you did not request this, please contact your system administrator.
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
          to: [existingUser.email],
          subject: 'Requisition Workflow System - Set Your Password',
          html: emailHtml,
        }),
      })

      if (!resendResponse.ok) {
        const resendError = await resendResponse.text()
        console.error('Resend API error:', resendError)
        return new Response(
          JSON.stringify({ error: 'Failed to send email: ' + resendError }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        )
      }

      const resendData = await resendResponse.json()
      console.log('Invitation email sent successfully to:', existingUser.email)

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: existingUser.id,
            email: existingUser.email,
            full_name: existingUser.full_name,
            role: existingUser.role,
          },
          message: 'Invitation email resent successfully',
          emailId: resendData.id,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } catch (emailError) {
      console.error('Error sending email:', emailError)
      return new Response(
        JSON.stringify({ error: 'Failed to send email: ' + emailError.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }
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
