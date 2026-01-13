import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, X, ArrowRight } from 'lucide-react'
import { useOrganization } from '../../context/OrganizationContext'
import { useAuth } from '../../context/AuthContext'

const PROMPT_DISMISSED_KEY = 'pcm_org_prompt_dismissed'
const DEFAULT_ORG_SLUG = 'default'

/**
 * CreateOrganizationPrompt
 * Shows a modal prompting users in Default Organization to create their own
 * Only shows for non-admin users who haven't dismissed it
 */
export default function CreateOrganizationPrompt() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentOrganization, organizations } = useOrganization()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if we should show the prompt
    const shouldShow = () => {
      // Don't show if already dismissed
      const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY)
      if (dismissed === 'true') return false

      // Don't show if user is super_admin (they may intentionally stay in Default)
      if (user?.role === 'super_admin') return false

      // Don't show if no organizations loaded yet
      if (!organizations || organizations.length === 0) return false

      // Don't show if user belongs to multiple organizations
      if (organizations.length > 1) return false

      // Only show if user is in Default Organization
      const isInDefaultOrg = currentOrganization?.slug === DEFAULT_ORG_SLUG
      if (!isInDefaultOrg) return false

      return true
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Visibility check based on external state
    setIsVisible(shouldShow())
  }, [user, currentOrganization, organizations])

  const handleDismiss = () => {
    localStorage.setItem(PROMPT_DISMISSED_KEY, 'true')
    setIsVisible(false)
  }

  const handleCreateOrg = () => {
    localStorage.setItem(PROMPT_DISMISSED_KEY, 'true')
    navigate('/organizations/new')
  }

  if (!isVisible) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={handleDismiss} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 relative">
          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {/* Icon */}
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Create Your Organization
          </h2>

          {/* Description */}
          <p className="text-gray-600 mb-6">
            You're currently in the Default Organization. Create your own organization to:
          </p>

          {/* Benefits List */}
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-3">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-700">
                <strong>Manage your own projects</strong> and budgets
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-700">
                <strong>Invite team members</strong> and assign roles
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-700">
                <strong>Customize approval workflows</strong> for your needs
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-700">
                <strong>Access advanced reporting</strong> and analytics
              </span>
            </li>
          </ul>

          {/* Plan Info */}
          <div className="p-4 bg-blue-50 rounded-lg mb-6">
            <p className="text-sm text-blue-900 font-medium mb-1">
              Free Plan Includes
            </p>
            <p className="text-sm text-blue-700">
              5 team members • 10 projects • 100 requisitions/month
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Maybe Later
            </button>
            <button
              onClick={handleCreateOrg}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Organization
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Footer Note */}
          <p className="text-center text-xs text-gray-500 mt-4">
            You can create an organization anytime from the sidebar menu
          </p>
        </div>
      </div>
    </>
  )
}
