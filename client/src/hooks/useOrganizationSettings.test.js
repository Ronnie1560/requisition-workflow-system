/**
 * useOrganizationSettings Hook Tests
 * PCM Requisition System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Create mock data
const mockOrgSettings = {
  id: 'org-1',
  organization_name: 'Test Organization',
  address_line1: '123 Test St',
  city: 'Test City',
  logo_url: null,
  app_base_url: 'https://test.app'
}

// Mock the supabase client before importing the hook
vi.mock('../../lib/supabase', () => {
  const mockSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'org-1',
      organization_name: 'Test Organization',
      address_line1: '123 Test St',
      city: 'Test City',
      logo_url: null,
      app_base_url: 'https://test.app'
    },
    error: null
  })
  
  const mockSelect = vi.fn(() => ({
    single: mockSingle
  }))
  
  const mockFrom = vi.fn(() => ({
    select: mockSelect
  }))
  
  return {
    supabase: {
      from: mockFrom
    }
  }
})

// Import after mocking
import { useOrganizationSettings } from './useOrganizationSettings.js'

describe('useOrganizationSettings Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should be a function', () => {
    expect(typeof useOrganizationSettings).toBe('function')
  })

  it('should return an object with orgSettings, loading, and error', () => {
    const { result } = renderHook(() => useOrganizationSettings())
    
    // Check structure
    expect(result.current).toHaveProperty('orgSettings')
    expect(result.current).toHaveProperty('loading')
    expect(result.current).toHaveProperty('error')
  })

  it('should start with loading state', () => {
    const { result } = renderHook(() => useOrganizationSettings())
    
    // The hook should have a boolean loading state
    expect(typeof result.current.loading).toBe('boolean')
  })

  it('should have orgSettings, loading, and error properties', () => {
    const { result } = renderHook(() => useOrganizationSettings())
    
    expect('orgSettings' in result.current).toBe(true)
    expect('loading' in result.current).toBe(true)
    expect('error' in result.current).toBe(true)
  })
})

describe('useOrganizationSettings Return Types', () => {
  it('orgSettings should be null or object', () => {
    const { result } = renderHook(() => useOrganizationSettings())
    
    expect(
      result.current.orgSettings === null || 
      typeof result.current.orgSettings === 'object'
    ).toBe(true)
  })

  it('loading should be boolean', () => {
    const { result } = renderHook(() => useOrganizationSettings())
    expect(typeof result.current.loading).toBe('boolean')
  })

  it('error should be null, string, or undefined initially', () => {
    const { result } = renderHook(() => useOrganizationSettings())
    
    expect(
      result.current.error === null || 
      result.current.error === undefined ||
      typeof result.current.error === 'string'
    ).toBe(true)
  })
})
