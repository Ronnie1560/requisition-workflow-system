import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'

/**
 * Requisition Templates API Service
 * Handles template CRUD operations
 */

// =====================================================
// FETCH OPERATIONS
// =====================================================

/**
 * Get all templates for the current user
 */
export const getUserTemplates = async (userId, filters = {}) => {
  try {
    let query = supabase
      .from('requisition_templates')
      .select(`
        *,
        project:projects(id, code, name),
        expense_account:expense_accounts(id, code, name),
        template_items:requisition_template_items(count)
      `)
      .eq('created_by', userId)
      .order('created_at', { ascending: false })

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active)
    }

    if (filters.search && filters.search.trim()) {
      const searchTerm = `%${filters.search}%`
      query = query.or(`template_name.ilike.${searchTerm},description.ilike.${searchTerm}`)
    }

    const { data, error } = await query

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching templates:', error)
    return { data: null, error }
  }
}

/**
 * Get a single template by ID with all items
 */
export const getTemplateById = async (templateId) => {
  try {
    const { data, error } = await supabase
      .from('requisition_templates')
      .select(`
        *,
        project:projects(id, code, name),
        expense_account:expense_accounts(id, code, name),
        template_items:requisition_template_items(
          id,
          item_id,
          item_description,
          quantity,
          uom_id,
          unit_price,
          notes,
          line_number,
          item:items(id, code, name),
          uom:uom_types(id, code, name)
        )
      `)
      .eq('id', templateId)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching template:', error)
    return { data: null, error }
  }
}

// =====================================================
// CREATE OPERATIONS
// =====================================================

/**
 * Create a new template
 */
export const createTemplate = async (templateData, items) => {
  try {
    // Create the template
    const { data: template, error: templateError } = await supabase
      .from('requisition_templates')
      .insert({
        template_name: templateData.template_name,
        description: templateData.description,
        type: templateData.type || 'purchase',
        project_id: templateData.project_id,
        expense_account_id: templateData.expense_account_id,
        title: templateData.title,
        requisition_description: templateData.requisition_description,
        justification: templateData.justification,
        delivery_location: templateData.delivery_location,
        supplier_preference: templateData.supplier_preference,
        created_by: templateData.created_by
      })
      .select()
      .single()

    if (templateError) throw templateError

    // Create template items if provided
    if (items && items.length > 0) {
      const templateItems = items.map((item, index) => ({
        template_id: template.id,
        item_id: item.item_id,
        item_description: item.item_description || item.item_name,
        quantity: item.quantity,
        uom_id: item.uom_id,
        unit_price: item.unit_price,
        notes: item.notes,
        line_number: index + 1
      }))

      const { error: itemsError } = await supabase
        .from('requisition_template_items')
        .insert(templateItems)

      if (itemsError) throw itemsError
    }

    return { data: template, error: null }
  } catch (error) {
    logger.error('Error creating template:', error)
    return { data: null, error }
  }
}

/**
 * Create a requisition from a template
 */
export const createRequisitionFromTemplate = async (templateId, userId) => {
  try {
    // Get the template with items
    const { data: template, error: templateError } = await getTemplateById(templateId)

    if (templateError) throw templateError
    if (!template) throw new Error('Template not found')

    // Import the requisition API functions
    const { createRequisition, addRequisitionItems } = await import('./requisitions')

    // Create the requisition
    const requisitionData = {
      type: template.type || 'purchase',
      project_id: template.project_id,
      expense_account_id: template.expense_account_id,
      title: template.title,
      description: template.requisition_description,
      justification: template.justification,
      delivery_location: template.delivery_location,
      supplier_preference: template.supplier_preference,
      status: 'draft',
      submitted_by: userId
    }

    const { data: requisition, error: reqError } = await createRequisition(requisitionData)

    if (reqError) throw reqError

    // Add line items
    if (template.template_items && template.template_items.length > 0) {
      const items = template.template_items.map(item => ({
        requisition_id: requisition.id,
        item_id: item.item_id,
        item_description: item.item_description,
        quantity: item.quantity,
        uom_id: item.uom_id,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
        notes: item.notes,
        line_number: item.line_number
      }))

      const { error: itemsError } = await addRequisitionItems(items)
      if (itemsError) throw itemsError
    }

    return { data: requisition, error: null }
  } catch (error) {
    logger.error('Error creating requisition from template:', error)
    return { data: null, error }
  }
}

// =====================================================
// UPDATE OPERATIONS
// =====================================================

/**
 * Update a template
 */
export const updateTemplate = async (templateId, updates) => {
  try {
    const { data, error } = await supabase
      .from('requisition_templates')
      .update(updates)
      .eq('id', templateId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating template:', error)
    return { data: null, error }
  }
}

// =====================================================
// DELETE OPERATIONS
// =====================================================

/**
 * Delete a template (soft delete by setting is_active = false)
 */
export const deleteTemplate = async (templateId) => {
  try {
    const { error } = await supabase
      .from('requisition_templates')
      .update({ is_active: false })
      .eq('id', templateId)

    if (error) throw error
    return { error: null }
  } catch (error) {
    logger.error('Error deleting template:', error)
    return { error }
  }
}

/**
 * Permanently delete a template
 */
export const permanentlyDeleteTemplate = async (templateId) => {
  try {
    const { error } = await supabase
      .from('requisition_templates')
      .delete()
      .eq('id', templateId)

    if (error) throw error
    return { error: null }
  } catch (error) {
    logger.error('Error permanently deleting template:', error)
    return { error }
  }
}
