/**
 * Retry utility for API calls with exponential backoff
 *
 * Automatically retries failed network requests with intelligent backoff
 * and error classification.
 */

import { logger } from '../utils/logger'

/**
 * Retry configuration
 */
const DEFAULT_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: [
    'Failed to fetch',
    'Network request failed',
    'NetworkError',
    'Load failed',
    'timeout',
    'ECONNABORTED'
  ]
}

/**
 * Check if an error is retryable
 * @param {Error|Object} error - Error to check
 * @returns {boolean} - True if error is retryable
 */
function isRetryableError(error) {
  // Network errors (no response)
  if (!error.status && !error.code) {
    const errorMessage = error.message || String(error)
    return DEFAULT_CONFIG.retryableErrors.some(msg =>
      errorMessage.includes(msg)
    )
  }

  // HTTP status codes
  if (error.status) {
    // Never retry client errors (400-499) except specific cases
    if (error.status >= 400 && error.status < 500) {
      return DEFAULT_CONFIG.retryableStatusCodes.includes(error.status)
    }
    // Retry server errors (500-599)
    return error.status >= 500
  }

  return false
}

/**
 * Calculate delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {number} - Delay in milliseconds
 */
function calculateDelay(attempt, baseDelay = DEFAULT_CONFIG.baseDelay, maxDelay = DEFAULT_CONFIG.maxDelay) {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt)

  // Add jitter (random 0-1000ms) to avoid thundering herd
  const jitter = Math.random() * 1000

  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay)
}

/**
 * Retry wrapper with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} - Result of the function
 */
export async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options }
  let lastError

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await fn()

      // Success - log if we retried
      if (attempt > 0) {
        logger.info(`Request succeeded after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}`)
      }

      return result
    } catch (error) {
      lastError = error

      // Check if we should retry
      const shouldRetry = isRetryableError(error) && attempt < config.maxRetries

      if (!shouldRetry) {
        // Don't retry - throw immediately
        if (attempt === 0) {
          // First attempt failed with non-retryable error
          throw error
        } else {
          // Exhausted retries or non-retryable error
          logger.error(`Request failed after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}:`, error)
          throw error
        }
      }

      // Calculate delay before next retry
      const delay = calculateDelay(attempt, config.baseDelay, config.maxDelay)

      logger.warn(
        `Request failed (attempt ${attempt + 1}/${config.maxRetries + 1}), ` +
        `retrying in ${Math.round(delay)}ms...`,
        error.message || error
      )

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // Should never reach here, but just in case
  throw lastError
}

/**
 * Create a retryable version of a function
 * @param {Function} fn - Function to make retryable
 * @param {Object} options - Retry options
 * @returns {Function} - Retryable function
 */
export function makeRetryable(fn, options = {}) {
  return async (...args) => {
    return withRetry(() => fn(...args), options)
  }
}

/**
 * Batch retry - retry multiple operations with shared retry logic
 * @param {Array<Function>} operations - Array of async functions
 * @param {Object} options - Retry options
 * @returns {Promise<Array>} - Results array
 */
export async function retryBatch(operations, options = {}) {
  return Promise.all(
    operations.map(op => withRetry(op, options))
  )
}

/**
 * Export default config for testing/debugging
 */
export { DEFAULT_CONFIG }
