import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'
import { 
  Building2, 
  User, 
  Mail, 
  Lock, 
  Phone,
  ArrowRight, 
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Globe
} from 'lucide-react'

/**
 * Organization Signup Page
 * 
 * Two-step flow for creating a new organization:
 * Step 1: Organization details (name, slug, email)
 * Step 2: Admin account (name, email, password)
 * 
 * This creates both the organization and the first admin user.
 * After signup, the user is automatically logged in and redirected to dashboard.
 */
export default function OrganizationSignup() {
  const navigate = useNavigate()
  
  // Step management
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [checkingSlug, setCheckingSlug] = useState(false)
  const [slugAvailable, setSlugAvailable] = useState(null)

  // Organization data (Step 1)
  const [orgData, setOrgData] = useState({
    name: '',
    slug: '',
    email: '',
    plan: 'free'
  })

  // Admin user data (Step 2)
  const [userData, setUserData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: ''
  })

  // Auto-generate slug from organization name
  const handleOrgNameChange = (e) => {
    const name = e.target.value
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
    
    setOrgData(prev => ({ ...prev, name, slug }))
    setSlugAvailable(null) // Reset availability check
  }

  // Check slug availability with debounce
  useEffect(() => {
    if (!orgData.slug || orgData.slug.length < 3) {
      setSlugAvailable(null)
      return
    }

    const timer = setTimeout(async () => {
      setCheckingSlug(true)
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('id')
          .eq('slug', orgData.slug)
          .maybeSingle()
        
        if (error) throw error
        setSlugAvailable(!data) // Available if no existing org with this slug
      } catch (err) {
        logger.error('Error checking slug availability:', err)
        setSlugAvailable(null)
      } finally {
        setCheckingSlug(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [orgData.slug])

  // Calculate password strength
  const calculatePasswordStrength = (password) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[^a-zA-Z\d]/.test(password)) strength++
    return strength
  }

  const passwordStrength = calculatePasswordStrength(userData.password)
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']

  // Validate Step 1
  const validateStep1 = () => {
    if (!orgData.name.trim()) {
      setError('Organization name is required')
      return false
    }
    if (!orgData.slug.trim() || orgData.slug.length < 3) {
      setError('Organization URL must be at least 3 characters')
      return false
    }
    if (slugAvailable === false) {
      setError('This organization URL is already taken')
      return false
    }
    if (orgData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orgData.email)) {
      setError('Please enter a valid email address')
      return false
    }
    return true
  }

  // Validate Step 2
  const validateStep2 = () => {
    if (!userData.fullName.trim()) {
      setError('Your name is required')
      return false
    }
    if (!userData.email.trim()) {
      setError('Email address is required')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      setError('Please enter a valid email address')
      return false
    }
    if (userData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return false
    }
    if (!/[a-z]/.test(userData.password)) {
      setError('Password must contain at least one lowercase letter')
      return false
    }
    if (!/[A-Z]/.test(userData.password)) {
      setError('Password must contain at least one uppercase letter')
      return false
    }
    if (!/\d/.test(userData.password)) {
      setError('Password must contain at least one number')
      return false
    }
    if (userData.password !== userData.confirmPassword) {
      setError('Passwords do not match')
      return false
    }
    return true
  }

  // Handle Step 1 submission
  const handleStep1Submit = (e) => {
    e.preventDefault()
    setError(null)
    
    if (validateStep1()) {
      // Pre-fill admin email with org email if provided
      if (orgData.email && !userData.email) {
        setUserData(prev => ({ ...prev, email: orgData.email }))
      }
      setStep(2)
    }
  }

  // Handle Step 2 submission (final)
  const handleStep2Submit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!validateStep2()) return

    setLoading(true)

    try {
      // Call the Edge Function to create organization and admin user
      const { data, error: signupError } = await supabase.functions.invoke('create-organization-signup', {
        body: {
          organization: {
            name: orgData.name,
            slug: orgData.slug,
            email: orgData.email || userData.email,
            plan: orgData.plan
          },
          admin: {
            fullName: userData.fullName,
            email: userData.email,
            password: userData.password,
            phone: userData.phone
          }
        }
      })

      // Log the full response for debugging
      logger.info('Edge Function response:', { data, signupError })

      // Handle edge function invocation error
      if (signupError) {
        // The error message is typically in signupError.message
        // For FunctionsHttpError, the actual error might be in the response data
        logger.error('Edge Function error:', signupError)
        throw new Error(signupError.message || 'Failed to create organization')
      }

      // Handle error returned in data
      if (data?.error) {
        throw new Error(data.error)
      }

      logger.info('Organization created successfully', { orgId: data?.organizationId })
      setSuccess(true)

      // Sign in the user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: userData.password
      })

      if (signInError) {
        logger.warn('Auto sign-in failed, redirecting to login', signInError)
        // Still a success, just redirect to login
        setTimeout(() => navigate('/login'), 2000)
      } else {
        // Redirect to dashboard after short delay
        setTimeout(() => navigate('/dashboard'), 1500)
      }
    } catch (err) {
      logger.error('Organization signup failed:', err)
      setError(err.message || 'Failed to create organization. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Organization Created!
          </h2>
          <p className="text-gray-600 mb-4">
            Welcome to {orgData.name}. Redirecting you to your dashboard...
          </p>
          <div className="flex justify-center">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        </div>
      </div>
    )
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
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Create Your Organization
          </h1>
          <p className="text-gray-600">
            {step === 1 ? 'Step 1 of 2: Organization Details' : 'Step 2 of 2: Admin Account'}
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
            step >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
          </div>
          <div className={`w-16 h-1 ${step > 1 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
            step >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            2
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: Organization Details */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-6">
            {/* Organization Name */}
            <div>
              <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-2">
                Organization Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="orgName"
                  value={orgData.name}
                  onChange={handleOrgNameChange}
                  placeholder="Acme Corporation"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                />
              </div>
            </div>

            {/* Organization URL (Slug) */}
            <div>
              <label htmlFor="orgSlug" className="block text-sm font-medium text-gray-700 mb-2">
                Organization URL <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Globe className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="orgSlug"
                  value={orgData.slug}
                  onChange={(e) => {
                    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                    setOrgData(prev => ({ ...prev, slug }))
                    setSlugAvailable(null)
                  }}
                  placeholder="acme-corp"
                  className={`block w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                    slugAvailable === false ? 'border-red-300' : 
                    slugAvailable === true ? 'border-green-300' : 'border-gray-300'
                  }`}
                  required
                  minLength={3}
                />
                {/* Availability indicator */}
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  {checkingSlug && <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />}
                  {!checkingSlug && slugAvailable === true && <CheckCircle className="h-5 w-5 text-green-500" />}
                  {!checkingSlug && slugAvailable === false && <AlertCircle className="h-5 w-5 text-red-500" />}
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                This will be your unique organization identifier
              </p>
              {slugAvailable === false && (
                <p className="mt-1 text-xs text-red-600">This URL is already taken</p>
              )}
            </div>

            {/* Organization Email (Optional) */}
            <div>
              <label htmlFor="orgEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Organization Email <span className="text-gray-400">(optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  id="orgEmail"
                  value={orgData.email}
                  onChange={(e) => setOrgData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contact@acme.com"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Continue Button */}
            <button
              type="submit"
              disabled={checkingSlug || slugAvailable === false}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Step 2: Admin Account */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-5">
            {/* Back button */}
            <button
              type="button"
              onClick={() => { setStep(1); setError(null); }}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to organization details
            </button>

            {/* Admin Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                Your Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="fullName"
                  value={userData.fullName}
                  onChange={(e) => setUserData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="John Doe"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                />
              </div>
            </div>

            {/* Admin Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  value={userData.email}
                  onChange={(e) => setUserData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="john@acme.com"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                />
              </div>
            </div>

            {/* Phone (Optional) */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone <span className="text-gray-400">(optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  id="phone"
                  value={userData.phone}
                  onChange={(e) => setUserData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  id="password"
                  value={userData.password}
                  onChange={(e) => setUserData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                  minLength={8}
                />
              </div>
              {/* Password Strength */}
              {userData.password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[...Array(5)].map((_, index) => (
                      <div
                        key={index}
                        className={`h-1 flex-1 rounded transition-colors ${
                          index < passwordStrength ? strengthColors[passwordStrength - 1] : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-600">
                    Strength: <span className={`font-medium ${passwordStrength >= 3 ? 'text-green-600' : 'text-orange-600'}`}>
                      {strengthLabels[passwordStrength] || 'Very Weak'}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  id="confirmPassword"
                  value={userData.confirmPassword}
                  onChange={(e) => setUserData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="••••••••"
                  className={`block w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                    userData.confirmPassword && userData.password !== userData.confirmPassword
                      ? 'border-red-300'
                      : 'border-gray-300'
                  }`}
                  required
                />
              </div>
              {userData.confirmPassword && userData.password !== userData.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
              )}
            </div>

            {/* Create Organization Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating organization...
                </>
              ) : (
                <>
                  <Building2 className="w-5 h-5" />
                  Create Organization
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer Links */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
