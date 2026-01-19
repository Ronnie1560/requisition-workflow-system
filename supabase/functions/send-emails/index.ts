// Supabase Edge Function to process email queue
// This function:
// 1. Fetches pending emails from the queue
// 2. Sends them using Resend (or your chosen email service)
// 3. Updates the queue status
// 4. Uses per-org Reply-To for multi-tenancy support

import { serve } from 'http/server.ts'
import { createClient } from 'supabase'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@requisition-system.com'
const FROM_NAME = Deno.env.get('FROM_NAME') || 'Requisition System'
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://requisition-workflow.vercel.app'

interface EmailNotification {
  id: string
  recipient_email: string
  subject: string
  body_html: string
  body_text: string
  notification_type: string
  retry_count: number
  org_id: string
}

interface Organization {
  id: string
  name: string
  email: string | null
}

serve(async (req) => {
  try {
    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Set app.base_url for email templates (optional, ignore errors)
    try {
      await supabase.rpc('set_config', {
        setting: 'app.base_url',
        value: APP_BASE_URL,
        is_local: true
      })
    } catch {
      // Ignore if function doesn't exist
    }

    // Fetch pending emails (limit to 10 per run to avoid timeout)
    const { data: emails, error: fetchError } = await supabase
      .from('email_notifications')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', 3) // Don't retry more than 3 times
      .order('created_at', { ascending: true })
      .limit(10)

    if (fetchError) {
      throw new Error(`Failed to fetch emails: ${fetchError.message}`)
    }

    if (!emails || emails.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending emails', processed: 0 }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`Processing ${emails.length} emails...`)

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Cache organization details to avoid repeated lookups
    const orgCache = new Map<string, Organization>()

    // Process each email with rate limiting (Resend allows 2 req/sec)
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i] as EmailNotification
      
      // Add delay between emails to avoid rate limiting (500ms = 2 req/sec max)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      try {
        // Fetch organization details (with caching)
        let org: Organization | null = null
        if (email.org_id) {
          if (orgCache.has(email.org_id)) {
            org = orgCache.get(email.org_id)!
          } else {
            const { data: orgData } = await supabase
              .from('organizations')
              .select('id, name, email')
              .eq('id', email.org_id)
              .single()
            
            if (orgData) {
              org = orgData as Organization
              orgCache.set(email.org_id, org)
            }
          }
        }

        // Send email using Resend with org-specific Reply-To
        const sent = await sendEmail(email, org)

        if (sent) {
          // Update status to 'sent'
          await supabase
            .from('email_notifications')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              error_message: null
            })
            .eq('id', email.id)

          results.sent++
          console.log(`✓ Sent email to ${email.recipient_email}`)
        } else {
          throw new Error('Failed to send email')
        }
      } catch (error) {
        // Update status to 'failed' and increment retry count
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        await supabase
          .from('email_notifications')
          .update({
            status: email.retry_count >= 2 ? 'failed' : 'pending',
            retry_count: email.retry_count + 1,
            error_message: errorMessage
          })
          .eq('id', email.id)

        results.failed++
        results.errors.push(`${email.recipient_email}: ${errorMessage}`)
        console.error(`✗ Failed to send email to ${email.recipient_email}:`, errorMessage)
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Email processing complete',
        processed: emails.length,
        results
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in send-emails function:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

/**
 * Send email using Resend
 * Uses org-specific Reply-To for multi-tenant support
 * You can replace this with SendGrid, Mailgun, or any other service
 */
async function sendEmail(email: EmailNotification, org: Organization | null): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set, skipping email send (dev mode)')
    return true // In development, pretend email was sent
  }

  try {
    // Build FROM address with org name if available
    const fromName = org?.name || FROM_NAME
    const fromAddress = `${fromName} <${FROM_EMAIL}>`

    // Build email payload with optional Reply-To
    const emailPayload: Record<string, unknown> = {
      from: fromAddress,
      to: [email.recipient_email],
      subject: email.subject,
      html: email.body_html,
      text: email.body_text
    }

    // Add Reply-To if organization has an email configured
    if (org?.email) {
      emailPayload.reply_to = org.email
      console.log(`Using Reply-To: ${org.email} for org: ${org.name}`)
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify(emailPayload)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`)
    }

    return true
  } catch (error) {
    console.error('Error sending email via Resend:', error)
    throw error
  }
}

/*
 * ALTERNATIVE: SendGrid Implementation
 * Uncomment and configure if you prefer SendGrid over Resend
 */
/*
async function sendEmailWithSendGrid(email: EmailNotification): Promise<boolean> {
  const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')

  if (!SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not set, skipping email send')
    return true
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SENDGRID_API_KEY}`
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: email.recipient_email }]
        }],
        from: { email: FROM_EMAIL },
        subject: email.subject,
        content: [
          { type: 'text/plain', value: email.body_text },
          { type: 'text/html', value: email.body_html }
        ]
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`SendGrid API error: ${errorData}`)
    }

    return true
  } catch (error) {
    console.error('Error sending email via SendGrid:', error)
    throw error
  }
}
*/
