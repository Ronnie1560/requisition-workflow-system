import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'
import { getCurrentOrgId } from './orgContext'
import { logCrossOrgAccess } from '../../utils/auditLogger'

/**
 * Users API Service
 * Handles user management operations
 */

// =====================================================
// CACHE FOR USERS LIST
// =====================================================
let usersCache = null
let usersCacheTimestamp = null
const USERS_CACHE_DURATION = 2 * 60 * 1000 // 2 minutes

const isUsersCacheValid = () => {
  if (!usersCache || !usersCacheTimestamp) return false
  return (Date.now() - usersCacheTimestamp) < USERS_CACHE_DURATION
}

export const clearUsersCache = () => {
  usersCache = null
  usersCacheTimestamp = null
}

// =====================================================
// FETCH OPERATIONS
// =====================================================

/**
 * Get all users (admin only) - Optimized with caching
 */
export const getAllUsers = async (filters = {}, forceRefresh = false) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    // Return cached data if valid and no filters applied
    const hasFilters = filters.role || filters.is_active !== undefined || filters.search
    if (!forceRefresh && !hasFilters && isUsersCacheValid()) {
      return { data: usersCache, error: null }
    }

    // Use optimized view if no complex filters
    let query = supabase
      .from('users_with_assignments')
      .select('*')
      .eq('org_id', orgId) // Filter by current organization
      .order('created_at', { ascending: false })

    // Apply filters
    if (filters.role) {
      query = query.eq('role', filters.role)
    }
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active)
    }
    if (filters.search) {
      query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) throw error

    // Cache results if no filters
    if (!hasFilters) {
      usersCache = data
      usersCacheTimestamp = Date.now()
    }

    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching users:', error)
    // Try to return cached data on error
    if (usersCache) {
      return { data: usersCache, error: null }
    }
    return { data: null, error }
  }
}

/**
 * Get a single user by ID
 */
export const getUserById = async (userId) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        project_assignments:user_project_assignments!user_project_assignments_user_id_fkey(
          id,
          role,
          is_active,
          assigned_at,
          project:projects(id, code, name, budget)
        )
      `)
      .eq('id', userId)
      .eq('org_id', orgId) // Filter by current organization
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching user:', error)
    return { data: null, error }
  }
}

/**
 * Get user statistics
 */
export const getUserStats = async () => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      logger.warn('No organization selected for getUserStats')
      return { data: { total: 0, active: 0, inactive: 0, byRole: { submitter: 0, reviewer: 0, approver: 0, store_manager: 0, super_admin: 0 } }, error: null }
    }

    const { data, error } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('org_id', orgId)

    if (error) throw error

    const stats = {
      total: data.length,
      active: data.filter(u => u.is_active).length,
      inactive: data.filter(u => !u.is_active).length,
      byRole: {
        submitter: data.filter(u => u.role === 'submitter').length,
        reviewer: data.filter(u => u.role === 'reviewer').length,
        approver: data.filter(u => u.role === 'approver').length,
        store_manager: data.filter(u => u.role === 'store_manager').length,
        super_admin: data.filter(u => u.role === 'super_admin').length
      }
    }

    return { data: stats, error: null }
  } catch (error) {
    logger.error('Error fetching user stats:', error)
    return { data: null, error }
  }
}

// =====================================================
// USER INVITATION & CREATION
// =====================================================

/**
 * Invite a new user (sends email invitation via Edge Function)
 */
export const inviteUser = async (inviteData) => {
  try {
    const { email, fullName, role, projects } = inviteData

    // Get the current session token
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No active session. Please log in again.')
    }

    // Call the Edge Function to invite user
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: {
        email,
        fullName,
        role,
        projects: projects || []
      }
    })

    // Handle edge function errors - they come in data.error when status is non-2xx
    if (error) {
      logger.error('Edge function error:', error)
      throw new Error(error.message || 'Failed to invite user')
    }

    // Check if the response contains an error (edge function returns JSON with error field)
    if (data?.error) {
      throw new Error(data.error)
    }

    return { data, error: null }
  } catch (error) {
    logger.error('Error inviting user:', error)
    return { data: null, error }
  }
}

/**
 * Resend invitation to an existing user (sends password reset email)
 */
export const resendInvitation = async (userId, email) => {
  try {
    // Get the current session token
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No active session. Please log in again.')
    }

    // Call the Edge Function to resend invitation
    const { data, error } = await supabase.functions.invoke('resend-invitation', {
      body: {
        userId,
        email
      }
    })

    // Handle edge function errors - they come in data.error when status is non-2xx
    if (error) {
      logger.error('Edge function error:', error)
      throw new Error(error.message || 'Failed to resend invitation')
    }

    // Check if the response contains an error (edge function returns JSON with error field)
    if (data?.error) {
      throw new Error(data.error)
    }

    return { data, error: null }
  } catch (error) {
    logger.error('Error resending invitation:', error)
    return { data: null, error }
  }
}

// =====================================================
// UPDATE OPERATIONS
// =====================================================

/**
 * Update user profile
 */
export const updateUser = async (userId, updates) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating user:', error)
    return { data: null, error }
  }
}

/**
 * Update user role
 */
export const updateUserRole = async (userId, newRole) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    const { data, error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating user role:', error)
    return { data: null, error }
  }
}

/**
 * Activate/deactivate user
 */
export const toggleUserStatus = async (userId, isActive) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    const { data, error } = await supabase
      .from('users')
      .update({ is_active: isActive })
      .eq('id', userId)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error toggling user status:', error)
    return { data: null, error }
  }
}

// =====================================================
// PROJECT ASSIGNMENT OPERATIONS
// =====================================================

/**
 * Assign user to a project
 */
export const assignUserToProject = async (userId, projectId, role, assignedBy) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    // Verify project belongs to current organization
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, org_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      throw new Error('Project not found or access denied')
    }

    // Check for cross-org access attempt
    if (project.org_id !== orgId) {
      // Log the security event
      await logCrossOrgAccess({
        resourceType: 'project',
        resourceId: projectId,
        resourceOrgId: project.org_id,
        action: 'assign_user',
        currentOrgId: orgId
      })
      throw new Error('Project not found or access denied')
    }

    const { data, error } = await supabase
      .from('user_project_assignments')
      .insert({
        user_id: userId,
        project_id: projectId,
        role: role,
        assigned_by: assignedBy,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error assigning user to project:', error)
    return { data: null, error }
  }
}

/**
 * Remove user from a project
 */
export const removeUserFromProject = async (assignmentId) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    const { error } = await supabase
      .from('user_project_assignments')
      .delete()
      .eq('id', assignmentId)
      .eq('org_id', orgId)

    if (error) throw error
    return { error: null }
  } catch (error) {
    logger.error('Error removing user from project:', error)
    return { error }
  }
}

/**
 * Update user's project assignment role
 */
export const updateProjectAssignment = async (assignmentId, newRole) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    const { data, error } = await supabase
      .from('user_project_assignments')
      .update({ role: newRole })
      .eq('id', assignmentId)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating project assignment:', error)
    return { data: null, error }
  }
}

/**
 * Assign user to multiple projects at once
 */
export const assignUserToMultipleProjects = async (userId, projectIds, role, assignedBy) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    // Verify all projects belong to current organization
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id')
      .in('id', projectIds)
      .eq('org_id', orgId)

    if (projectsError) throw projectsError

    // Check if all requested projects were found
    if (!projects || projects.length !== projectIds.length) {
      throw new Error('One or more projects not found or access denied')
    }

    const assignments = projectIds.map(projectId => ({
      user_id: userId,
      project_id: projectId,
      role: role,
      assigned_by: assignedBy,
      is_active: true
    }))

    const { data, error } = await supabase
      .from('user_project_assignments')
      .insert(assignments)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error assigning user to projects:', error)
    return { data: null, error }
  }
}

// =====================================================
// DELETE OPERATIONS
// =====================================================

/**
 * Delete a user (soft delete - deactivate)
 */
export const deleteUser = async (userId) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    // Soft delete by deactivating
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', userId)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error deleting user:', error)
    return { data: null, error }
  }
}
