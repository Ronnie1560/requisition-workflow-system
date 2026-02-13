import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'
import { getCurrentOrgId } from './orgContext'

/**
 * Feedback API Service
 * Handles all platform feedback operations for tenant users
 */

// =====================================================
// FEEDBACK OPERATIONS
// =====================================================

/**
 * Get all feedback items (visible to all authenticated users per RLS)
 */
export const getAllFeedback = async () => {
  try {
    const { data, error } = await supabase
      .from('platform_feedback')
      .select('*, votes:platform_feedback_votes(id, user_id)')
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching feedback:', error)
    return { data: null, error }
  }
}

/**
 * Submit new feedback
 */
export const submitFeedback = async ({ title, description, category, priority }) => {
  try {
    const orgId = getCurrentOrgId()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('platform_feedback')
      .insert({
        title,
        description: description || null,
        category: category || 'feature_request',
        priority: priority || 'medium',
        submitted_by: user.id,
        org_id: orgId || null,
      })
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    logger.error('Error submitting feedback:', error)
    return { data: null, error }
  }
}

/**
 * Toggle upvote on a feedback item
 * Returns { voted: true/false } indicating the new state
 */
export const toggleVote = async (feedbackId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if user already voted
    const { data: existing, error: checkError } = await supabase
      .from('platform_feedback_votes')
      .select('id')
      .eq('feedback_id', feedbackId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (checkError) throw checkError

    if (existing) {
      // Remove vote
      const { error: deleteError } = await supabase
        .from('platform_feedback_votes')
        .delete()
        .eq('id', existing.id)
      if (deleteError) throw deleteError

      // Decrement upvotes count
      await supabase.rpc('decrement_feedback_upvotes', { feedback_id: feedbackId })

      return { voted: false, error: null }
    } else {
      // Add vote
      const { error: insertError } = await supabase
        .from('platform_feedback_votes')
        .insert({ feedback_id: feedbackId, user_id: user.id })
      if (insertError) throw insertError

      // Increment upvotes count
      await supabase.rpc('increment_feedback_upvotes', { feedback_id: feedbackId })

      return { voted: true, error: null }
    }
  } catch (error) {
    logger.error('Error toggling vote:', error)
    return { voted: null, error }
  }
}
