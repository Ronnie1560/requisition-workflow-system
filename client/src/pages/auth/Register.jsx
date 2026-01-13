import { Link } from 'react-router-dom'
import { UserPlus, Mail, ArrowLeft, Shield, Building2 } from 'lucide-react'

/**
 * Register Page - Invitation Only for Team Members
 * 
 * Individual self-registration is disabled for security and data isolation.
 * Team members must be invited by an organization administrator.
 * 
 * However, users can create a NEW ORGANIZATION via /signup-organization
 */
const Register = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Watermark Logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img
          src="/pcm-icon.svg"
          alt="PCM Logo"
          className="w-96 h-96 opacity-[0.10] select-none"
        />
      </div>

      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Join the System
          </h1>
          <p className="text-gray-600">
            PCM Requisition System
          </p>
        </div>

        {/* Create Organization Option */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <Building2 className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-indigo-900 mb-2">
                Create a New Organization
              </h3>
              <p className="text-indigo-800 text-sm leading-relaxed mb-4">
                Start fresh with your own organization. You&apos;ll be the owner and can invite your team.
              </p>
              <Link
                to="/signup-organization"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm"
              >
                <Building2 className="w-4 h-4" />
                Create Organization
              </Link>
            </div>
          </div>
        </div>

        {/* Join Existing Organization */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <UserPlus className="w-6 h-6 text-gray-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">
                Join an Existing Organization
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-3">
                To join an existing organization, you need an invitation from your administrator.
              </p>
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500">
                  When invited, you&apos;ll receive an email with a link to set your password.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Already have an account */}
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-4">
            Already have an account?
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to Login
          </Link>
        </div>

        {/* Contact info */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Need help? Contact your organization administrator or IT support.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
