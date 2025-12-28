import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'

/**
 * Get current user profile
 */
export const getCurrentUserProfile = async () => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching user profile:', error)
    return { data: null, error }
  }
}

/**
 * Update user profile
 */
export const updateUserProfile = async (userId, updates) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        full_name: updates.full_name,
        phone: updates.phone,
        department: updates.department,
        avatar_url: updates.avatar_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating user profile:', error)
    return { data: null, error }
  }
}

/**
 * Change user password
 */
export const changePassword = async (newPassword) => {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error changing password:', error)
    return { data: null, error }
  }
}

/**
 * Update user email
 */
export const updateUserEmail = async (newEmail) => {
  try {
    const { data, error } = await supabase.auth.updateUser({
      email: newEmail
    })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating email:', error)
    return { data: null, error }
  }
}

/**
 * Upload user avatar
 */
export const uploadAvatar = async (userId, file) => {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}-${Math.random()}.${fileExt}`
    const filePath = `avatars/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('user-avatars')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('user-avatars')
      .getPublicUrl(filePath)

    return { data: publicUrl, error: null }
  } catch (error) {
    logger.error('Error uploading avatar:', error)
    return { data: null, error }
  }
}

// =====================================================
// User Preferences / Application Settings
// =====================================================

/**
 * Get user preferences
 */
export const getUserPreferences = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select(`
        *,
        default_project:projects(id, code, name),
        default_expense_account:expense_accounts(id, code, name)
      `)
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

    // If no preferences exist, create default ones
    if (!data) {
      const { data: newPrefs, error: createError } = await supabase
        .from('user_preferences')
        .insert([{ user_id: userId }])
        .select()
        .single()

      if (createError) throw createError
      return { data: newPrefs, error: null }
    }

    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching user preferences:', error)
    return { data: null, error }
  }
}

/**
 * Update user preferences
 */
export const updateUserPreferences = async (userId, updates) => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error updating user preferences:', error)
    return { data: null, error }
  }
}
