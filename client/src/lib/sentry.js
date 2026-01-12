import * as Sentry from '@sentry/react'
import { logger } from '../utils/logger'

/**
 * Initialize Sentry error monitoring
 * Only initializes in production with a valid DSN
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  const environment = import.meta.env.MODE
  const release = import.meta.env.VITE_APP_VERSION || '1.0.0'

  // Only initialize if DSN is provided (production)
  if (!dsn) {
    logger.info('[Sentry] No DSN provided, skipping initialization')
    return
  }

  try {
    Sentry.init({
      dsn,
      environment,
      release: `pcm-requisition@${release}`,
      
      // Capture 10% of transactions for performance monitoring
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      
      // Capture 100% of errors
      sampleRate: 1.0,
      
      // Enable session replay for production (sample 10%)
      replaysSessionSampleRate: environment === 'production' ? 0.1 : 0,
      replaysOnErrorSampleRate: 1.0,
      
      // Integrations
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          // Mask all text and inputs for privacy
          maskAllText: true,
          maskAllInputs: true,
        }),
      ],
      
      // Filter out sensitive data
      beforeSend(event) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers['Authorization']
          delete event.request.headers['Cookie']
        }
        
        // Remove user email from breadcrumbs if present
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(crumb => {
            if (crumb.data?.email) {
              crumb.data.email = '[REDACTED]'
            }
            return crumb
          })
        }
        
        return event
      },
      
      // Ignore common non-actionable errors
      ignoreErrors: [
        // Network errors
        'Network request failed',
        'Failed to fetch',
        'NetworkError',
        'Load failed',
        // Browser extensions
        /^chrome-extension:\/\//,
        /^moz-extension:\/\//,
        // User cancelled
        'AbortError',
        'User denied',
      ],
      
      // Additional tags
      initialScope: {
        tags: {
          app: 'pcm-requisition',
        },
      },
    })

    logger.info('[Sentry] Initialized successfully', { environment, release })
  } catch (error) {
    logger.error('[Sentry] Failed to initialize', error)
  }
}

/**
 * Set the current user context for Sentry
 * @param {Object} user - User object with id, email, role
 */
export function setSentryUser(user) {
  if (!user) {
    Sentry.setUser(null)
    return
  }

  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
  })
}

/**
 * Clear the current user context
 */
export function clearSentryUser() {
  Sentry.setUser(null)
}

/**
 * Capture an exception with additional context
 * @param {Error} error - Error to capture
 * @param {Object} context - Additional context
 */
export function captureException(error, context = {}) {
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setExtra(key, value)
    })
    Sentry.captureException(error)
  })
}

/**
 * Capture a message with level
 * @param {string} message - Message to capture
 * @param {string} level - Severity level (info, warning, error)
 */
export function captureMessage(message, level = 'info') {
  Sentry.captureMessage(message, level)
}

/**
 * Add a breadcrumb for debugging
 * @param {Object} breadcrumb - Breadcrumb data
 */
export function addBreadcrumb(breadcrumb) {
  Sentry.addBreadcrumb(breadcrumb)
}

// Export Sentry for direct access if needed
export { Sentry }
