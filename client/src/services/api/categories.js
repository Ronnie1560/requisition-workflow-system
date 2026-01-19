import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'
import { getCurrentOrgId } from './orgContext'

/**
 * Categories API Service
 * Handles all category-related database operations
 */

// =====================================================
// CATEGORY OPERATIONS
// =====================================================

/**
 * Get all categories (with optional filters)
 */
export const getAllCategories = async (filters = {}) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    let query = supabase
      .from('categories')
      .select(`
        *,
        created_by_user:users!created_by(full_name, email)
      `)
      .eq('org_id', orgId) // Filter by current organization
      .order('name', { ascending: true })

    // Apply filters
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active)
    }

    if (filters.search && filters.search.trim()) {
      const searchTerm = `%${filters.search}%`
      query = query.or(`code.ilike.${searchTerm},name.ilike.${searchTerm},description.ilike.${searchTerm}`)
    }

    const { data, error } = await query

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching categories:', error)
    return { data: null, error }
  }
}

/**
 * Get active categories only
 */
export const getActiveCategories = async () => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('org_id', orgId) // Filter by current organization
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching active categories:', error)
    return { data: null, error }
  }
}

/**
 * Get category by ID
 */
export const getCategoryById = async (categoryId) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    const { data, error } = await supabase
      .from('categories')
      .select(`
        *,
        created_by_user:users!created_by(full_name, email)
      `)
      .eq('id', categoryId)
      .eq('org_id', orgId) // Filter by current organization
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching category:', error)
    return { data: null, error }
  }
}

/**
 * Create a new category
 */
export const createCategory = async (categoryData) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    const { data, error } = await supabase
      .from('categories')
      .insert([{ ...categoryData, org_id: orgId }])
      .select(`
        *,
        created_by_user:users!created_by(full_name, email)
      `)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error creating category:', error)
    return { data: null, error }
  }
}

/**
 * Update an existing category
 */
export const updateCategory = async (categoryId, categoryData) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    const { data, error } = await supabase
      .from('categories')
      .update({
        ...categoryData,
        updated_at: new Date().toISOString()
      })
      .eq('id', categoryId)
      .eq('org_id', orgId) // Ensure category belongs to current org
      .select(`
        *,
        created_by_user:users!created_by(full_name, email)
      `)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating category:', error)
    return { data: null, error }
  }
}

/**
 * Delete a category (soft delete by setting is_active = false)
 */
export const deleteCategory = async (categoryId) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    const { data, error } = await supabase
      .from('categories')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', categoryId)
      .eq('org_id', orgId) // Ensure category belongs to current org
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error deleting category:', error)
    return { data: null, error }
  }
}

/**
 * Activate a category
 */
export const activateCategory = async (categoryId) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    const { data, error } = await supabase
      .from('categories')
      .update({
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', categoryId)
      .eq('org_id', orgId) // Ensure category belongs to current org
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error activating category:', error)
    return { data: null, error }
  }
}

/**
 * Get category usage statistics
 */
export const getCategoryStats = async (categoryId) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    // Get count of items in this category (filtered by org)
    const { count: itemCount, error: itemError } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId)
      .eq('org_id', orgId)

    if (itemError) throw itemError

    // Get count of active items in this category (filtered by org)
    const { count: activeItemCount, error: activeError } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId)
      .eq('org_id', orgId)
      .eq('is_active', true)

    if (activeError) throw activeError

    const stats = {
      total_items: itemCount || 0,
      active_items: activeItemCount || 0
    }

    return { data: stats, error: null }
  } catch (error) {
    logger.error('Error fetching category stats:', error)
    return { data: null, error }
  }
}

// =====================================================
// ITEM CODE GENERATION
// =====================================================

/**
 * Generate next item code
 */
export const generateItemCode = async () => {
  try {
    const { data, error } = await supabase
      .rpc('generate_item_code')

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error generating item code:', error)
    return { data: null, error }
  }
}

/**
 * Get current item code settings
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
