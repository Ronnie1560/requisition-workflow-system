import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'
import { getCurrentOrgId } from './orgContext'

/**
 * Items API Service
 * Handles all item and UOM-related database operations
 */

// =====================================================
// UOM TYPES OPERATIONS
// =====================================================

/**
 * Get all UOM types
 */
export const getAllUOMTypes = async () => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    const { data, error } = await supabase
      .from('uom_types')
      .select('*')
      .eq('org_id', orgId) // Filter by current organization
      .eq('is_active', true)
      .order('code', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching UOM types:', error)
    return { data: null, error }
  }
}

/**
 * Create a new UOM type
 */
export const createUOMType = async (uomData) => {
  try {
    const { data, error } = await supabase
      .from('uom_types')
      .insert([uomData])
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error creating UOM type:', error)
    return { data: null, error }
  }
}

// =====================================================
// ITEMS OPERATIONS
// =====================================================

/**
 * Get all items (with optional filters)
 */
export const getAllItems = async (filters = {}) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    // Add timeout to prevent indefinite hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 15000)
    )

    let query = supabase
      .from('items')
      .select(`
        *,
        default_uom:uom_types!default_uom_id(id, code, name),
        category:categories!category_id(id, code, name),
        created_by_user:users!created_by(full_name, email)
      `)
      .eq('org_id', orgId) // Filter by current organization
      .order('code', { ascending: true })

    // Apply filters
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active)
    }

    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id)
    }

    if (filters.search && filters.search.trim()) {
      const searchTerm = `%${filters.search}%`
      query = query.or(`code.ilike.${searchTerm},name.ilike.${searchTerm},description.ilike.${searchTerm}`)
    }

    const { data, error } = await Promise.race([query, timeoutPromise])

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching items:', error)
    return { data: null, error }
  }
}

/**
 * Get item by ID
 */
export const getItemById = async (itemId) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        default_uom:uom_types!default_uom_id(id, code, name),
        category:categories!category_id(id, code, name),
        created_by_user:users!created_by(full_name, email)
      `)
      .eq('id', itemId)
      .eq('org_id', orgId) // Filter by current organization
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching item:', error)
    return { data: null, error }
  }
}

/**
 * Create a new item
 */
export const createItem = async (itemData) => {
  try {
    // Sanitize empty strings to null for optional UUID fields
    const sanitizedData = {
      ...itemData,
      category_id: itemData.category_id || null,
      default_uom_id: itemData.default_uom_id || null,
    }

    // Auto-generate item code if not provided
    let finalItemData = { ...sanitizedData }
    if (!finalItemData.code) {
      const { data: generatedCode, error: codeError } = await supabase
        .rpc('generate_item_code')

      if (codeError) {
        logger.error('Error generating item code:', codeError)
        throw new Error('Failed to generate item code')
      }

      finalItemData.code = generatedCode
    }

    const { data, error } = await supabase
      .from('items')
      .insert([finalItemData])
      .select(`
        *,
        default_uom:uom_types!default_uom_id(id, code, name),
        category:categories!category_id(id, code, name),
        created_by_user:users!created_by(full_name, email)
      `)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error creating item:', error)
    return { data: null, error }
  }
}

/**
 * Update an existing item
 */
export const updateItem = async (itemId, itemData) => {
  try {
    // Sanitize empty strings to null for optional UUID fields
    const sanitizedData = {
      ...itemData,
      category_id: itemData.category_id || null,
      default_uom_id: itemData.default_uom_id || null,
    }

    const { data, error } = await supabase
      .from('items')
      .update(sanitizedData)
      .eq('id', itemId)
      .select(`
        *,
        default_uom:uom_types!default_uom_id(id, code, name),
        category:categories!category_id(id, code, name),
        created_by_user:users!created_by(full_name, email)
      `)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating item:', error)
    return { data: null, error }
  }
}

/**
 * Delete an item (soft delete by setting is_active = false)
 */
export const deleteItem = async (itemId) => {
  try {
    const { data, error } = await supabase
      .from('items')
      .update({ is_active: false })
      .eq('id', itemId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error deleting item:', error)
    return { data: null, error }
  }
}

/**
 * Activate an item
 */
export const activateItem = async (itemId) => {
  try {
    const { data, error } = await supabase
      .from('items')
      .update({ is_active: true })
      .eq('id', itemId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error activating item:', error)
    return { data: null, error }
  }
}

/**
 * Get item usage statistics
 */
export const getItemStats = async (itemId) => {
  try {
    // Get usage count in requisitions
    const { count: requisitionCount, error: reqError } = await supabase
      .from('requisition_items')
      .select('*', { count: 'exact', head: true })
      .eq('item_id', itemId)

    if (reqError) throw reqError

    // Get total quantities and amounts used
    const { data: reqItems, error: itemsError } = await supabase
      .from('requisition_items')
      .select('quantity, total_price')
      .eq('item_id', itemId)

    if (itemsError) throw itemsError

    const totalQuantity = reqItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
    const totalAmount = reqItems?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0

    const stats = {
      requisition_count: requisitionCount || 0,
      total_quantity_used: totalQuantity,
      total_amount_spent: totalAmount
    }

    return { data: stats, error: null }
  } catch (error) {
    logger.error('Error fetching item stats:', error)
    return { data: null, error }
  }
}

/**
 * Get all unique item categories
 */
export const getItemCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('category')
      .not('category', 'is', null)
      .order('category', { ascending: true })

    if (error) throw error

    // Extract unique categories
    const categories = [...new Set(data?.map(item => item.category).filter(Boolean))]

    return { data: categories, error: null }
  } catch (error) {
    logger.error('Error fetching item categories:', error)
    return { data: null, error }
  }
}

// =====================================================
// [REMOVED] ACCOUNT ITEMS OPERATIONS
// The account_items table and project_accounts system was deprecated
// in favor of flexible project-level budgeting.
// See migration: 20241219_cleanup_project_accounts.sql
// =====================================================
