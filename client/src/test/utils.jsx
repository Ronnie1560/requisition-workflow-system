/**
 * Test Utilities and Helper Functions
 * PCM Requisition System
 * 
 * Provides common utilities for testing React components
 */

import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import { NotificationProvider } from '../../context/NotificationContext'
import { vi } from 'vitest'

/**
 * Custom render function that wraps components with all necessary providers
 * 
 * @param {React.ReactElement} ui - The component to render
 * @param {Object} options - Additional render options
 * @returns {Object} - render result with additional utilities
 */
export function renderWithProviders(ui, options = {}) {
  const {
    route = '/',
    authState = { user: null, profile: null, loading: false },
    ...renderOptions
  } = options

  // Set up the router path
  window.history.pushState({}, 'Test page', route)

  function AllProviders({ children }) {
    return (
      <BrowserRouter>
        <AuthProvider testAuth={authState}>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    )
  }

  return {
    ...render(ui, { wrapper: AllProviders, ...renderOptions }),
  }
}

/**
 * Render with just Router (no auth context)
 */
export function renderWithRouter(ui, { route = '/' } = {}) {
  window.history.pushState({}, 'Test page', route)
  return render(ui, { wrapper: BrowserRouter })
}

/**
 * Create a mock function that resolves with success
 */
export function mockSuccess(data) {
  return vi.fn().mockResolvedValue({ data, error: null })
}

/**
 * Create a mock function that resolves with error
 */
export function mockError(message = 'Something went wrong') {
  return vi.fn().mockResolvedValue({ data: null, error: new Error(message) })
}

/**
 * Wait for all pending promises to resolve
 */
export function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * Create a mock event object
 */
export function createMockEvent(overrides = {}) {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target: { value: '' },
    ...overrides
  }
}

/**
 * Mock data generators
 */
export const generators = {
  /**
   * Generate a mock user
   */
  user: (overrides = {}) => ({
    id: `user-${Date.now()}`,
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'submitter',
    department: 'IT',
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides
  }),

  /**
   * Generate a mock project
   */
  project: (overrides = {}) => ({
    id: `proj-${Date.now()}`,
    code: 'PROJ001',
    name: 'Test Project',
    budget: 100000,
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides
  }),

  /**
   * Generate a mock requisition
   */
  requisition: (overrides = {}) => ({
    id: `req-${Date.now()}`,
    requisition_number: 'REQ-2026-001',
    title: 'Test Requisition',
    description: 'Test description',
    status: 'draft',
    total_amount: 1000,
    submitted_by: 'user-1',
    project_id: 'proj-1',
    created_at: new Date().toISOString(),
    ...overrides
  }),

  /**
   * Generate a mock requisition item
   */
  requisitionItem: (overrides = {}) => ({
    id: `item-${Date.now()}`,
    requisition_id: 'req-1',
    item_description: 'Test Item',
    quantity: 1,
    unit_price: 100,
    total_price: 100,
    ...overrides
  }),

  /**
   * Generate a mock notification
   */
  notification: (overrides = {}) => ({
    id: `notif-${Date.now()}`,
    user_id: 'user-1',
    type: 'requisition_submitted',
    title: 'Test Notification',
    message: 'Test message',
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides
  })
}

// Re-export testing library utilities
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
