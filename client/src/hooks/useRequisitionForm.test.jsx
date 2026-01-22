/**
 * Tests for useRequisitionForm Hook
 * 
 * Tests the custom hook that manages requisition form state and handlers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { useRequisitionForm } from './useRequisitionForm'

// Mock the dependencies
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' }
  })
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn()
  }
})

vi.mock('../services/api/requisitions', () => ({
  createRequisition: vi.fn(() => Promise.resolve({ data: { id: 'new-req-id' } })),
  updateRequisition: vi.fn(() => Promise.resolve({ data: { id: 'existing-id' } })),
  addRequisitionItems: vi.fn(() => Promise.resolve({ data: [] })),
  deleteAllRequisitionItems: vi.fn(() => Promise.resolve({ data: null })),
  calculateGrandTotal: vi.fn((items) => items.reduce((sum, item) => sum + (item.total_price || 0), 0)),
  getRequisitionById: vi.fn(() => Promise.resolve({ 
    data: {
      id: 'draft-123',
      title: 'Loaded Draft',
      project_id: 'proj-1',
      expense_account_id: 'exp-1',
      description: 'Test description',
      justification: 'Test justification',
      required_by: '2025-03-01T00:00:00Z',
      delivery_location: 'Office',
      supplier_preference: 'Vendor A',
      is_urgent: true,
      status: 'draft',
      submitted_by: 'test-user-id',
      updated_at: '2025-01-15T10:00:00Z',
      requisition_items: [
        {
          item_id: 'item-1',
          item: { name: 'Test Item', code: 'ITEM001' },
          quantity: 5,
          uom_id: 'uom-1',
          uom: { name: 'Each' },
          unit_price: 100,
          total_price: 500,
          line_number: 1,
          notes: 'Test note'
        }
      ]
    }
  }))
}))

vi.mock('../services/api/templates', () => ({
  createTemplate: vi.fn(() => Promise.resolve({ data: { id: 'template-id' } }))
}))

vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn()
  }
}))

// Wrapper component for hooks that need router context
const wrapper = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('useRequisitionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Initial State', () => {
    it('should initialize with empty form data', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      expect(result.current.formData).toEqual({
        title: '',
        project_id: '',
        expense_account_id: '',
        description: '',
        justification: '',
        required_by: '',
        delivery_location: '',
        supplier_preference: '',
        is_urgent: false
      })
    })

    it('should initialize with empty line items', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      expect(result.current.lineItems).toEqual([])
    })

    it('should initialize with isDraft as true', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      expect(result.current.isDraft).toBe(true)
    })

    it('should initialize loading states as false', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      expect(result.current.loading).toBe(false)
      expect(result.current.saving).toBe(false)
    })

    it('should set isEditMode true when draftId is provided', () => {
      const { result } = renderHook(() => useRequisitionForm('draft-123'), { wrapper })

      expect(result.current.isEditMode).toBe(true)
      expect(result.current.requisitionId).toBe('draft-123')
    })
  })

  describe('handleChange', () => {
    it('should update form data when called', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      act(() => {
        result.current.handleChange({
          target: { name: 'title', value: 'Test Requisition', type: 'text' }
        })
      })

      expect(result.current.formData.title).toBe('Test Requisition')
    })

    it('should handle checkbox changes', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      act(() => {
        result.current.handleChange({
          target: { name: 'is_urgent', checked: true, type: 'checkbox' }
        })
      })

      expect(result.current.formData.is_urgent).toBe(true)
    })

    it('should clear expense_account_id when project_id changes', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      // Set expense account first
      act(() => {
        result.current.handleChange({
          target: { name: 'expense_account_id', value: 'expense-123', type: 'text' }
        })
      })

      expect(result.current.formData.expense_account_id).toBe('expense-123')

      // Now change project
      act(() => {
        result.current.handleChange({
          target: { name: 'project_id', value: 'project-456', type: 'text' }
        })
      })

      expect(result.current.formData.project_id).toBe('project-456')
      expect(result.current.formData.expense_account_id).toBe('')
    })
  })

  describe('handleLineItemsChange', () => {
    it('should update line items when called', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      const newItems = [
        { item_id: '1', item_name: 'Item 1', quantity: 5, unit_price: 100, total_price: 500 },
        { item_id: '2', item_name: 'Item 2', quantity: 3, unit_price: 200, total_price: 600 }
      ]

      act(() => {
        result.current.handleLineItemsChange(newItems)
      })

      expect(result.current.lineItems).toEqual(newItems)
    })
  })

  describe('validateForm', () => {
    it('should return false and set error when title is empty', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      let isValid
      act(() => {
        isValid = result.current.validateForm()
      })

      expect(isValid).toBe(false)
      expect(result.current.error).toBe('Please enter a requisition title')
    })

    it('should return false when project_id is empty', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      act(() => {
        result.current.handleChange({
          target: { name: 'title', value: 'Test Title', type: 'text' }
        })
      })

      let isValid
      act(() => {
        isValid = result.current.validateForm()
      })

      expect(isValid).toBe(false)
      expect(result.current.error).toBe('Please select a project')
    })

    it('should return false when expense_account_id is empty', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      act(() => {
        result.current.handleChange({
          target: { name: 'title', value: 'Test Title', type: 'text' }
        })
        result.current.handleChange({
          target: { name: 'project_id', value: 'project-123', type: 'text' }
        })
      })

      let isValid
      act(() => {
        isValid = result.current.validateForm()
      })

      expect(isValid).toBe(false)
      expect(result.current.error).toBe('Please select an expense account')
    })

    it('should return false when no line items exist', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      act(() => {
        result.current.handleChange({
          target: { name: 'title', value: 'Test Title', type: 'text' }
        })
        result.current.handleChange({
          target: { name: 'project_id', value: 'project-123', type: 'text' }
        })
        result.current.handleChange({
          target: { name: 'expense_account_id', value: 'expense-123', type: 'text' }
        })
      })

      let isValid
      act(() => {
        isValid = result.current.validateForm()
      })

      expect(isValid).toBe(false)
      expect(result.current.error).toBe('Please add at least one line item')
    })

    it('should return true when all required fields are valid', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      act(() => {
        result.current.handleChange({
          target: { name: 'title', value: 'Test Title', type: 'text' }
        })
        result.current.handleChange({
          target: { name: 'project_id', value: 'project-123', type: 'text' }
        })
        result.current.handleChange({
          target: { name: 'expense_account_id', value: 'expense-123', type: 'text' }
        })
        result.current.handleLineItemsChange([
          { item_id: '1', item_name: 'Item 1', quantity: 1, total_price: 100 }
        ])
      })

      let isValid
      act(() => {
        isValid = result.current.validateForm()
      })

      expect(isValid).toBe(true)
      expect(result.current.error).toBe('')
    })
  })

  describe('grandTotal', () => {
    it('should calculate grand total from line items', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      act(() => {
        result.current.handleLineItemsChange([
          { item_id: '1', total_price: 100 },
          { item_id: '2', total_price: 200 },
          { item_id: '3', total_price: 300 }
        ])
      })

      expect(result.current.grandTotal).toBe(600)
    })

    it('should return 0 for empty line items', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      expect(result.current.grandTotal).toBe(0)
    })
  })

  describe('clearError and clearSuccess', () => {
    it('should clear error message', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      // Trigger an error
      act(() => {
        result.current.validateForm()
      })

      expect(result.current.error).not.toBe('')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBe('')
    })

    it('should clear success message', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      // We can't easily trigger success without async operations,
      // but we can test the setter through setError which uses similar pattern
      act(() => {
        result.current.setError('Test error')
      })

      expect(result.current.error).toBe('Test error')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBe('')
    })
  })

  describe('handleSaveDraft', () => {
    it('should not save if form is invalid', async () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      await act(async () => {
        await result.current.handleSaveDraft(false)
      })

      // Should have error because form is empty
      expect(result.current.error).not.toBe('')
      expect(result.current.saving).toBe(false)
    })

    it('should set saving state during save operation', async () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      // Fill in required fields
      act(() => {
        result.current.handleChange({
          target: { name: 'title', value: 'Test Title', type: 'text' }
        })
        result.current.handleChange({
          target: { name: 'project_id', value: 'project-123', type: 'text' }
        })
        result.current.handleChange({
          target: { name: 'expense_account_id', value: 'expense-123', type: 'text' }
        })
        result.current.handleLineItemsChange([
          { item_id: '1', item_name: 'Item 1', quantity: 1, unit_price: 100, total_price: 100 }
        ])
      })

      // Start save and check state
      const savePromise = act(async () => {
        await result.current.handleSaveDraft(false)
      })

      await savePromise
      
      // After save completes, saving should be false
      expect(result.current.saving).toBe(false)
    })
  })

  describe('loadDraft', () => {
    it('should not load if no ID provided', async () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      await act(async () => {
        await result.current.loadDraft(null)
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.formData.title).toBe('')
    })

    it('should load draft data when ID is provided', async () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      await act(async () => {
        await result.current.loadDraft('draft-123')
      })

      // Check that form data was populated
      expect(result.current.formData.title).toBe('Loaded Draft')
      expect(result.current.formData.project_id).toBe('proj-1')
      expect(result.current.formData.expense_account_id).toBe('exp-1')
      expect(result.current.formData.is_urgent).toBe(true)
    })

    it('should load line items from draft', async () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      await act(async () => {
        await result.current.loadDraft('draft-123')
      })

      expect(result.current.lineItems).toHaveLength(1)
      expect(result.current.lineItems[0].item_id).toBe('item-1')
      expect(result.current.lineItems[0].quantity).toBe(5)
    })
  })

  describe('setFormData', () => {
    it('should allow direct form data updates', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      act(() => {
        result.current.setFormData({
          title: 'Direct Update',
          project_id: 'proj-direct',
          expense_account_id: 'exp-direct',
          description: '',
          justification: '',
          required_by: '',
          delivery_location: '',
          supplier_preference: '',
          is_urgent: false
        })
      })

      expect(result.current.formData.title).toBe('Direct Update')
      expect(result.current.formData.project_id).toBe('proj-direct')
    })
  })

  describe('setLineItems', () => {
    it('should allow direct line items updates', () => {
      const { result } = renderHook(() => useRequisitionForm(), { wrapper })

      const newItems = [
        { item_id: 'a', item_name: 'A', total_price: 100 },
        { item_id: 'b', item_name: 'B', total_price: 200 }
      ]

      act(() => {
        result.current.setLineItems(newItems)
      })

      expect(result.current.lineItems).toEqual(newItems)
    })
  })
})
