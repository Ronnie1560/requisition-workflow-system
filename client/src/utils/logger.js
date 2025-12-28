/**
 * Centralized logging utility
 *
 * Prevents console statements in production and provides
 * structured logging with different log levels.
 *
 * Usage:
 *   import { logger } from '../utils/logger'
 *   logger.error('Something went wrong', error)
 *   logger.warn('This might be a problem')
 *   logger.info('Informational message')
 *   logger.debug('Debug information')
 */

const isDevelopment = import.meta.env.MODE === 'development'

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
 * Always logs errors even in production (to external service if configured)
 */
const error = (message, ...args) => {
  // In production, you might want to send to error tracking service
  // e.g., Sentry, LogRocket, etc.
  if (isDevelopment) {
    console.error(...formatMessage(LogLevel.ERROR, message, ...args))
  } else {
    // In production, send to error tracking service
    // For now, still log to console but could be disabled
    console.error(message, ...args)
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
