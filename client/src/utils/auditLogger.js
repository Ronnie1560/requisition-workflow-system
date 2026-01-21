/**
 * Security Audit Logger
 *
 * Logs security events to the database for monitoring and compliance.
 * Used to track cross-org access attempts, authentication failures, etc.
 */

import { supabase } from '../lib/supabase'
import { logger } from './logger'

/**
 * Log a cross-organization access attempt
 *
 * @param {object} params - Audit log parameters
 * @param {string} params.resourceType - Type of resource (e.g., 'requisition', 'project')
 * @param {string} params.resourceId - UUID of the resource
 * @param {string} params.resourceOrgId - Organization ID that owns the resource
 * @param {string} params.action - Action attempted (e.g., 'update', 'delete', 'read')
 * @param {string} params.currentOrgId - Current user's organization ID
 * @returns {Promise<void>}
 */
export const logCrossOrgAccess = async ({
  resourceType,
  resourceId,
  resourceOrgId,
  action,
  currentOrgId
}) => {
  try {
    // Call the database function to log the event
    const { error } = await supabase.rpc('log_cross_org_access', {
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_resource_org_id: resourceOrgId,
      p_action: action
    })

    if (error) {
      // Don't throw - audit logging should not break the application
      logger.error('Failed to log cross-org access attempt', error)
    } else {
      logger.warn('Cross-org access attempt logged', {
        resourceType,
        resourceId,
        resourceOrgId,
        currentOrgId,
        action
      })
    }
  } catch (err) {
    // Silent failure - audit logging should not break the application
    logger.error('Exception in audit logger', err)
  }
}

/**
 * Log a generic security event
 *
 * @param {object} params - Audit log parameters
 * @param {string} params.eventType - Type of event (e.g., 'cross_org_access_attempt')
 * @param {string} params.severity - Severity level ('info', 'warning', 'critical')
 * @param {string} params.message - Human-readable message
 * @param {string} params.currentOrgId - Current organization ID (optional)
 * @param {string} params.targetOrgId - Target organization ID (optional)
 * @param {string} params.resourceType - Resource type (optional)
 * @param {string} params.resourceId - Resource ID (optional)
 * @param {string} params.action - Action attempted (optional)
 * @param {boolean} params.wasBlocked - Whether the action was blocked (default: true)
 * @param {object} params.details - Additional details (optional)
 * @returns {Promise<void>}
 */
export const logSecurityEvent = async ({
  eventType,
  severity = 'warning',
  message,
  currentOrgId = null,
  targetOrgId = null,
  resourceType = null,
  resourceId = null,
  action = null,
  wasBlocked = true,
  details = null
}) => {
  try {
    const { error } = await supabase.rpc('log_security_event', {
      p_event_type: eventType,
      p_severity: severity,
      p_message: message,
      p_current_org_id: currentOrgId,
      p_target_org_id: targetOrgId,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_action_attempted: action,
      p_was_blocked: wasBlocked,
      p_details: details ? JSON.stringify(details) : null
    })

    if (error) {
      logger.error('Failed to log security event', error)
    } else {
      logger.info('Security event logged', { eventType, severity })
    }
  } catch (err) {
    logger.error('Exception in security event logger', err)
  }
}

/**
 * Get recent security events for the current organization
 * Only accessible to org owners
 *
 * @param {number} limit - Maximum number of events to retrieve (default: 100)
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const getSecurityEvents = async (limit = 100) => {
  try {
    const { data, error } = await supabase
      .from('security_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    return { data, error }
  } catch (err) {
    logger.error('Failed to fetch security events', err)
    return { data: null, error: err }
  }
}

/**
 * Get critical security events from the last 7 days
 * Only accessible to org owners
 *
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const getCriticalEvents = async () => {
  try {
    const { data, error } = await supabase
      .from('recent_critical_events')
      .select('*')

    return { data, error }
  } catch (err) {
    logger.error('Failed to fetch critical events', err)
    return { data: null, error: err }
  }
}

/**
 * Get cross-org access attempts summary by user
 * Only accessible to org owners
 *
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const getCrossOrgAttemptsSummary = async () => {
  try {
    const { data, error } = await supabase
      .from('cross_org_attempts_by_user')
      .select('*')

    return { data, error }
  } catch (err) {
    logger.error('Failed to fetch cross-org attempts summary', err)
    return { data: null, error: err }
  }
}
