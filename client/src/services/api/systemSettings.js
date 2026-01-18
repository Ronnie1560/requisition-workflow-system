import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'

// =====================================================
// Organization Settings
// =====================================================

/**
 * Get organization settings
 * Optimized to select only required fields for better performance
 */
export const getOrganizationSettings = async () => {
  try {
    const { data, error } = await supabase
      .from('organization_settings')
      .select(`
        id,
        organization_name,
        address_line1,
        address_line2,
        city,
        state_province,
        postal_code,
        country,
        phone,
        email,
        website,
        tax_id,
        logo_url
      `)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching organization settings:', error)
    return { data: null, error }
  }
}

/**
 * Update organization settings
 */
export const updateOrganizationSettings = async (updates) => {
  try {
    // First get the current settings to get the ID
    const { data: currentSettings, error: fetchError } = await supabase
      .from('organization_settings')
      .select('id')
      .single()

    if (fetchError) throw fetchError

    // Now update using the ID
    const { data, error } = await supabase
      .from('organization_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSettings.id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating organization settings:', error)
    return { data: null, error }
  }
}

// =====================================================
// Fiscal Year Settings (Organization-Specific)
// =====================================================

/**
 * Get fiscal year settings for the current organization
 */
export const getFiscalYearSettings = async (orgId) => {
  try {
    const { data, error } = await supabase
      .from('fiscal_year_settings')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching fiscal year settings:', error)
    return { data: null, error }
  }
}

/**
 * Create fiscal year settings for an organization
 */
export const createFiscalYearSettings = async (orgId, settings) => {
  try {
    const { data, error } = await supabase
      .from('fiscal_year_settings')
      .insert({
        org_id: orgId,
        fiscal_year_start_month: settings.fiscal_year_start_month,
        fiscal_year_start_day: settings.fiscal_year_start_day,
        current_fiscal_year: settings.current_fiscal_year
      })
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error creating fiscal year settings:', error)
    return { data: null, error }
  }
}

/**
 * Update fiscal year settings for the current organization
 */
export const updateFiscalYearSettings = async (orgId, updates) => {
  try {
    // First get the current settings to get the ID
    const { data: currentSettings, error: fetchError } = await supabase
      .from('fiscal_year_settings')
      .select('id')
      .eq('org_id', orgId)
      .maybeSingle()

    if (fetchError) throw fetchError

    // If settings don't exist, create them
    if (!currentSettings) {
      return await createFiscalYearSettings(orgId, updates)
    }

    // Now update using the ID
    const { data, error } = await supabase
      .from('fiscal_year_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSettings.id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating fiscal year settings:', error)
    return { data: null, error }
  }
}

// =====================================================
// Approval Workflows
// =====================================================

/**
 * Get all approval workflows
 */
export const getApprovalWorkflows = async () => {
  try {
    const { data, error } = await supabase
      .from('approval_workflows')
      .select('*')
      .order('priority', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching approval workflows:', error)
    return { data: null, error }
  }
}

/**
 * Get active approval workflows
 */
export const getActiveApprovalWorkflows = async () => {
  try {
    const { data, error } = await supabase
      .from('approval_workflows')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching active approval workflows:', error)
    return { data: null, error }
  }
}

/**
 * Get workflow for a specific amount
 */
export const getWorkflowForAmount = async (amount) => {
  try {
    const { data, error } = await supabase
      .from('approval_workflows')
      .select('*')
      .eq('is_active', true)
      .gte('amount_threshold_min', 0)
      .or(`amount_threshold_max.is.null,amount_threshold_max.gte.${amount}`)
      .lte('amount_threshold_min', amount)
      .order('priority', { ascending: true })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching workflow for amount:', error)
    return { data: null, error }
  }
}

/**
 * Create approval workflow
 */
export const createApprovalWorkflow = async (workflowData) => {
  try {
    const { data, error } = await supabase
      .from('approval_workflows')
      .insert([workflowData])
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error creating approval workflow:', error)
    return { data: null, error }
  }
}

/**
 * Update approval workflow
 */
export const updateApprovalWorkflow = async (id, updates) => {
  try {
    const { data, error } = await supabase
      .from('approval_workflows')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating approval workflow:', error)
    return { data: null, error }
  }
}

/**
 * Delete approval workflow
 */
export const deleteApprovalWorkflow = async (id) => {
  try {
    const { error } = await supabase
      .from('approval_workflows')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { error: null }
  } catch (error) {
    logger.error('Error deleting approval workflow:', error)
    return { error }
  }
}

/**
 * Toggle workflow active status
 */
export const toggleWorkflowStatus = async (id, isActive) => {
  try {
    const { data, error } = await supabase
      .from('approval_workflows')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error toggling workflow status:', error)
    return { data: null, error }
  }
}

// =====================================================
// Item Code Settings
// =====================================================

/**
 * Get item code settings
 */
export const getItemCodeSettings = async () => {
  try {
    const { data, error } = await supabase
      .from('organization_settings')
      .select('item_code_prefix, item_code_next_number, item_code_padding')
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching item code settings:', error)
    return { data: null, error }
  }
}

/**
 * Update item code settings
 */
export const updateItemCodeSettings = async (settings) => {
  try {
    const { data: currentSettings, error: fetchError } = await supabase
      .from('organization_settings')
      .select('id')
      .single()

    if (fetchError) throw fetchError

    const { data, error } = await supabase
      .from('organization_settings')
      .update({
        ...settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSettings.id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating item code settings:', error)
    return { data: null, error }
  }
}
