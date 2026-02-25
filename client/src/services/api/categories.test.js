/**
 * Categories API Service Tests
 * PCM Requisition System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getAllCategories,
  getActiveCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  activateCategory,
  getCategoryStats,
  generateItemCode,
  getItemCodeSettings,
  updateItemCodeSettings
} from './categories.js'

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

// Mock orgContext
vi.mock('./orgContext', () => ({
  getCurrentOrgId: vi.fn(() => 'test-org-id')
}))

// Track mock calls
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockOr = vi.fn()
const mockOrder = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()
const mockRpc = vi.fn()

// Mock Supabase
vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      from: (table) => {
        mockFrom(table)

        const createFullChain = () => ({
          select: (...args) => {
            mockSelect(...args)
            return createFullChain()
          },
          eq: (field, value) => {
            mockEq(field, value)
            return createFullChain()
          },
          or: (filter) => {
            mockOr(filter)
            return createFullChain()
          },
          order: (field, opts) => {
            mockOrder(field, opts)
            return createFullChain()
          },
          single: () => mockSingle(),
          then: (resolve) => mockSingle().then(resolve),
          insert: (data) => {
            mockInsert(data)
            return createFullChain()
          },
          update: (data) => {
            mockUpdate(data)
            return createFullChain()
          }
        })

        return createFullChain()
      },
      rpc: (fnName, params) => {
        mockRpc(fnName, params)
        return mockSingle()
      }
    }
  }
})

describe('Categories API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle.mockResolvedValue({ data: null, error: null })
  })

  // =====================================================
  // CATEGORY OPERATIONS
  // =====================================================

  describe('getAllCategories', () => {
    it('fetches all categories for current org', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Electronics', code: 'ELEC' },
        { id: 'cat-2', name: 'Furniture', code: 'FURN' }
      ]
      mockSingle.mockResolvedValue({ data: mockCategories, error: null })

      const result = await getAllCategories()

      expect(mockFrom).toHaveBeenCalledWith('categories')
      expect(mockEq).toHaveBeenCalledWith('org_id', 'test-org-id')
      expect(mockOrder).toHaveBeenCalledWith('name', { ascending: true })
      expect(result.data).toEqual(mockCategories)
      expect(result.error).toBeNull()
    })

    it('applies is_active filter', async () => {
      mockSingle.mockResolvedValue({ data: [], error: null })

      await getAllCategories({ is_active: true })

      expect(mockEq).toHaveBeenCalledWith('is_active', true)
    })

    it('applies search filter', async () => {
      mockSingle.mockResolvedValue({ data: [], error: null })

      await getAllCategories({ search: 'elec' })

      expect(mockOr).toHaveBeenCalledWith('code.ilike.%elec%,name.ilike.%elec%,description.ilike.%elec%')
    })

    it('ignores empty search strings', async () => {
      mockSingle.mockResolvedValue({ data: [], error: null })

      await getAllCategories({ search: '   ' })

      expect(mockOr).not.toHaveBeenCalled()
    })

    it('throws when no org selected', async () => {
      const { getCurrentOrgId } = await import('./orgContext')
      getCurrentOrgId.mockReturnValueOnce(null)

      const result = await getAllCategories()

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })

    it('returns error on failure', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('DB error') })

      const result = await getAllCategories()

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('getActiveCategories', () => {
    it('fetches only active categories', async () => {
      mockSingle.mockResolvedValue({ data: [{ id: 'cat-1', is_active: true }], error: null })

      const result = await getActiveCategories()

      expect(mockFrom).toHaveBeenCalledWith('categories')
      expect(mockEq).toHaveBeenCalledWith('org_id', 'test-org-id')
      expect(mockEq).toHaveBeenCalledWith('is_active', true)
      expect(mockOrder).toHaveBeenCalledWith('name', { ascending: true })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('getCategoryById', () => {
    it('fetches category by ID scoped to org', async () => {
      const mockCat = { id: 'cat-1', name: 'Electronics', org_id: 'test-org-id' }
      mockSingle.mockResolvedValue({ data: mockCat, error: null })

      const result = await getCategoryById('cat-1')

      expect(mockFrom).toHaveBeenCalledWith('categories')
      expect(mockEq).toHaveBeenCalledWith('id', 'cat-1')
      expect(mockEq).toHaveBeenCalledWith('org_id', 'test-org-id')
      expect(result.data).toEqual(mockCat)
    })

    it('returns error when not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('Not found') })

      const result = await getCategoryById('nonexistent')

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('createCategory', () => {
    it('creates category with org_id injected', async () => {
      const categoryData = { name: 'New Category', code: 'NEW', created_by: 'user-1' }
      const created = { id: 'cat-new', ...categoryData, org_id: 'test-org-id' }
      mockSingle.mockResolvedValue({ data: created, error: null })

      const result = await createCategory(categoryData)

      expect(mockFrom).toHaveBeenCalledWith('categories')
      expect(mockInsert).toHaveBeenCalledWith([{ ...categoryData, org_id: 'test-org-id' }])
      expect(result.data).toEqual(created)
      expect(result.error).toBeNull()
    })

    it('returns error on duplicate code', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('duplicate key') })

      const result = await createCategory({ name: 'Test', code: 'EXISTING' })

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('updateCategory', () => {
    it('updates category scoped to org', async () => {
      const updates = { name: 'Updated Category' }
      mockSingle.mockResolvedValue({ data: { id: 'cat-1', ...updates }, error: null })

      const result = await updateCategory('cat-1', updates)

      expect(mockFrom).toHaveBeenCalledWith('categories')
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('id', 'cat-1')
      expect(mockEq).toHaveBeenCalledWith('org_id', 'test-org-id')
      expect(result.data.name).toBe('Updated Category')
    })
  })

  describe('deleteCategory', () => {
    it('soft deletes by setting is_active to false', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'cat-1', is_active: false }, error: null })

      const result = await deleteCategory('cat-1')

      expect(mockUpdate).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('id', 'cat-1')
      expect(mockEq).toHaveBeenCalledWith('org_id', 'test-org-id')
      expect(result.data.is_active).toBe(false)
    })
  })

  describe('activateCategory', () => {
    it('reactivates category by setting is_active to true', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'cat-1', is_active: true }, error: null })

      const result = await activateCategory('cat-1')

      expect(mockUpdate).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('id', 'cat-1')
      expect(mockEq).toHaveBeenCalledWith('org_id', 'test-org-id')
      expect(result.data.is_active).toBe(true)
    })
  })

  // =====================================================
  // CATEGORY STATS
  // =====================================================

  describe('getCategoryStats', () => {
    it('returns item counts for category', async () => {
      // First call: total items count
      mockSingle
        .mockResolvedValueOnce({ count: 10, error: null })
        // Second call: active items count
        .mockResolvedValueOnce({ count: 7, error: null })

      const result = await getCategoryStats('cat-1')

      expect(result.data).toEqual({ total_items: 10, active_items: 7 })
      expect(result.error).toBeNull()
    })

    it('returns zero counts when no items', async () => {
      mockSingle
        .mockResolvedValueOnce({ count: 0, error: null })
        .mockResolvedValueOnce({ count: 0, error: null })

      const result = await getCategoryStats('cat-1')

      expect(result.data).toEqual({ total_items: 0, active_items: 0 })
    })
  })

  // =====================================================
  // ITEM CODE OPERATIONS
  // =====================================================

  describe('generateItemCode', () => {
    it('generates code via RPC', async () => {
      mockSingle.mockResolvedValue({ data: 'ITM-0001', error: null })

      const result = await generateItemCode()

      expect(mockRpc).toHaveBeenCalledWith('generate_item_code', undefined)
      expect(result.data).toBe('ITM-0001')
    })
  })

  describe('getItemCodeSettings', () => {
    it('fetches current item code settings', async () => {
      const settings = { item_code_prefix: 'ITM', item_code_next_number: 1, item_code_padding: 4 }
      mockSingle.mockResolvedValue({ data: settings, error: null })

      const result = await getItemCodeSettings()

      expect(mockFrom).toHaveBeenCalledWith('organization_settings')
      expect(result.data).toEqual(settings)
    })
  })

  describe('updateItemCodeSettings', () => {
    it('updates item code settings', async () => {
      // First call: fetch current settings ID
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'settings-1' }, error: null })
        // Second call: update settings
        .mockResolvedValueOnce({ data: { id: 'settings-1', item_code_prefix: 'PRD' }, error: null })

      const result = await updateItemCodeSettings({ item_code_prefix: 'PRD' })

      expect(result.data.item_code_prefix).toBe('PRD')
    })

    it('returns error when settings not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: new Error('No settings found') })

      const result = await updateItemCodeSettings({ item_code_prefix: 'X' })

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })
})
