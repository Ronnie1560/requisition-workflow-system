/**
 * Error Boundary Component
 * PCM Requisition System
 * 
 * Catches JavaScript errors in child components and displays
 * a fallback UI instead of crashing the entire application.
 */

import { Component } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { logger } from '../../utils/logger'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null
    }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error }
  }

  async componentDidCatch(error, errorInfo) {
    // Log the error (this will also send to Sentry in production)
    logger.error('ErrorBoundary caught an error:', error, errorInfo)

    // Also send directly to Sentry with error boundary context
    try {
      const { captureException } = await import('../../lib/sentry.js')
      const eventId = captureException(error, {
        errorInfo,
        errorBoundary: true,
        componentStack: errorInfo.componentStack
      })

      // Store error info for display with Sentry event ID
      this.setState({
        errorInfo,
        eventId: eventId || `ERR-${Date.now()}`
      })
    } catch {
      // Sentry not available, use fallback ID
      this.setState({
        errorInfo,
        eventId: `ERR-${Date.now()}`
      })
    }

    // Call optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null
    })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    const { hasError, error, errorInfo, eventId } = this.state
    const { children, fallback, showDetails } = this.props

    if (hasError) {
      // Custom fallback provided
      if (fallback) {
        return fallback({ error, errorInfo, retry: this.handleRetry })
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-8 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Something went wrong
              </h1>
              <p className="text-red-100">
                We encountered an unexpected error
              </p>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-slate-600 text-center mb-6">
                Don&apos;t worry, your data is safe. You can try refreshing the page
                or going back to the home page.
              </p>

              {/* Error ID for support */}
              {eventId && (
                <div className="bg-slate-100 rounded-lg p-3 mb-6">
                  <p className="text-xs text-slate-500 text-center">
                    Error ID: <code className="font-mono text-slate-700">{eventId}</code>
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={this.handleRetry}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>
              </div>

              {/* Show technical details in development */}
              {showDetails && error && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    Technical Details
                  </summary>
                  <div className="mt-3 bg-slate-900 rounded-lg p-4 overflow-auto max-h-48">
                    <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap">
                      {error.toString()}
                      {errorInfo?.componentStack && (
                        <>
                          {'\n\nComponent Stack:'}
                          {errorInfo.componentStack}
                        </>
                      )}
                    </pre>
                  </div>
                </details>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 text-center">
                If this problem persists, please contact support with the error ID above.
              </p>
            </div>
          </div>
        </div>
      )
    }

    return children
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.func,
  onError: PropTypes.func,
  showDetails: PropTypes.bool
}

ErrorBoundary.defaultProps = {
  fallback: null,
  onError: null,
  showDetails: import.meta.env.MODE === 'development'
}

export default ErrorBoundary

/**
 * Higher-order component to wrap any component with an error boundary
 */
export function withErrorBoundary(WrappedComponent, errorBoundaryProps = {}) {
  const WithErrorBoundary = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundary.displayName = `WithErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`

  return WithErrorBoundary
}

/**
 * Simple error boundary for specific sections
 */
export function SectionErrorBoundary({ children, sectionName }) {
  return (
    <ErrorBoundary
      fallback={({ retry }) => (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <h3 className="font-semibold text-red-900 mb-2">
            Error loading {sectionName || 'this section'}
          </h3>
          <p className="text-sm text-red-700 mb-4">
            Something went wrong while loading this content.
          </p>
          <button
            onClick={retry}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

SectionErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  sectionName: PropTypes.string
}

SectionErrorBoundary.defaultProps = {
  sectionName: null
}
