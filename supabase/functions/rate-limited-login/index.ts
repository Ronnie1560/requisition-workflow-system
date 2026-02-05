import { serve } from 'http/server.ts'
import { createClient } from 'supabase'

/**
 * Edge Function: rate-limited-login
 * 
 * Wraps Supabase Auth signInWithPassword with additional rate limiting.
 * Limits: 5 failed attempts per 15 minutes per email or IP address.
 * 
 * This provides protection against brute force attacks beyond Supabase's
 * built-in rate limiting.
 */

// Rate limiting configuration
const MAX_ATTEMPTS = 5          // Maximum failed login attempts
const WINDOW_MINUTES = 15       // Time window for rate limiting
const LOCKOUT_MINUTES = 30      // How long to lock out after max attempts

// Allowed origins for CORS
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [
  'https://requisition-workflow.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
]

// CORS headers helper
const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// Sanitize email input
const sanitizeEmail = (email: string): string => {
  if (!email) return ''
  return email.toLowerCase().trim().substring(0, 255)
}

// Get client IP from request headers
const getClientIP = (request: Request): string => {
  // Check common headers for real IP (behind proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP.trim()
  }
  
  // Fallback - Cloudflare/Vercel headers
  const cfIP = request.headers.get('cf-connecting-ip')
  if (cfIP) {
    return cfIP.trim()
  }
  
  return 'unknown'
}

serve(async (request: Request) => {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Parse request body
    const { email, password } = await request.json()

    // Validate required fields
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sanitizedEmail = sanitizeEmail(email)
    const clientIP = getClientIP(request)

    // Create Supabase admin client for rate limiting checks
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check rate limit by email (primary - prevents brute force on specific accounts)
    const { data: emailRateLimit, error: emailRateLimitError } = await supabaseAdmin
      .rpc('check_rate_limit', {
        p_endpoint: 'login_email',
        p_identifier: sanitizedEmail,
        p_max_attempts: MAX_ATTEMPTS,
        p_window_minutes: LOCKOUT_MINUTES  // Use longer window for email-based limiting
      })

    if (emailRateLimitError) {
      console.error('Rate limit check error (email):', emailRateLimitError)
      // Don't fail the request, just log and continue
    } else if (emailRateLimit && !emailRateLimit.allowed) {
      console.log(`Login rate limited for email: ${sanitizedEmail}`)
      return new Response(
        JSON.stringify({
          error: 'Too many login attempts for this account. Please try again later.',
          retry_after: emailRateLimit.retry_after,
          code: 'RATE_LIMITED'
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(emailRateLimit.retry_after || LOCKOUT_MINUTES * 60)
          } 
        }
      )
    }

    // Check rate limit by IP (secondary - prevents distributed attacks)
    const { data: ipRateLimit, error: ipRateLimitError } = await supabaseAdmin
      .rpc('check_rate_limit', {
        p_endpoint: 'login_ip',
        p_identifier: clientIP,
        p_max_attempts: MAX_ATTEMPTS * 3,  // Allow more attempts per IP (multiple users)
        p_window_minutes: WINDOW_MINUTES
      })

    if (ipRateLimitError) {
      console.error('Rate limit check error (IP):', ipRateLimitError)
    } else if (ipRateLimit && !ipRateLimit.allowed) {
      console.log(`Login rate limited for IP: ${clientIP}`)
      return new Response(
        JSON.stringify({
          error: 'Too many login attempts from this location. Please try again later.',
          retry_after: ipRateLimit.retry_after,
          code: 'RATE_LIMITED'
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(ipRateLimit.retry_after || WINDOW_MINUTES * 60)
          } 
        }
      )
    }

    // Create regular Supabase client for auth
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Attempt login
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email: sanitizedEmail,
      password
    })

    if (error) {
      // Log failed attempt for security monitoring
      console.log(`Failed login attempt for: ${sanitizedEmail} from IP: ${clientIP}`)
      
      // Note: Rate limit was already incremented by check_rate_limit
      // Return generic error to avoid user enumeration
      return new Response(
        JSON.stringify({ 
          error: 'Invalid login credentials',
          code: 'INVALID_CREDENTIALS'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Successful login - reset rate limit for this email
    // (We don't reset, as the rate limit naturally expires)
    console.log(`Successful login for: ${sanitizedEmail}`)

    // Return session data
    return new Response(
      JSON.stringify({
        user: data.user,
        session: data.session
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Login error:', error)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
