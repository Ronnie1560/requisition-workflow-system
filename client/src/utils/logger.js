/**
 * Centralized logging utility
 *
 * Prevents console statements in production and provides
 * structured logging with different log levels.
 * Integrates with Sentry for production error tracking.
 *
 * Usage:
 *   import { logger } from '../utils/logger'
 *   logger.error('Something went wrong', error)
 *   logger.warn('This might be a problem')
 *   logger.info('Informational message')
 *   logger.debug('Debug information')
 */

// Lazy import Sentry to avoid circular dependencies
let sentryModule = null
const getSentry = async () => {
  if (!sentryModule) {
    try {
      sentryModule = await import('../lib/sentry.js')
    } catch {
      // Sentry not available, continue without it
      console.warn('Sentry not available for error tracking')
    }
  }
  return sentryModule
}

const isDevelopment = import.meta.env.MODE === 'development'
const isProduction = import.meta.env.MODE === 'production'

/**
 * Log levels
 */
const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
}

/**
 * Format log message with timestamp and level
 */
const formatMessage = (level, message, ...args) => {
  const timestamp = new Date().toISOString()
  const formattedLevel = level.toUpperCase().padEnd(5)
  return [`[${timestamp}] ${formattedLevel}:`, message, ...args]
}

/**
 * Log error message
 * Always logs errors and sends to Sentry in production
 */
const error = (message, ...args) => {
  // Log to console in development
  if (isDevelopment) {
    console.error(...formatMessage(LogLevel.ERROR, message, ...args))
  } else {
    // In production, log simplified message
    console.error(message, ...args)
  }

  // Send to Sentry in production
  if (isProduction) {
    // Extract error object if present
    const errorObj = args.find(arg => arg instanceof Error)
    const additionalContext = args.filter(arg => !(arg instanceof Error))

    // Use dynamic import to avoid initialization issues
    getSentry().then(sentry => {
      if (sentry && sentry.captureException) {
        if (errorObj) {
          // Capture the error with context
          sentry.captureException(errorObj, {
            message,
            extra: additionalContext.length > 0 ? { context: additionalContext } : {}
          })
        } else {
          // No error object, capture as message
          sentry.captureMessage(`${message} ${JSON.stringify(args)}`, 'error')
        }
      }
    }).catch(() => {
      // Sentry not available, already logged to console
    })
  }
}

/**
 * Log warning message
 * Only logs in development
 */
const warn = (message, ...args) => {
  if (isDevelopment) {
    console.warn(...formatMessage(LogLevel.WARN, message, ...args))
  }
}

/**
 * Log info message
 * Only logs in development
 */
const info = (message, ...args) => {
  if (isDevelopment) {
    console.info(...formatMessage(LogLevel.INFO, message, ...args))
  }
}

/**
 * Log debug message
 * Only logs in development
 */
const debug = (message, ...args) => {
  if (isDevelopment) {
    console.log(...formatMessage(LogLevel.DEBUG, message, ...args))
  }
}

/**
 * Log function entry (useful for debugging)
 */
const trace = (functionName, ...args) => {
  if (isDevelopment) {
    console.log(...formatMessage(LogLevel.DEBUG, `→ ${functionName}`, ...args))
  }
}

/**
 * Log function exit (useful for debugging)
 */
const traceEnd = (functionName, result) => {
  if (isDevelopment) {
    console.log(...formatMessage(LogLevel.DEBUG, `← ${functionName}`, result))
  }
}

/**
 * Centralized logger object
 */
export const logger = {
  error,
  warn,
  info,
  debug,
  trace,
  traceEnd
}

/**
 * Export log levels for external use
 */
export { LogLevel }

/**
 * Default export
 */
export default logger
