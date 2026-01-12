import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/print.css'
import App from './App.jsx'
import { initSentry, captureException, captureMessage } from './lib/sentry.js'
import { logger } from './utils/logger.js'

// Initialize Sentry error monitoring (only in production with DSN)
initSentry()

// Initialize Web Vitals monitoring (production only)
if (import.meta.env.PROD) {
  import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB, onINP }) => {
    const sendToAnalytics = (metric) => {
      // Log metric
      logger.info(`[Web Vitals] ${metric.name}:`, Math.round(metric.value))

      // Send to Sentry for tracking
      captureMessage(`${metric.name}: ${Math.round(metric.value)}ms`, {
        level: 'info',
        tags: {
          webVital: metric.name,
          rating: metric.rating
        },
        extra: {
          value: metric.value,
          delta: metric.delta,
          id: metric.id,
          navigationType: metric.navigationType
        }
      })
    }

    // Cumulative Layout Shift (should be < 0.1)
    onCLS(sendToAnalytics)
    // First Input Delay (should be < 100ms)
    onFID(sendToAnalytics)
    // First Contentful Paint (should be < 1.8s)
    onFCP(sendToAnalytics)
    // Largest Contentful Paint (should be < 2.5s)
    onLCP(sendToAnalytics)
    // Time to First Byte (should be < 800ms)
    onTTFB(sendToAnalytics)
    // Interaction to Next Paint (should be < 200ms)
    onINP(sendToAnalytics)
  }).catch(err => {
    logger.error('Failed to load web-vitals:', err)
  })
}

// Global error handlers to catch unhandled errors
// These catch errors that escape React error boundaries

// Catch unhandled JavaScript errors
window.addEventListener('error', (event) => {
  logger.error('Uncaught error:', event.error || event.message)

  // Send to Sentry if available
  if (event.error) {
    captureException(event.error, {
      type: 'unhandled-error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    })
  }

  // Prevent default browser error handling
  event.preventDefault()
})

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection:', event.reason)

  // Send to Sentry if available
  const error = event.reason instanceof Error
    ? event.reason
    : new Error(String(event.reason))

  captureException(error, {
    type: 'unhandled-rejection',
    reason: event.reason
  })

  // Prevent default browser error handling
  event.preventDefault()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
