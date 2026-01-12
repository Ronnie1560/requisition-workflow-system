import { supabase, withRetry } from '../../lib/supabase'
import { logger } from '../../utils/logger'

/**
 * Requisitions API Service
 * Handles all requisition-related database operations
 *
 * Note: All API calls use withRetry for automatic retry on network failures
 */

// =====================================================
// FETCH OPERATIONS
// =====================================================

/**
 * Get all requisitions for the current user
 */
export const getUserRequisitions = async (userId, filters = {}) => {
  try {
    const { data, error } = await withRetry(async () => {
      let query = supabase
        .from('requisitions')
        .select(`
          *,
          project:projects(id, code, name, budget, spent_amount),
          expense_account:expense_accounts(id, code, name),
          requisition_items(
            id,
            item_id,
            quantity,
            unit_price,
            total_price,
            item:items(id, code, name),
            uom:uom_types(id, code, name)
          )
        `)
        .eq('submitted_by', userId)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.project_id) {
        query = query.eq('project_id', filters.project_id)
      }

      return await query
    })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching requisitions:', error)
    return { data: null, error }
  }
}

/**
 * Get a single requisition by ID
 */
export const getRequisitionById = async (requisitionId) => {
  try {
    const { data, error } = await supabase
      .from('requisitions')
      .select(`
        *,
        project:projects(id, code, name, budget, spent_amount),
        expense_account:expense_accounts(id, code, name),
        submitted_by_user:users!requisitions_submitted_by_fkey(id, full_name, email, role),
        requisition_items(
          id,
          item_id,
          item_description,
          quantity,
          uom_id,
          unit_price,
          total_price,
          line_number,
          notes,
          item:items(id, code, name, category),
          uom:uom_types(id, code, name)
        ),
        comments(
          id,
          comment_text,
          is_internal,
          created_at,
          user:users(id, full_name, role)
        ),
        attachments(
          id,
          file_name,
          file_path,
          file_size,
          file_type,
          description,
          created_at
        )
      `)
      .eq('id', requisitionId)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching requisition:', error)
    return { data: null, error }
  }
}

/**
 * Get user's assigned projects
 * Super admins see all active projects, regular users see only assigned projects
 */
export const getUserProjects = async (userId, userRole = null) => {
  try {
    // Super admins see ALL active projects
    if (userRole === 'super_admin') {
      const { data, error } = await supabase
        .from('projects')
        .select('id, code, name, budget, is_active')
        .eq('is_active', true)
        .order('code', { ascending: true })

      if (error) throw error
      return { data: data || [], error: null }
    }

    // Regular users see only assigned projects
    const { data, error } = await supabase
      .from('user_project_assignments')
      .select(`
        project:projects(
          id,
          code,
          name,
          budget,
          is_active
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error) throw error

    const projects = data?.map(item => item.project).filter(p => p.is_active) || []
    return { data: projects, error: null }
  } catch (error) {
    logger.error('Error fetching user projects:', error)
    return { data: null, error }
  }
}

/**
 * Get all active expense accounts (for categorization)
 */
export const getAllExpenseAccounts = async () => {
  try {
    const { data, error } = await supabase
      .from('expense_accounts')
      .select('id, code, name, description')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching expense accounts:', error)
    return { data: null, error }
  }
}

/**
 * Get expense breakdown for a project (for visibility/reporting)
 */
export const getProjectExpenseBreakdown = async (projectId) => {
  try {
    const { data, error } = await supabase
      .rpc('get_project_expense_breakdown', { p_project_id: projectId })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching project expense breakdown:', error)
    return { data: null, error }
  }
}


/**
 * Get all active items (for independent item selection)
 */
export const getAllItemsForRequisition = async () => {
  try {
    const { data, error } = await supabase
      .from('items')
      .select(`
        id,
        code,
        name,
        description,
        category,
        default_uom_id,
        uom:uom_types!items_default_uom_id_fkey(id, code, name)
      `)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching all items:', error)
    return { data: null, error }
  }
}

/**
 * Get all UOM types
 */
export const getUomTypes = async () => {
  try {
    const { data, error } = await supabase
      .from('uom_types')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching UOM types:', error)
    return { data: null, error }
  }
}

// =====================================================
// CREATE OPERATIONS
// =====================================================

/**
 * Create a new requisition
 */
export const createRequisition = async (requisitionData) => {
  try {
    const { data, error } = await supabase
      .from('requisitions')
      .insert({
        type: requisitionData.type || 'purchase',
        project_id: requisitionData.project_id,
        expense_account_id: requisitionData.expense_account_id || null,
        title: requisitionData.title,
        description: requisitionData.description || null,
        justification: requisitionData.justification || null,
        required_by: requisitionData.required_by || null,
        delivery_location: requisitionData.delivery_location || null,
        supplier_preference: requisitionData.supplier_preference || null,
        status: requisitionData.status || 'draft',
        submitted_by: requisitionData.submitted_by,
        is_urgent: requisitionData.is_urgent || false
      })
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error creating requisition:', error)
    return { data: null, error }
  }
}

/**
 * Add line items to a requisition
 */
export const addRequisitionItems = async (items) => {
  try {
    const { data, error } = await supabase
      .from('requisition_items')
      .insert(items)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error adding requisition items:', error)
    return { data: null, error }
  }
}

/**
 * Add a comment to a requisition
 */
export const addComment = async (commentData) => {
  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        requisition_id: commentData.requisition_id,
        user_id: commentData.user_id,
        comment_text: commentData.comment_text,
        is_internal: commentData.is_internal || false
      })
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error adding comment:', error)
    return { data: null, error }
  }
}

// =====================================================
// UPDATE OPERATIONS
// =====================================================

/**
 * Update a requisition
 */
export const updateRequisition = async (requisitionId, updates) => {
  try {
    const { data, error } = await supabase
      .from('requisitions')
      .update(updates)
      .eq('id', requisitionId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating requisition:', error)
    return { data: null, error }
  }
}

/**
 * Update a requisition item
 */
export const updateRequisitionItem = async (itemId, updates) => {
  try {
    const { data, error } = await supabase
      .from('requisition_items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating requisition item:', error)
    return { data: null, error }
  }
}

/**
 * Submit a requisition for review
 */
export const submitRequisition = async (requisitionId) => {
  try {
    const { data, error } = await supabase
      .from('requisitions')
      .update({
        status: 'pending',
        submitted_at: new Date().toISOString()
      })
      .eq('id', requisitionId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error submitting requisition:', error)
    return { data: null, error }
  }
}

/**
 * Start reviewing a requisition (pending → under_review)
 */
export const startReview = async (requisitionId, userId) => {
  try {
    const { data, error } = await supabase
      .from('requisitions')
      .update({
        status: 'under_review'
      })
      .eq('id', requisitionId)
      .select()
      .single()

    if (error) throw error

    // Add comment
    await addComment({
      requisition_id: requisitionId,
      user_id: userId,
      comment_text: 'Started review',
      is_internal: true
    })

    return { data, error: null }
  } catch (error) {
    logger.error('Error starting review:', error)
    return { data: null, error }
  }
}

/**
 * Mark requisition as reviewed (under_review → reviewed)
 */
export const markAsReviewed = async (requisitionId, userId, comments = '') => {
  try {
    const { data, error } = await supabase
      .from('requisitions')
      .update({
        status: 'reviewed',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requisitionId)
      .select()
      .single()

    if (error) throw error

    // Add review comment
    if (comments) {
      await addComment({
        requisition_id: requisitionId,
        user_id: userId,
        comment_text: `Reviewed: ${comments}`,
        is_internal: false
      })
    } else {
      await addComment({
        requisition_id: requisitionId,
        user_id: userId,
        comment_text: 'Marked as reviewed',
        is_internal: true
      })
    }

    return { data, error: null }
  } catch (error) {
    logger.error('Error marking as reviewed:', error)
    return { data: null, error }
  }
}

/**
 * Approve a requisition (reviewed → approved)
 */
export const approveRequisition = async (requisitionId, userId, comments = '') => {
  try {
    // Update requisition status
    const { data, error } = await supabase
      .from('requisitions')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString()
      })
      .eq('id', requisitionId)
      .select()
      .single()

    if (error) throw error

    // Add approval comment if provided
    if (comments) {
      await addComment({
        requisition_id: requisitionId,
        user_id: userId,
        comment_text: `Approved: ${comments}`,
        is_internal: false
      })
    }

    return { data, error: null }
  } catch (error) {
    logger.error('Error approving requisition:', error)
    return { data: null, error }
  }
}

/**
 * Reject a requisition
 */
export const rejectRequisition = async (requisitionId, userId, reason) => {
  try {
    // Update requisition status AND save rejection reason
    const { data, error } = await supabase
      .from('requisitions')
      .update({
        status: 'rejected',
        rejection_reason: reason || null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requisitionId)
      .select()
      .single()

    if (error) throw error

    // Add rejection comment
    if (reason) {
      await addComment({
        requisition_id: requisitionId,
        user_id: userId,
        comment_text: `Rejected: ${reason}`,
        is_internal: false
      })
    }

    return { data, error: null }
  } catch (error) {
    logger.error('Error rejecting requisition:', error)
    return { data: null, error }
  }
}

/**
 * Get requisitions for review/approval based on user role
 */
export const getRequisitionsForReview = async (userId, userRole, filters = {}) => {
  try {
    let query = supabase
      .from('requisitions')
      .select(`
        *,
        project:projects(id, code, name, budget, spent_amount),
        expense_account:expense_accounts(id, code, name),
        submitted_by_user:users!requisitions_submitted_by_fkey(id, full_name, email),
        reviewed_by_user:users!requisitions_reviewed_by_fkey(id, full_name, email),
        requisition_items(count)
      `)
      .order('created_at', { ascending: false })

    // Filter based on role
    if (userRole === 'reviewer') {
      // Reviewers see ALL statuses (for history)
      // No status filter - they see everything
    } else if (userRole === 'approver') {
      query = query.in('status', ['reviewed', 'approved', 'rejected'])
    } else if (userRole === 'super_admin') {
      // Super admin can see all
    } else {
      // Regular submitters see their own
      query = query.eq('submitted_by', userId)
    }

    // Apply additional filters
    if (filters.status) {
      // Handle comma-separated status values (e.g., "pending,under_review")
      const statuses = filters.status.split(',').map(s => s.trim())
      if (statuses.length > 1) {
        query = query.in('status', statuses)
      } else {
        query = query.eq('status', filters.status)
      }
    }
    if (filters.project_id) {
      query = query.eq('project_id', filters.project_id)
    }

    const { data, error } = await query

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching requisitions for review:', error)
    return { data: null, error }
  }
}

// =====================================================
// DELETE OPERATIONS
// =====================================================

/**
 * Delete a requisition item
 */
export const deleteRequisitionItem = async (itemId) => {
  try {
    const { error } = await supabase
      .from('requisition_items')
      .delete()
      .eq('id', itemId)

    if (error) throw error
    return { error: null }
  } catch (error) {
    logger.error('Error deleting requisition item:', error)
    return { error }
  }
}

/**
 * Delete all items for a requisition
 */
export const deleteAllRequisitionItems = async (requisitionId) => {
  try {
    const { error } = await supabase
      .from('requisition_items')
      .delete()
      .eq('requisition_id', requisitionId)

    if (error) throw error
    return { error: null }
  } catch (error) {
    logger.error('Error deleting requisition items:', error)
    return { error }
  }
}

/**
 * Delete a draft requisition
 */
export const deleteRequisition = async (requisitionId) => {
  try {
    const { error } = await supabase
      .from('requisitions')
      .delete()
      .eq('id', requisitionId)
      .eq('status', 'draft') // Can only delete drafts

    if (error) throw error
    return { error: null }
  } catch (error) {
    logger.error('Error deleting requisition:', error)
    return { error }
  }
}

// =====================================================
// FILE OPERATIONS
// =====================================================

/**
 * Upload a file attachment
 */
export const uploadAttachment = async (requisitionId, file) => {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${requisitionId}/${Date.now()}.${fileExt}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('requisition-attachments')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('requisition-attachments')
      .getPublicUrl(fileName)

    // Save to database
    const { data, error } = await supabase
      .from('attachments')
      .insert({
        requisition_id: requisitionId,
        uploaded_by: (await supabase.auth.getUser()).data.user.id,
        file_name: file.name,
        file_path: urlData.publicUrl,
        file_size: file.size,
        file_type: file.type
      })
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error uploading attachment:', error)
    return { data: null, error }
  }
}

/**
 * Delete an attachment
 */
export const deleteAttachment = async (attachmentId, filePath) => {
  try {
    // Delete from storage
    const fileName = filePath.split('/').slice(-2).join('/')
    const { error: storageError } = await supabase.storage
      .from('requisition-attachments')
      .remove([fileName])

    if (storageError) throw storageError

    // Delete from database
    const { error } = await supabase
      .from('attachments')
      .delete()
      .eq('id', attachmentId)

    if (error) throw error
    return { error: null }
  } catch (error) {
    logger.error('Error deleting attachment:', error)
    return { error }
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Calculate price variance
 */
export const calculatePriceVariance = (actualPrice, preferredPrice) => {
  if (!preferredPrice || preferredPrice === 0) return 0
  return ((actualPrice - preferredPrice) / preferredPrice) * 100
}

/**
 * Check if price variance exceeds threshold
 */
export const isPriceVarianceHigh = (actualPrice, preferredPrice, threshold = 10) => {
  const variance = Math.abs(calculatePriceVariance(actualPrice, preferredPrice))
  return variance > threshold
}

/**
 * Calculate requisition grand total
 */
export const calculateGrandTotal = (items) => {
  return items.reduce((sum, item) => sum + (item.total_price || 0), 0)
}

/**
 * Get project budget summary
 */
export const getProjectBudgetSummary = async (projectId) => {
  try {
    const { data, error } = await supabase
      .rpc('get_project_budget_summary_v2', { p_project_id: projectId })

    if (error) throw error
    return { data: data?.[0] || null, error: null }
  } catch (error) {
    logger.error('Error fetching project budget summary:', error)
    return { data: null, error }
  }
}
