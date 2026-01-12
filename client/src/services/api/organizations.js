import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'

/**
 * Organizations API Service
 * Handles all organization-related database operations
 */

// =====================================================
// ORGANIZATION OPERATIONS
// =====================================================

/**
 * Get all organizations the current user belongs to
 */
export const getUserOrganizations = async () => {
  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        id,
        role,
        joined_at,
        organization:organizations(
          id,
          name,
          slug,
          logo_url,
          plan,
          status,
          max_users,
          max_projects,
          max_requisitions_per_month
        )
      `)
      .order('joined_at', { ascending: true })

    if (error) throw error

    // Transform data to return organizations with member role
    const organizations = data?.map(item => ({
      ...item.organization,
      memberRole: item.role,
      memberId: item.id
    })) || []

    return { data: organizations, error: null }
  } catch (error) {
    logger.error('Error fetching user organizations:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Get a single organization by ID
 */
export const getOrganizationById = async (orgId) => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select(`
        *,
        organization_members(
          id,
          role,
          user_id,
          joined_at,
          user:users(id, full_name, email, avatar_url)
        )
      `)
      .eq('id', orgId)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching organization:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Create a new organization
 */
export const createOrganization = async (orgData) => {
  try {
    // Use the database function for creation
    const { data, error } = await supabase.rpc('create_organization', {
      org_name: orgData.name,
      org_slug: orgData.slug,
      org_email: orgData.email || null
    })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error creating organization:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Update an organization
 */
export const updateOrganization = async (orgId, updates) => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', orgId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating organization:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Delete an organization (owner only)
 */
export const deleteOrganization = async (orgId) => {
  try {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId)

    if (error) throw error
    return { error: null }
  } catch (error) {
    logger.error('Error deleting organization:', error)
    return { error: error.message }
  }
}

// =====================================================
// MEMBER OPERATIONS
// =====================================================

/**
 * Get all members of an organization
 */
export const getOrganizationMembers = async (orgId) => {
  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        id,
        role,
        joined_at,
        user:users(id, full_name, email, avatar_url, role)
      `)
      .eq('org_id', orgId)
      .order('role', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching organization members:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Invite a user to an organization
 */
export const inviteUserToOrganization = async (orgId, email, role = 'member') => {
  try {
    // Use the database function for invitation
    const { data, error } = await supabase.rpc('invite_user_to_org', {
      org_id: orgId,
      user_email: email,
      member_role: role
    })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error inviting user to organization:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Remove a member from an organization
 */
export const removeMember = async (memberId) => {
  try {
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId)

    if (error) throw error
    return { error: null }
  } catch (error) {
    logger.error('Error removing member:', error)
    return { error: error.message }
  }
}

/**
 * Update a member's role
 */
export const updateMemberRole = async (memberId, newRole) => {
  try {
    const { data, error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating member role:', error)
    return { data: null, error: error.message }
  }
}

// =====================================================
// ORGANIZATION CONTEXT HELPERS
// =====================================================

/**
 * Set the current organization context for RLS
 * This should be called when switching organizations
 */
export const setOrganizationContext = async (orgId) => {
  try {
    // Store in local storage for persistence
    if (orgId) {
      localStorage.setItem('pcm_selected_org_id', orgId)
    } else {
      localStorage.removeItem('pcm_selected_org_id')
    }
    
    return { error: null }
  } catch (error) {
    logger.error('Error setting organization context:', error)
    return { error: error.message }
  }
}

/**
 * Get the currently selected organization ID
 */
export const getCurrentOrganizationId = () => {
  return localStorage.getItem('pcm_selected_org_id')
}

/**
 * Clear organization context (on logout)
 */
export const clearOrganizationContext = () => {
  localStorage.removeItem('pcm_selected_org_id')
}

// =====================================================
// USAGE STATISTICS
// =====================================================

/**
 * Get organization usage statistics
 */
export const getOrganizationStats = async (orgId) => {
  try {
    // Get counts in parallel
    const [usersResult, projectsResult, requisitionsResult] = await Promise.all([
      supabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),
      supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),
      supabase
        .from('requisitions')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
    ])

    return {
      data: {
        users: usersResult.count || 0,
        projects: projectsResult.count || 0,
        requisitions: requisitionsResult.count || 0
      },
      error: null
    }
  } catch (error) {
    logger.error('Error fetching organization stats:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Check if organization has reached limits
 */
export const checkOrganizationLimits = async (orgId) => {
  try {
    const [org, stats] = await Promise.all([
      getOrganizationById(orgId),
      getOrganizationStats(orgId)
    ])

    if (org.error) throw new Error(org.error)
    if (stats.error) throw new Error(stats.error)

    return {
      data: {
        users: {
          current: stats.data.users,
          max: org.data.max_users,
          remaining: org.data.max_users - stats.data.users,
          atLimit: stats.data.users >= org.data.max_users
        },
        projects: {
          current: stats.data.projects,
          max: org.data.max_projects,
          remaining: org.data.max_projects - stats.data.projects,
          atLimit: stats.data.projects >= org.data.max_projects
        }
      },
      error: null
    }
  } catch (error) {
    logger.error('Error checking organization limits:', error)
    return { data: null, error: error.message }
  }
}
