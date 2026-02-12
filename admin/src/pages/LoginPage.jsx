import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Shield, AlertCircle, Loader, Lock, Clock } from 'lucide-react'

export default function LoginPage() {
  const { signIn, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lockedUntil, setLockedUntil] = useState(null)

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/', { replace: true })
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLockedUntil(null)
    setLoading(true)

    try {
      await signIn(email, password)
      // Auth state change will trigger redirect via ProtectedRoute
    } catch (err) {
      const msg = err.message || 'Invalid credentials or not a platform admin'
      setError(msg)
      // Parse lockout time if present
      const lockMatch = msg.match(/Try again after (.+)\./)
      if (lockMatch) {
        setLockedUntil(lockMatch[1])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600/20 mb-4">
            <Shield className="h-8 w-8 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Platform</h1>
          <p className="text-gray-400 mt-1">LedgerWorkflow Administration</p>
        </div>

        {/* Login form */}
        <form
          onSubmit={handleSubmit}
          className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4"
        >
          {/* Lockout warning */}
          {lockedUntil && (
            <div className="flex items-start gap-3 p-3 bg-yellow-900/30 border border-yellow-800 rounded-lg text-sm text-yellow-300">
              <Lock className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Account temporarily locked</p>
                <p className="text-yellow-400/80 mt-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Try again after {lockedUntil}
                </p>
              </div>
            </div>
          )}

          {/* General error */}
          {error && !lockedUntil && (
            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white
                       placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white
                       placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50
                     text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            Access restricted to platform administrators only.
            <br />
            <span className="text-gray-600">5 failed attempts will lock your account for 15 minutes.</span>
          </p>
        </form>
      </div>
    </div>
  )
}
