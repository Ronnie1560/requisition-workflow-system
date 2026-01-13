import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'
import { getCurrentOrgId } from './orgContext'

/**
 * Dashboard API Service
 * Handles fetching dashboard statistics for different roles
 */

/**
 * Get dashboard stats for submitters
 */
export const getSubmitterStats = async (userId) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    // Get requisition counts by status
    const { data: requisitions, error } = await supabase
      .from('requisitions')
      .select('status, total_amount')
      .eq('org_id', orgId) // Filter by current organization
      .eq('submitted_by', userId)

    if (error) throw error

    const stats = {
      total: requisitions.length,
      draft: requisitions.filter(r => r.status === 'draft').length,
      pending: requisitions.filter(r => r.status === 'pending').length,
      under_review: requisitions.filter(r => r.status === 'under_review').length,
      reviewed: requisitions.filter(r => r.status === 'reviewed').length,
      approved: requisitions.filter(r => r.status === 'approved').length,
      rejected: requisitions.filter(r => r.status === 'rejected').length,
      total_amount: requisitions.reduce((sum, r) => sum + (r.total_amount || 0), 0)
    }

    return { data: stats, error: null }
  } catch (error) {
    logger.error('Error fetching submitter stats:', error)
    return { data: null, error }
  }
}

/**
 * Get dashboard stats for reviewers
 */
export const getReviewerStats = async () => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    // Get all requisitions in the org (reviewers can see everything in their org)
    const { data: requisitions, error } = await supabase
      .from('requisitions')
      .select('status, total_amount')
      .eq('org_id', orgId) // Filter by current organization

    if (error) throw error

    const stats = {
      total: requisitions.length,
      pending: requisitions.filter(r => r.status === 'pending').length,
      under_review: requisitions.filter(r => r.status === 'under_review').length,
      reviewed: requisitions.filter(r => r.status === 'reviewed').length,
      approved: requisitions.filter(r => r.status === 'approved').length,
      rejected: requisitions.filter(r => r.status === 'rejected').length,
      awaiting_action: requisitions.filter(r =>
        r.status === 'pending' || r.status === 'under_review'
      ).length,
      total_amount: requisitions.reduce((sum, r) => sum + (r.total_amount || 0), 0)
    }

    return { data: stats, error: null }
  } catch (error) {
    logger.error('Error fetching reviewer stats:', error)
    return { data: null, error }
  }
}

/**
 * Get dashboard stats for approvers
 */
export const getApproverStats = async () => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    // Get requisitions ready for approval + approved/rejected in the org
    const { data: requisitions, error } = await supabase
      .from('requisitions')
      .select('status, total_amount')
      .eq('org_id', orgId) // Filter by current organization
      .in('status', ['reviewed', 'approved', 'rejected'])

    if (error) throw error

    const stats = {
      total: requisitions.length,
      reviewed: requisitions.filter(r => r.status === 'reviewed').length,
      approved: requisitions.filter(r => r.status === 'approved').length,
      rejected: requisitions.filter(r => r.status === 'rejected').length,
      awaiting_approval: requisitions.filter(r => r.status === 'reviewed').length,
      approved_amount: requisitions
        .filter(r => r.status === 'approved')
        .reduce((sum, r) => sum + (r.total_amount || 0), 0),
      total_amount: requisitions.reduce((sum, r) => sum + (r.total_amount || 0), 0)
    }

    return { data: stats, error: null }
  } catch (error) {
    logger.error('Error fetching approver stats:', error)
    return { data: null, error }
  }
}

/**
 * Get dashboard stats for super admins
 */
export const getAdminStats = async () => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    // Get all requisitions in the org
    const { data: requisitions, error: reqError } = await supabase
      .from('requisitions')
      .select('status, total_amount, created_at')
      .eq('org_id', orgId) // Filter by current organization

    if (reqError) throw reqError

    // Get user count in the org
    const { count: userCount, error: userError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId) // Filter by current organization
      .eq('is_active', true)

    if (userError) throw userError

    // Get project count in the org
    const { count: projectCount, error: projectError } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId) // Filter by current organization
      .eq('is_active', true)

    if (projectError) throw projectError

    const stats = {
      total_requisitions: requisitions.length,
      total_users: userCount || 0,
      total_projects: projectCount || 0,
      draft: requisitions.filter(r => r.status === 'draft').length,
      pending: requisitions.filter(r => r.status === 'pending').length,
      under_review: requisitions.filter(r => r.status === 'under_review').length,
      reviewed: requisitions.filter(r => r.status === 'reviewed').length,
      approved: requisitions.filter(r => r.status === 'approved').length,
      rejected: requisitions.filter(r => r.status === 'rejected').length,
      total_amount: requisitions.reduce((sum, r) => sum + (r.total_amount || 0), 0),
      approved_amount: requisitions
        .filter(r => r.status === 'approved')
        .reduce((sum, r) => sum + (r.total_amount || 0), 0)
    }

    return { data: stats, error: null }
  } catch (error) {
    logger.error('Error fetching admin stats:', error)
    return { data: null, error }
  }
}

/**
 * Get recent activity for dashboard
 */
export const getRecentActivity = async (userRole, userId, limit = 5) => {
  try {
    let query = supabase
      .from('requisitions')
      .select(`
        id,
        requisition_number,
        title,
        status,
        total_amount,
        created_at,
        updated_at,
        project:projects(name, code),
        submitted_by_user:users!requisitions_submitted_by_fkey(full_name)
      `)
      .order('updated_at', { ascending: false })
      .limit(limit)

    // Filter based on role
    if (userRole === 'submitter') {
      query = query.eq('submitted_by', userId)
    } else if (userRole === 'reviewer') {
      // Reviewers see all activity
    } else if (userRole === 'approver') {
      query = query.in('status', ['reviewed', 'approved', 'rejected'])
    }
    // Super admin sees all

    const { data, error } = await query

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching recent activity:', error)
    return { data: null, error }
  }
}

/**
 * Get quick action counts based on user role
 */
export const getQuickActionCounts = async (userRole, userId) => {
  try {
    const actions = {}

    if (userRole === 'submitter' || userRole === 'super_admin') {
      // Get draft requisitions count
      const { count: draftCount, error: draftError } = await supabase
        .from('requisitions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'draft')
        .eq('submitted_by', userId)

      if (draftError) throw draftError
      actions.drafts = draftCount || 0
    }

    if (userRole === 'reviewer' || userRole === 'super_admin') {
      // Get pending reviews count
      const { count: pendingCount, error: pendingError } = await supabase
        .from('requisitions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'under_review'])

      if (pendingError) throw pendingError
      actions.pendingReviews = pendingCount || 0
    }

    if (userRole === 'approver' || userRole === 'super_admin') {
      // Get awaiting approval count
      const { count: approvalCount, error: approvalError } = await supabase
        .from('requisitions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'reviewed')

      if (approvalError) throw approvalError
      actions.awaitingApproval = approvalCount || 0
    }

    return { data: actions, error: null }
  } catch (error) {
    logger.error('Error fetching quick action counts:', error)
    return { data: null, error }
  }
}

/**
 * Get dashboard data based on user role
 */
export const getDashboardData = async (userRole, userId) => {
  try {
    let statsPromise

    switch (userRole) {
      case 'submitter':
        statsPromise = getSubmitterStats(userId)
        break
      case 'reviewer':
        statsPromise = getReviewerStats()
        break
      case 'approver':
        statsPromise = getApproverStats()
        break
      case 'super_admin':
        statsPromise = getAdminStats()
        break
      default:
        statsPromise = getSubmitterStats(userId)
    }

    const [statsResult, activityResult, quickActionsResult] = await Promise.all([
      statsPromise,
      getRecentActivity(userRole, userId),
      getQuickActionCounts(userRole, userId)
    ])

    if (statsResult.error || activityResult.error || quickActionsResult.error) {
      throw statsResult.error || activityResult.error || quickActionsResult.error
    }

    return {
      data: {
        stats: statsResult.data,
        recentActivity: activityResult.data,
        quickActions: quickActionsResult.data
      },
      error: null
    }
  } catch (error) {
    logger.error('Error fetching dashboard data:', error)
    return { data: null, error }
  }
}
