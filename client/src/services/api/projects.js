import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'

/**
 * Projects API Service
 * Handles all project-related database operations
 */

/**
 * Get all projects (with optional filters)
 */
export const getAllProjects = async (filters = {}) => {
  try {
    let query = supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply filters
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active)
    }

    if (filters.search) {
      query = query.or(`code.ilike.%${filters.search}%,name.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching projects:', error)
    return { data: null, error }
  }
}

/**
 * Get project by ID
 */
export const getProjectById = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        created_by_user:users!created_by(full_name, email)
      `)
      .eq('id', projectId)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching project:', error)
    return { data: null, error }
  }
}

/**
 * Create a new project
 */
export const createProject = async (projectData) => {
  try {
    // Create the project
    const { data, error } = await supabase
      .from('projects')
      .insert([projectData])
      .select()
      .single()

    if (error) throw error

    // Automatically assign the creator to the project
    if (data && projectData.created_by) {
      const assignmentResult = await assignUserToProject(data.id, projectData.created_by, 'manager')
      if (assignmentResult.error) {
        logger.warn('Failed to auto-assign creator to project:', assignmentResult.error)
        // Don't throw error - project was created successfully
      }
    }

    return { data, error: null }
  } catch (error) {
    logger.error('Error creating project:', error)
    return { data: null, error }
  }
}

/**
 * Update an existing project
 */
export const updateProject = async (projectId, projectData) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .update(projectData)
      .eq('id', projectId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating project:', error)
    return { data: null, error }
  }
}

/**
 * Delete a project (soft delete by setting is_active = false)
 */
export const deleteProject = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .update({ is_active: false })
      .eq('id', projectId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error deleting project:', error)
    return { data: null, error }
  }
}

/**
 * Activate a project
 */
export const activateProject = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .update({ is_active: true })
      .eq('id', projectId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error activating project:', error)
    return { data: null, error }
  }
}

/**
 * Get project statistics
 */
export const getProjectStats = async (projectId) => {
  try {
    // Get requisition count and total amount
    const { data: requisitions, error: reqError } = await supabase
      .from('requisitions')
      .select('total_amount, status')
      .eq('project_id', projectId)

    if (reqError) throw reqError

    // Get user assignments count
    const { count: userCount, error: userError } = await supabase
      .from('user_project_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('is_active', true)

    if (userError) throw userError

    // Get expense accounts count
    const { count: accountsCount, error: accountsError } = await supabase
      .from('expense_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)

    if (accountsError) throw accountsError

    const stats = {
      total_requisitions: requisitions?.length || 0,
      pending_requisitions: requisitions?.filter(r => r.status === 'pending').length || 0,
      approved_requisitions: requisitions?.filter(r => r.status === 'approved').length || 0,
      total_spent: requisitions
        ?.filter(r => r.status === 'approved')
        ?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0,
      total_committed: requisitions
        ?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0,
      assigned_users: userCount || 0,
      expense_accounts: accountsCount || 0
    }

    return { data: stats, error: null }
  } catch (error) {
    logger.error('Error fetching project stats:', error)
    return { data: null, error }
  }
}

/**
 * Get expense accounts for a project
 */
export const getProjectExpenseAccounts = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('expense_accounts')
      .select('*')
      .eq('project_id', projectId)
      .order('code', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching project expense accounts:', error)
    return { data: null, error }
  }
}

/**
 * Get project team members
 */
export const getProjectTeam = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('user_project_assignments')
      .select(`
        *,
        user:users!user_id(id, full_name, email, role)
      `)
      .eq('project_id', projectId)
      .eq('is_active', true)

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching project team:', error)
    return { data: null, error }
  }
}

/**
 * Assign user to project
 */
export const assignUserToProject = async (projectId, userId, projectRole = 'member') => {
  try {
    const { data, error } = await supabase
      .from('user_project_assignments')
      .insert([{
        project_id: projectId,
        user_id: userId,
        project_role: projectRole,
        is_active: true
      }])
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
 * Remove user from project (soft delete)
 */
export const removeUserFromProject = async (assignmentId) => {
  try {
    const { data, error } = await supabase
      .from('user_project_assignments')
      .update({ is_active: false })
      .eq('id', assignmentId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error removing user from project:', error)
    return { data: null, error }
  }
}
