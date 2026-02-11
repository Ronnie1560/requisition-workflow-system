/**
 * Billing API Service
 * Handles all billing-related API calls (Stripe checkout, portal, usage)
 */
import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

/**
 * Create a Stripe checkout session for upgrading
 * @param {string} priceId - Stripe Price ID
 * @param {string} orgId - Organization ID
 * @param {string} billingInterval - 'monthly' or 'yearly'
 * @returns {Object} { url, sessionId } or error
 */
export const createCheckoutSession = async (priceId, orgId, billingInterval = 'monthly') => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        priceId,
        orgId,
        billingInterval,
        successUrl: `${window.location.origin}/settings/organization?tab=billing&checkout=success`,
        cancelUrl: `${window.location.origin}/settings/organization?tab=billing&checkout=cancelled`,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create checkout session')
    }

    const data = await response.json()
    return { data, error: null }
  } catch (error) {
    logger.error('Error creating checkout session:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Create a Stripe customer portal session for managing subscription
 * @param {string} orgId - Organization ID
 * @returns {Object} { url } or error
 */
export const createPortalSession = async (orgId) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-portal-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        orgId,
        returnUrl: `${window.location.origin}/settings/organization?tab=billing`,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create portal session')
    }

    const data = await response.json()
    return { data, error: null }
  } catch (error) {
    logger.error('Error creating portal session:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Get organization usage stats (users, projects, requisitions this month)
 * @param {string} orgId - Organization ID
 * @returns {Object} { users, projects, requisitions_this_month } or error
 */
export const getOrganizationUsage = async (orgId) => {
  try {
    const { data, error } = await supabase
      .rpc('get_organization_usage', { p_org_id: orgId })

    if (error) throw error

    return { data, error: null }
  } catch (error) {
    logger.error('Error fetching organization usage:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Get billing history for an organization
 * @param {string} orgId - Organization ID
 * @param {number} limit - Max records to return
 * @returns {Object} { data: BillingEvent[] } or error
 */
export const getBillingHistory = async (orgId, limit = 20) => {
  try {
    const { data, error } = await supabase
      .from('billing_history')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return { data: data || [], error: null }
  } catch (error) {
    logger.error('Error fetching billing history:', error)
    return { data: [], error: error.message }
  }
}
