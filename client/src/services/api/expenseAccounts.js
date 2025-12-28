import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'

/**
 * Expense Accounts API Service
 * Handles all expense account-related database operations
 */

/**
 * Get all expense accounts (with optional filters)
 */
export const getAllExpenseAccounts = async (filters = {}) => {
  try {
    let query = supabase
      .from('expense_accounts')
      .select(`
        *,
        project:projects(id, code, name, is_active)
      `)
      .order('code', { ascending: true })

    // Apply filters
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active)
    }

    if (filters.project_id) {
      query = query.eq('project_id', filters.project_id)
    }

    if (filters.search) {
      query = query.or(`code.ilike.%${filters.search}%,name.ilike.%${filters.search}%`)
    }

    // Add timeout to prevent indefinite hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 15000)
    )

    const { data, error } = await Promise.race([query, timeoutPromise])

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching expense accounts:', error)
    return { data: null, error }
  }
}

/**
 * Get expense account by ID
 */
export const getExpenseAccountById = async (accountId) => {
  try {
    const { data, error } = await supabase
      .from('expense_accounts')
      .select(`
        *,
        project:projects(id, code, name, description, budget, is_active)
      `)
      .eq('id', accountId)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching expense account:', error)
    return { data: null, error }
  }
}

/**
 * Create a new expense account
 */
export const createExpenseAccount = async (accountData) => {
  try {
    const { data, error } = await supabase
      .from('expense_accounts')
      .insert([accountData])
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error creating expense account:', error)
    return { data: null, error }
  }
}

/**
 * Update an existing expense account
 */
export const updateExpenseAccount = async (accountId, accountData) => {
  try {
    const { data, error } = await supabase
      .from('expense_accounts')
      .update(accountData)
      .eq('id', accountId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating expense account:', error)
    return { data: null, error }
  }
}

/**
 * Delete an expense account (soft delete by setting is_active = false)
 */
export const deleteExpenseAccount = async (accountId) => {
  try {
    const { data, error } = await supabase
      .from('expense_accounts')
      .update({ is_active: false })
      .eq('id', accountId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error deleting expense account:', error)
    return { data: null, error }
  }
}

/**
 * Activate an expense account
 */
export const activateExpenseAccount = async (accountId) => {
  try {
    const { data, error } = await supabase
      .from('expense_accounts')
      .update({ is_active: true })
      .eq('id', accountId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error activating expense account:', error)
    return { data: null, error }
  }
}

/**
 * Get expense account usage statistics
 */
export const getExpenseAccountStats = async (accountId) => {
  try {
    // Get requisitions using this expense account
    const { data: requisitions, error: reqError } = await supabase
      .from('requisitions')
      .select('id, total_amount, status, requisition_items(id)')
      .eq('expense_account_id', accountId)

    if (reqError) throw reqError

    // Calculate totals
    const total_spent = requisitions
      ?.filter(req => req.status === 'approved')
      ?.reduce((sum, req) => sum + (req.total_amount || 0), 0) || 0

    const total_committed = requisitions
      ?.reduce((sum, req) => sum + (req.total_amount || 0), 0) || 0

    const total_items = requisitions
      ?.reduce((sum, req) => sum + (req.requisition_items?.length || 0), 0) || 0

    const stats = {
      total_requisitions: requisitions?.length || 0,
      total_items,
      total_spent,
      total_committed
    }

    return { data: stats, error: null }
  } catch (error) {
    logger.error('Error fetching expense account stats:', error)
    return { data: null, error }
  }
}

// =====================================================
// [REMOVED] PROJECT LINKING OPERATIONS
// The project_accounts table was deprecated in favor of flexible
// project-level budgeting. Expense accounts are now used directly
// on requisitions without needing project-level linking.
// See migration: 20241219_cleanup_project_accounts.sql
// =====================================================
