import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, X, ArrowRight } from 'lucide-react'
import { useOrganization } from '../../context/OrganizationContext'
import { useAuth } from '../../context/AuthContext'

const BANNER_DISMISSED_KEY = 'pcm_default_org_banner_dismissed'
const DEFAULT_ORG_SLUG = 'default'

/**
 * DefaultOrgBanner
 * Shows a dismissible banner on the dashboard for users in Default Organization
 * Less intrusive than the modal - appears at the top of the dashboard
 */
export default function DefaultOrgBanner() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentOrganization, organizations } = useOrganization()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if we should show the banner
    const shouldShow = () => {
      // Don't show if already dismissed
      const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY)
      if (dismissed === 'true') return false

      // Don't show if user is super_admin
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
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true')
    setIsVisible(false)
  }

  const handleCreateOrg = () => {
    navigate('/organizations/new')
  }

  if (!isVisible) return null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-blue-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Ready to create your own organization?
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            You're currently in the Default Organization. Create your own to manage projects, invite team members, and customize workflows.
          </p>
          <button
            onClick={handleCreateOrg}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Organization
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>
    </div>
  )
}
