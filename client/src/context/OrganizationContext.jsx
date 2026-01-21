import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'

/**
 * Organization Context
 * Manages multi-tenant organization state
 *
 * REACTIVE DATA REFRESHING:
 * When the organization changes (via switchOrganization or createOrganization),
 * components need to refetch their data. This is handled via:
 *
 * 1. orgVersion: A counter that increments on org changes. Add it to useEffect deps:
 *    ```js
 *    const { orgId, orgVersion } = useOrganization()
 *    useEffect(() => {
 *      fetchMyData(orgId)
 *    }, [orgId, orgVersion])
 *    ```
 *
 * 2. organizationChanged event: For manual handling if needed:
 *    ```js
 *    useEffect(() => {
 *      const handler = (e) => { console.log('Org changed to:', e.detail.orgId) }
 *      window.addEventListener('organizationChanged', handler)
 *      return () => window.removeEventListener('organizationChanged', handler)
 *    }, [])
 *    ```
 */

const OrganizationContext = createContext(null)

// Local storage key for persisting selected org
const SELECTED_ORG_KEY = 'pcm_selected_org_id'

/**
 * Organization Provider Component
 * Wraps the app and provides organization context
 */
export function OrganizationProvider({ children }) {
  const [organizations, setOrganizations] = useState([])
  const [currentOrg, setCurrentOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  // Version number that increments when org changes - components can use this to trigger refetches
  const [orgVersion, setOrgVersion] = useState(0)

  /**
   * Fetch user's organizations
   */
  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('user_organizations')
        .select('*')

      if (fetchError) throw fetchError

      setOrganizations(data || [])

      // Restore previously selected org or use first one
      const savedOrgId = localStorage.getItem(SELECTED_ORG_KEY)
      const savedOrg = data?.find(org => org.id === savedOrgId)
      
      if (savedOrg) {
        setCurrentOrg(savedOrg)
      } else if (data?.length > 0) {
        setCurrentOrg(data[0])
        localStorage.setItem(SELECTED_ORG_KEY, data[0].id)
      }

      logger.debug('[OrganizationContext] Loaded organizations', { count: data?.length })
    } catch (err) {
      logger.error('[OrganizationContext] Failed to fetch organizations', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Switch to a different organization
   */
  const switchOrganization = useCallback((orgId) => {
    const org = organizations.find(o => o.id === orgId)
    if (org) {
      setCurrentOrg(org)
      localStorage.setItem(SELECTED_ORG_KEY, orgId)
      logger.info('[OrganizationContext] Switched to organization', { orgId, name: org.name })

      // Increment version to trigger data refresh in components
      setOrgVersion(v => v + 1)

      // Dispatch custom event for components that need manual refresh
      window.dispatchEvent(new CustomEvent('organizationChanged', {
        detail: { orgId, orgName: org.name }
      }))
    }
  }, [organizations])

  /**
   * Create a new organization
   */
  const createOrganization = useCallback(async ({ name, slug, email }) => {
    try {
      const { data, error: createError } = await supabase
        .rpc('create_organization', {
          p_name: name,
          p_slug: slug,
          p_email: email,
          p_plan: 'free'
        })

      if (createError) throw createError

      // Refresh organizations list
      await fetchOrganizations()

      // Switch to new org reactively (no page reload)
      if (data) {
        const newOrg = organizations.find(o => o.id === data)
        if (newOrg) {
          setCurrentOrg(newOrg)
          localStorage.setItem(SELECTED_ORG_KEY, data)

          // Increment version to trigger data refresh
          setOrgVersion(v => v + 1)

          // Dispatch event for manual refresh needs
          window.dispatchEvent(new CustomEvent('organizationChanged', {
            detail: { orgId: data, orgName: newOrg.name }
          }))

          logger.info('[OrganizationContext] Created and switched to new organization', { orgId: data })
        }
      }

      return { data, error: null }
    } catch (err) {
      logger.error('[OrganizationContext] Failed to create organization', err)
      return { data: null, error: err.message }
    }
  }, [fetchOrganizations, organizations])

  /**
   * Update current organization
   */
  const updateOrganization = useCallback(async (updates) => {
    if (!currentOrg) return { error: 'No organization selected' }

    try {
      const { data, error: updateError } = await supabase
        .from('organizations')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentOrg.id)
        .select()
        .single()

      if (updateError) throw updateError

      // Update local state
      setCurrentOrg(prev => ({ ...prev, ...data }))
      setOrganizations(prev => 
        prev.map(org => org.id === currentOrg.id ? { ...org, ...data } : org)
      )

      return { data, error: null }
    } catch (err) {
      logger.error('[OrganizationContext] Failed to update organization', err)
      return { data: null, error: err.message }
    }
  }, [currentOrg])

  /**
   * Invite user to current organization
   */
  const inviteUser = useCallback(async (email, role = 'member') => {
    if (!currentOrg) return { error: 'No organization selected' }

    try {
      const { data, error: inviteError } = await supabase
        .rpc('invite_user_to_org', {
          p_org_id: currentOrg.id,
          p_email: email,
          p_role: role
        })

      if (inviteError) throw inviteError

      return { data, error: null }
    } catch (err) {
      logger.error('[OrganizationContext] Failed to invite user', err)
      return { data: null, error: err.message }
    }
  }, [currentOrg])

  /**
   * Get organization members
   */
  const getMembers = useCallback(async () => {
    if (!currentOrg) return { data: null, error: 'No organization selected' }

    try {
      const { data, error: fetchError } = await supabase
        .from('organization_members')
        .select(`
          id,
          role,
          is_active,
          created_at,
          accepted_at,
          user:user_id (
            id,
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError

      return { data, error: null }
    } catch (err) {
      logger.error('[OrganizationContext] Failed to fetch members', err)
      return { data: null, error: err.message }
    }
  }, [currentOrg])

  /**
   * Remove member from organization
   */
  const removeMember = useCallback(async (memberId) => {
    if (!currentOrg) return { error: 'No organization selected' }

    try {
      const { error: deleteError } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId)
        .eq('organization_id', currentOrg.id)

      if (deleteError) throw deleteError

      return { error: null }
    } catch (err) {
      logger.error('[OrganizationContext] Failed to remove member', err)
      return { error: err.message }
    }
  }, [currentOrg])

  /**
   * Update member role
   */
  const updateMemberRole = useCallback(async (memberId, newRole) => {
    if (!currentOrg) return { error: 'No organization selected' }

    try {
      const { error: updateError } = await supabase
        .from('organization_members')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', memberId)
        .eq('organization_id', currentOrg.id)

      if (updateError) throw updateError

      return { error: null }
    } catch (err) {
      logger.error('[OrganizationContext] Failed to update member role', err)
      return { error: err.message }
    }
  }, [currentOrg])

  // Listen for auth state changes
  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session)
      if (!session) {
        setLoading(false)
      }
    })

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const wasAuthenticated = isAuthenticated
      const nowAuthenticated = !!session
      
      setIsAuthenticated(nowAuthenticated)
      
      // If user just signed out, clear org state
      if (event === 'SIGNED_OUT') {
        setOrganizations([])
        setCurrentOrg(null)
        localStorage.removeItem(SELECTED_ORG_KEY)
        setLoading(false)
      }
      
      // If user just signed in, fetch organizations
      if (event === 'SIGNED_IN' && !wasAuthenticated) {
        fetchOrganizations()
      }
    })

    return () => subscription.unsubscribe()
  }, [isAuthenticated, fetchOrganizations])

  // Load organizations when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchOrganizations()
    }
  }, [isAuthenticated, fetchOrganizations])

  // Check if user can manage org
  const canManageOrg = currentOrg?.member_role === 'owner' || currentOrg?.member_role === 'admin'
  const isOwner = currentOrg?.member_role === 'owner'

  const value = {
    // State
    organizations,
    currentOrg,
    loading,
    error,
    orgVersion, // Version number that increments when org changes (use in useEffect deps)

    // Computed
    hasMultipleOrgs: organizations.length > 1,
    canManageOrg,
    isOwner,
    orgId: currentOrg?.id,
    orgSlug: currentOrg?.slug,
    orgName: currentOrg?.name,

    // Actions
    switchOrganization,
    createOrganization,
    updateOrganization,
    inviteUser,
    getMembers,
    removeMember,
    updateMemberRole,
    refreshOrganizations: fetchOrganizations,
  }

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

OrganizationProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

/**
 * Hook to use organization context
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useOrganization() {
  const context = useContext(OrganizationContext)
  
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  
  return context
}

/**
 * HOC to require organization selection
 */
// eslint-disable-next-line react-refresh/only-export-components, no-unused-vars
export function withOrganization(WrappedComponent) {
  return function WithOrganizationComponent(props) {
    const { currentOrg, loading } = useOrganization()

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )
    }

    if (!currentOrg) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">No Organization</h2>
          <p className="text-gray-600">Please create or join an organization to continue.</p>
        </div>
      )
    }

    return <WrappedComponent {...props} />
  }
}

export default OrganizationContext
