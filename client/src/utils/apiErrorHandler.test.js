/**
 * API Error Handler Utility Tests
 * PCM Requisition System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isAuthError, handleApiError, safeApiCall } from './apiErrorHandler.js'

// Mock logger
vi.mock('./logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

// Mock AuthContext
const mockTriggerGlobalLogout = vi.fn()
vi.mock('../context/AuthContext', () => ({
  triggerGlobalLogout: (...args) => mockTriggerGlobalLogout(...args)
}))

describe('API Error Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =====================================================
  // isAuthError
  // =====================================================

  describe('isAuthError', () => {
    it('returns false for null/undefined', () => {
      expect(isAuthError(null)).toBe(false)
      expect(isAuthError(undefined)).toBe(false)
    })

    it('detects 401 status', () => {
      expect(isAuthError({ status: 401 })).toBe(true)
    })

    it('detects 403 status', () => {
      expect(isAuthError({ status: 403 })).toBe(true)
    })

    it('does not flag non-auth HTTP statuses', () => {
      expect(isAuthError({ status: 400 })).toBe(false)
      expect(isAuthError({ status: 404 })).toBe(false)
      expect(isAuthError({ status: 500 })).toBe(false)
    })

    it('detects Supabase JWT expired code', () => {
      expect(isAuthError({ code: 'PGRST301' })).toBe(true)
    })

    it('detects Supabase JWT invalid code', () => {
      expect(isAuthError({ code: 'PGRST302' })).toBe(true)
    })

    it('detects invalid_token code', () => {
      expect(isAuthError({ code: 'invalid_token' })).toBe(true)
    })

    it('detects token_expired code', () => {
      expect(isAuthError({ code: 'token_expired' })).toBe(true)
    })

    it('detects session_expired code', () => {
      expect(isAuthError({ code: 'session_expired' })).toBe(true)
    })

    it('does not flag non-auth error codes', () => {
      expect(isAuthError({ code: 'PGRST116' })).toBe(false)
      expect(isAuthError({ code: '23505' })).toBe(false)
    })

    it('detects "jwt expired" in message', () => {
      expect(isAuthError({ message: 'JWT expired for user' })).toBe(true)
    })

    it('detects "jwt invalid" in message', () => {
      expect(isAuthError({ message: 'JWT Invalid - check token' })).toBe(true)
    })

    it('detects "not authenticated" in message', () => {
      expect(isAuthError({ message: 'User is not authenticated' })).toBe(true)
    })

    it('detects "session expired" in message', () => {
      expect(isAuthError({ message: 'Session expired, please re-login' })).toBe(true)
    })

    it('detects "invalid token" in message', () => {
      expect(isAuthError({ message: 'Invalid token provided' })).toBe(true)
    })

    it('does not flag non-auth error messages', () => {
      expect(isAuthError({ message: 'duplicate key value' })).toBe(false)
      expect(isAuthError({ message: 'connection timeout' })).toBe(false)
    })

    it('is case insensitive for messages', () => {
      expect(isAuthError({ message: 'JWT EXPIRED' })).toBe(true)
      expect(isAuthError({ message: 'Session Expired' })).toBe(true)
    })
  })

  // =====================================================
  // handleApiError
  // =====================================================

  describe('handleApiError', () => {
    it('triggers logout for auth errors', () => {
      const error = { status: 401, message: 'Unauthorized' }

      const result = handleApiError(error, 'test operation')

      expect(mockTriggerGlobalLogout).toHaveBeenCalled()
      expect(result.isAuthError).toBe(true)
      expect(result.message).toBe('Your session has expired. Please sign in again.')
      expect(result.originalError).toBe(error)
    })

    it('does not trigger logout for non-auth errors', () => {
      const error = { message: 'Network timeout' }

      const result = handleApiError(error, 'test operation')

      expect(mockTriggerGlobalLogout).not.toHaveBeenCalled()
      expect(result.isAuthError).toBe(false)
      expect(result.message).toBe('Network timeout')
      expect(result.originalError).toBe(error)
    })

    it('provides default message when error has none', () => {
      const error = {}

      const result = handleApiError(error)

      expect(result.message).toBe('An unexpected error occurred')
    })

    it('uses default context when none provided', async () => {
      const { logger } = await import('./logger')
      const error = { message: 'test' }

      handleApiError(error)

      expect(logger.error).toHaveBeenCalledWith('API call failed:', error)
    })
  })

  // =====================================================
  // safeApiCall
  // =====================================================

  describe('safeApiCall', () => {
    it('returns data on successful call', async () => {
      const apiCall = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null })

      const result = await safeApiCall(apiCall, 'fetch data')

      expect(result.data).toEqual({ id: 1 })
      expect(result.error).toBeNull()
    })

    it('handles Supabase-style error in result', async () => {
      const supabaseError = { code: 'PGRST301', message: 'JWT expired' }
      const apiCall = vi.fn().mockResolvedValue({ data: null, error: supabaseError })

      const result = await safeApiCall(apiCall, 'fetch data')

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error.isAuthError).toBe(true)
      expect(mockTriggerGlobalLogout).toHaveBeenCalled()
    })

    it('handles thrown exceptions', async () => {
      const apiCall = vi.fn().mockRejectedValue(new Error('Network failure'))

      const result = await safeApiCall(apiCall, 'fetch data')

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error.message).toBe('Network failure')
      expect(result.error.isAuthError).toBe(false)
    })

    it('handles thrown auth exceptions', async () => {
      const apiCall = vi.fn().mockRejectedValue({ status: 401, message: 'Unauthorized' })

      const result = await safeApiCall(apiCall, 'fetch data')

      expect(result.error.isAuthError).toBe(true)
      expect(mockTriggerGlobalLogout).toHaveBeenCalled()
    })

    it('passes through successful results unchanged', async () => {
      const expected = { data: [1, 2, 3], error: null }
      const apiCall = vi.fn().mockResolvedValue(expected)

      const result = await safeApiCall(apiCall)

      expect(result).toBe(expected)
    })
  })
})
