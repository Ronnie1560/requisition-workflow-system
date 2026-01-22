/**
 * API Error Handler Utility
 * 
 * Provides centralized error handling for API calls,
 * including automatic logout on authentication errors (401/403).
 */
import { triggerGlobalLogout } from '../context/AuthContext'
import { logger } from './logger'

/**
 * HTTP status codes that indicate authentication failure
 */
const AUTH_ERROR_CODES = [401, 403]

/**
 * Supabase error codes that indicate authentication failure
 */
const SUPABASE_AUTH_ERROR_CODES = [
  'PGRST301', // JWT expired
  'PGRST302', // JWT invalid
  'invalid_token',
  'token_expired',
  'session_expired'
]

/**
 * Check if an error indicates an authentication failure
 * @param {Error|Object} error - The error to check
 * @returns {boolean} True if this is an auth error
 */
export const isAuthError = (error) => {
  if (!error) return false

  // Check HTTP status
  if (error.status && AUTH_ERROR_CODES.includes(error.status)) {
    return true
  }

  // Check Supabase error code
  if (error.code && SUPABASE_AUTH_ERROR_CODES.includes(error.code)) {
    return true
  }

  // Check error message
  const message = error.message?.toLowerCase() || ''
  if (
    message.includes('jwt expired') ||
    message.includes('jwt invalid') ||
    message.includes('not authenticated') ||
    message.includes('session expired') ||
    message.includes('invalid token')
  ) {
    return true
  }

  return false
}

/**
 * Handle API errors with automatic logout on auth failures
 * @param {Error|Object} error - The error to handle
 * @param {string} context - Description of what operation failed
 * @returns {Object} Normalized error object
 */
export const handleApiError = (error, context = 'API call') => {
  logger.error(`${context} failed:`, error)

  // Check for auth errors and trigger logout
  if (isAuthError(error)) {
    logger.warn(`Authentication error detected during ${context} - triggering logout`)
    triggerGlobalLogout()
    return {
      message: 'Your session has expired. Please sign in again.',
      isAuthError: true,
      originalError: error
    }
  }

  // Return normalized error
  return {
    message: error.message || 'An unexpected error occurred',
    isAuthError: false,
    originalError: error
  }
}

/**
 * Wrapper for async API calls that handles auth errors
 * @param {Function} apiCall - Async function to execute
 * @param {string} context - Description for logging
 * @returns {Promise<{data: any, error: Object|null}>}
 */
export const safeApiCall = async (apiCall, context = 'API call') => {
  try {
    const result = await apiCall()
    
    // Check if result contains an error (Supabase style)
    if (result?.error) {
      const handled = handleApiError(result.error, context)
      return { data: null, error: handled }
    }
    
    return result
  } catch (error) {
    const handled = handleApiError(error, context)
    return { data: null, error: handled }
  }
}

export default {
  isAuthError,
  handleApiError,
  safeApiCall
}
