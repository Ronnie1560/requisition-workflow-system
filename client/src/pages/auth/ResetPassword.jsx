import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Lock, AlertCircle, CheckCircle } from 'lucide-react'
import { logger } from '../../utils/logger'

const ResetPassword = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Check for session on mount (handles invitation/recovery tokens)
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check if there's already a session
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          logger.info('Session found:', session)
          setSessionReady(true)
        } else {
          // If no session, check URL for token (hash fragment)
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const type = hashParams.get('type')

          logger.info('URL hash params:', { accessToken: accessToken ? 'present' : 'missing', type })

          if (accessToken) {
            // Token found in URL, session should be established automatically
            // Wait a bit and check again
            setTimeout(async () => {
              const { data: { session: newSession } } = await supabase.auth.getSession()
              if (newSession) {
                logger.info('Session established from token')
                setSessionReady(true)
              } else {
                setError('Could not establish session. Please try clicking the link again.')
              }
            }, 1000)
          } else {
            setError('Auth session missing! Please use the link from your email.')
          }
        }
      } catch (err) {
        logger.error('Session check error:', err)
        setError('Failed to verify authentication. Please try clicking the link again.')
      }
    }

    checkSession()
  }, [])

  // Password strength calculation
  const calculatePasswordStrength = (password) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[^a-zA-Z\d]/.test(password)) strength++
    return strength
  }

  const passwordStrength = calculatePasswordStrength(formData.password)
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-blue-500',
    'bg-green-500'
  ]

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  const validateForm = () => {
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return false
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return false
    }

    if (passwordStrength < 2) {
      setError('Password is too weak. Use a mix of letters, numbers, and symbols.')
      return false
    }

    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!validateForm()) {
      return
    }

    if (!sessionReady) {
      setError('Session not ready. Please wait or try clicking the link again.')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.password
      })

      if (updateError) {
        logger.error('Password update error:', updateError)
        setError(updateError.message)
      } else {
        setSuccess(true)
        setTimeout(() => {
          navigate('/login')
        }, 2000)
      }
    } catch (err) {
      logger.error('Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Set Your Password
          </h1>
          <p className="text-gray-600">Create a secure password for your account</p>
        </div>

        {/* Loading State */}
        {!sessionReady && !error && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5"></div>
            <div>
              <h3 className="text-sm font-medium text-blue-800">Verifying...</h3>
              <p className="text-sm text-blue-700 mt-1">Please wait while we verify your invitation.</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              {error.includes('session missing') && (
                <p className="text-sm text-red-700 mt-2">
                  Please check your email and click the invitation link again.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-green-800">
                Password set successfully!
              </h3>
              <p className="text-sm text-green-700 mt-1">
                Redirecting to login page...
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* New Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={!sessionReady || success}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="••••••••"
              />
            </div>

            {/* Password Strength Indicator */}
            {formData.password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[...Array(5)].map((_, index) => (
                    <div
                      key={index}
                      className={`h-1 flex-1 rounded ${
                        index < passwordStrength
                          ? strengthColors[passwordStrength - 1]
                          : 'bg-gray-200'
                      }`}
                    ></div>
                  ))}
                </div>
                <p className="text-xs text-gray-600">
                  Strength:{' '}
                  <span
                    className={`font-medium ${
                      passwordStrength >= 3 ? 'text-green-600' : 'text-orange-600'
                    }`}
                  >
                    {strengthLabels[passwordStrength] || 'Very Weak'}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={!sessionReady || success}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Password Requirements */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-700 mb-2">
              Password must contain:
            </p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className="flex items-center gap-2">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    formData.password.length >= 8
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300'
                  }`}
                >
                  {formData.password.length >= 8 && '✓'}
                </span>
                At least 8 characters
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    /[a-z]/.test(formData.password) &&
                    /[A-Z]/.test(formData.password)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300'
                  }`}
                >
                  {/[a-z]/.test(formData.password) &&
                    /[A-Z]/.test(formData.password) &&
                    '✓'}
                </span>
                Upper and lowercase letters
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    /\d/.test(formData.password)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300'
                  }`}
                >
                  {/\d/.test(formData.password) && '✓'}
                </span>
                At least one number
              </li>
            </ul>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || success || !sessionReady}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Setting password...
              </>
            ) : success ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Password set!
              </>
            ) : !sessionReady ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Verifying...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Set Password
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ResetPassword
