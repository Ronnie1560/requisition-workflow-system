import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'
import { Mail, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react'

/**
 * Email Verification Page
 *
 * Shown after user signs up, instructs them to check email
 * Provides option to resend verification email
 */
export default function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { email, organizationName } = location.state || {}

  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState(null)
  const [countdown, setCountdown] = useState(0)

  // Redirect if no email provided
  useEffect(() => {
    if (!email) {
      navigate('/signup-organization')
    }
  }, [email, navigate])

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Handle resend verification email
  const handleResendEmail = async () => {
    if (countdown > 0) return

    setResending(true)
    setResendError(null)
    setResendSuccess(false)

    try {
      // Resend confirmation email
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })

      if (error) throw error

      setResendSuccess(true)
      setCountdown(60) // 60 second cooldown
      logger.info('Verification email resent successfully')

      // Clear success message after 5 seconds
      setTimeout(() => setResendSuccess(false), 5000)
    } catch (err) {
      logger.error('Error resending verification email:', err)
      setResendError(err.message || 'Failed to resend email. Please try again.')
    } finally {
      setResending(false)
    }
  }

  if (!email) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Watermark Logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img
          src="/pcm-icon.svg"
          alt="PCM Logo"
          className="w-96 h-96 opacity-[0.08] select-none"
        />
      </div>

      <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full relative z-10">
        {/* Icon */}
        <div className="text-center mb-6">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Verify Your Email
          </h1>
          <p className="text-gray-600">
            We've sent a verification link to your email
          </p>
        </div>

        {/* Email Address */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gray-600">Email sent to:</p>
              <p className="font-semibold text-gray-900">{email}</p>
              {organizationName && (
                <p className="text-xs text-gray-500 mt-1">Organization: {organizationName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Success message */}
        {resendSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-green-700 font-medium">Email sent!</p>
              <p className="text-sm text-green-600 mt-1">
                Check your inbox for the verification link.
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {resendError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-700">{resendError}</p>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Next Steps:</h3>
          <ol className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-blue-600 mt-0.5">1.</span>
              <span>Check your inbox for an email from Requisition Workflow System</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-blue-600 mt-0.5">2.</span>
              <span>Click the verification link in the email</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-blue-600 mt-0.5">3.</span>
              <span>You'll be redirected to log in</span>
            </li>
          </ol>
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-700">
              <p className="font-medium">Check your spam folder</p>
              <p className="mt-1">
                If you don't see the email in a few minutes, check your spam or junk folder.
              </p>
            </div>
          </div>
        </div>

        {/* Resend Button */}
        <button
          onClick={handleResendEmail}
          disabled={resending || countdown > 0}
          className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {resending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending...
            </>
          ) : countdown > 0 ? (
            <>
              <RefreshCw className="w-5 h-5" />
              Resend in {countdown}s
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              Resend Verification Email
            </>
          )}
        </button>

        {/* Footer Links */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            Wrong email address?{' '}
            <Link to="/signup-organization" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up again
            </Link>
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Already verified?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
