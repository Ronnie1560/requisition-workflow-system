/**
 * ErrorBoundary Tests
 * PCM Requisition System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ErrorBoundary, { SectionErrorBoundary, withErrorBoundary } from './ErrorBoundary'

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

// Mock Sentry to provide predictable eventId
vi.mock('../../lib/sentry.js', () => ({
  captureException: vi.fn(() => 'TEST-ERROR-ID-123')
}))

// Component that throws an error
const ThrowingComponent = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>Normal content</div>
}

// Component that works fine
const WorkingComponent = () => <div>Working content</div>

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('Basic Functionality', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <WorkingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Working content')).toBeInTheDocument()
    })

    it('renders fallback UI when error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('We encountered an unexpected error')).toBeInTheDocument()
    })

    it('shows error ID in fallback UI', async () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      // Wait for async componentDidCatch to set eventId
      await waitFor(() => {
        expect(screen.getByText(/Error ID:/)).toBeInTheDocument()
      })
    })

    it('shows Try Again button', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
    })

    it('shows Go Home button', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByRole('button', { name: /Go Home/i })).toBeInTheDocument()
    })
  })

  describe('Error Recovery', () => {
    it('has Try Again button that can be clicked', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Verify Try Again button exists
      const tryAgainButton = screen.getByRole('button', { name: /Try Again/i })
      expect(tryAgainButton).toBeInTheDocument()

      // Click should not throw
      expect(() => fireEvent.click(tryAgainButton)).not.toThrow()
    })
  })

  describe('Custom Fallback', () => {
    it('renders custom fallback when provided', () => {
      const customFallback = ({ error }) => (
        <div>Custom error: {error.message}</div>
      )

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Custom error: Test error message')).toBeInTheDocument()
    })

    it('passes retry function to custom fallback', () => {
      const customFallback = ({ retry }) => (
        <button onClick={retry}>Custom Retry</button>
      )

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByRole('button', { name: /Custom Retry/i })).toBeInTheDocument()
    })
  })

  describe('Error Callbacks', () => {
    it('calls onError callback when error occurs', async () => {
      const onError = vi.fn()

      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      // Wait for async componentDidCatch to call onError
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({ componentStack: expect.any(String) })
        )
      })
    })
  })

  describe('Technical Details', () => {
    it('shows technical details in development mode', () => {
      render(
        <ErrorBoundary showDetails={true}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Technical Details')).toBeInTheDocument()
    })

    it('expands to show error message when clicked', () => {
      render(
        <ErrorBoundary showDetails={true}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      fireEvent.click(screen.getByText('Technical Details'))

      expect(screen.getByText(/Test error message/)).toBeInTheDocument()
    })
  })
})

describe('SectionErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders children when no error', () => {
    render(
      <SectionErrorBoundary sectionName="Test Section">
        <WorkingComponent />
      </SectionErrorBoundary>
    )

    expect(screen.getByText('Working content')).toBeInTheDocument()
  })

  it('shows section-specific error message', () => {
    render(
      <SectionErrorBoundary sectionName="Dashboard Widget">
        <ThrowingComponent />
      </SectionErrorBoundary>
    )

    expect(screen.getByText(/Error loading Dashboard Widget/)).toBeInTheDocument()
  })

  it('shows generic message when no section name provided', () => {
    render(
      <SectionErrorBoundary>
        <ThrowingComponent />
      </SectionErrorBoundary>
    )

    expect(screen.getByText(/Error loading this section/)).toBeInTheDocument()
  })

  it('has retry button', () => {
    render(
      <SectionErrorBoundary sectionName="Widget">
        <ThrowingComponent />
      </SectionErrorBoundary>
    )

    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
  })
})

describe('withErrorBoundary HOC', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('wraps component with error boundary', () => {
    const WrappedWorking = withErrorBoundary(WorkingComponent)

    render(<WrappedWorking />)

    expect(screen.getByText('Working content')).toBeInTheDocument()
  })

  it('catches errors from wrapped component', () => {
    const WrappedThrowing = withErrorBoundary(ThrowingComponent)

    render(<WrappedThrowing />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('passes props to error boundary', async () => {
    const onError = vi.fn()
    const WrappedThrowing = withErrorBoundary(ThrowingComponent, { onError })

    render(<WrappedThrowing />)

    // Wait for async componentDidCatch
    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
  })

  it('sets correct displayName', () => {
    const WrappedWorking = withErrorBoundary(WorkingComponent)

    expect(WrappedWorking.displayName).toBe('WithErrorBoundary(WorkingComponent)')
  })
})
