import { useState, useRef, useEffect, memo } from 'react'
import PropTypes from 'prop-types'
import { ChevronDown, Building2, Check, Plus, Settings } from 'lucide-react'
import { useOrganization } from '../../context/OrganizationContext'

/**
 * Organization Switcher Component
 * Dropdown for switching between organizations
 */
function OrganizationSwitcher({ className = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  
  const {
    organizations,
    currentOrg,
    loading,
    hasMultipleOrgs,
    switchOrganization,
    isOwner,
  } = useOrganization()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on escape key
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  if (loading) {
    return (
      <div className={`animate-pulse flex items-center gap-2 ${className}`}>
        <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
        <div className="w-24 h-4 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (!currentOrg) {
    return null
  }

  const handleSwitch = (orgId) => {
    if (orgId !== currentOrg.id) {
      switchOrganization(orgId)
    }
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* Org Logo or Icon */}
        {currentOrg.logo_url ? (
          <img
            src={currentOrg.logo_url}
            alt={currentOrg.name}
            className="w-8 h-8 rounded-lg object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
        )}

        {/* Org Name */}
        <div className="text-left hidden sm:block">
          <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
            {currentOrg.name}
          </p>
          <p className="text-xs text-gray-500 capitalize">
            {currentOrg.plan} plan
          </p>
        </div>

        {/* Dropdown Arrow */}
        {hasMultipleOrgs && (
          <ChevronDown 
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {/* Organizations List */}
          <div className="max-h-64 overflow-y-auto">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors ${
                  org.id === currentOrg.id ? 'bg-blue-50' : ''
                }`}
                role="option"
                aria-selected={org.id === currentOrg.id}
              >
                {/* Org Logo */}
                {org.logo_url ? (
                  <img
                    src={org.logo_url}
                    alt={org.name}
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-gray-500" />
                  </div>
                )}

                {/* Org Details */}
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {org.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {org.member_role} · {org.plan}
                  </p>
                </div>

                {/* Selected Check */}
                {org.id === currentOrg.id && (
                  <Check className="w-4 h-4 text-blue-600" />
                )}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-1"></div>

          {/* Actions */}
          {isOwner && (
            <a
              href="/settings/organization"
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Organization Settings
            </a>
          )}

          <a
            href="/organizations/new"
            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Organization
          </a>
        </div>
      )}
    </div>
  )
}

OrganizationSwitcher.propTypes = {
  className: PropTypes.string,
}

export default memo(OrganizationSwitcher)
