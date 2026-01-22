/**
 * Custom Hook: useRequisitionForm
 * Manages requisition form state, validation, and submission logic
 * 
 * Extracted from CreateRequisition.jsx to improve testability and reusability
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  createRequisition,
  updateRequisition,
  addRequisitionItems,
  deleteAllRequisitionItems,
  calculateGrandTotal,
  getRequisitionById
} from '../services/api/requisitions'
import { createTemplate } from '../services/api/templates'
import { logger } from '../utils/logger'

/**
 * Initial form state for a new requisition
 */
const INITIAL_FORM_DATA = {
  title: '',
  project_id: '',
  expense_account_id: '',
  description: '',
  justification: '',
  required_by: '',
  delivery_location: '',
  supplier_preference: '',
  is_urgent: false
}

/**
 * Custom hook for managing requisition form state and operations
 * @param {string|null} draftId - Existing draft ID if editing
 * @returns {Object} Form state and handlers
 */
export function useRequisitionForm(draftId = null) {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Form state
  const [formData, setFormData] = useState(INITIAL_FORM_DATA)
  const [lineItems, setLineItems] = useState([])

  // UI state
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [requisitionId, setRequisitionId] = useState(draftId)
  const [isDraft, setIsDraft] = useState(true)
  const [lastSaved, setLastSaved] = useState(null)
  const [isEditMode] = useState(!!draftId)

  // Ref to track if component is mounted
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  /**
   * Validate form fields
   * @returns {boolean} True if valid
   */
  const validateForm = useCallback(() => {
    if (!formData.title.trim()) {
      setError('Please enter a requisition title')
      return false
    }
    if (!formData.project_id) {
      setError('Please select a project')
      return false
    }
    if (!formData.expense_account_id) {
      setError('Please select an expense account')
      return false
    }
    if (lineItems.length === 0) {
      setError('Please add at least one line item')
      return false
    }
    setError('')
    return true
  }, [formData.title, formData.project_id, formData.expense_account_id, lineItems.length])

  /**
   * Handle form field changes
   */
  const handleChange = useCallback((e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    
    setFormData(prev => {
      const updates = { ...prev, [e.target.name]: value }
      
      // Clear expense account when project changes
      if (e.target.name === 'project_id') {
        updates.expense_account_id = ''
      }
      
      return updates
    })
  }, [])

  /**
   * Handle line items changes
   */
  const handleLineItemsChange = useCallback((updatedItems) => {
    setLineItems(updatedItems)
  }, [])

  /**
   * Load existing draft for editing
   */
  const loadDraft = useCallback(async (id) => {
    if (!id) return

    setLoading(true)
    setError('')

    try {
      const { data, error: loadError } = await getRequisitionById(id)

      if (loadError) throw loadError

      if (!data) {
        setError('Draft not found')
        return
      }

      // Check if it's actually a draft and belongs to current user
      if (data.status !== 'draft') {
        setError('This requisition is not a draft and cannot be edited')
        setTimeout(() => navigate('/requisitions'), 2000)
        return
      }

      if (data.submitted_by !== user?.id) {
        setError('You do not have permission to edit this draft')
        setTimeout(() => navigate('/requisitions'), 2000)
        return
      }

      // Load form data
      setFormData({
        title: data.title || '',
        project_id: data.project_id || '',
        expense_account_id: data.expense_account_id || '',
        description: data.description || '',
        justification: data.justification || '',
        required_by: data.required_by ? data.required_by.split('T')[0] : '',
        delivery_location: data.delivery_location || '',
        supplier_preference: data.supplier_preference || '',
        is_urgent: data.is_urgent || false
      })

      // Load line items
      if (data.requisition_items && data.requisition_items.length > 0) {
        const items = data.requisition_items.map(item => ({
          item_id: item.item_id,
          item_name: item.item?.name || '',
          item_code: item.item?.code || '',
          quantity: item.quantity,
          uom_id: item.uom_id,
          uom_name: item.uom?.name || '',
          unit_price: item.unit_price,
          total_price: item.total_price,
          line_number: item.line_number,
          notes: item.notes || ''
        }))
        setLineItems(items)
      }

      setLastSaved(new Date(data.updated_at))
    } catch (err) {
      logger.error('Error loading draft:', err)
      setError(err.message || 'Failed to load draft')
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [navigate, user?.id])

  /**
   * Save requisition as draft
   * @param {boolean} silent - If true, don't show success message
   */
  const handleSaveDraft = useCallback(async (silent = false) => {
    if (!validateForm()) return

    setSaving(true)
    if (!silent) setError('')

    try {
      const requisitionData = {
        ...formData,
        required_by: formData.required_by || null,
        description: formData.description || null,
        justification: formData.justification || null,
        delivery_location: formData.delivery_location || null,
        supplier_preference: formData.supplier_preference || null,
        expense_account_id: formData.expense_account_id || null,
        submitted_by: user?.id,
        status: 'draft',
        total_amount: calculateGrandTotal(lineItems)
      }

      let result
      if (requisitionId) {
        result = await updateRequisition(requisitionId, requisitionData)
      } else {
        result = await createRequisition(requisitionData)
        if (result.data) {
          setRequisitionId(result.data.id)
        }
      }

      if (result.error) throw result.error

      // Save line items
      const reqId = requisitionId || result.data?.id
      if (reqId && lineItems.length > 0) {
        await deleteAllRequisitionItems(reqId)

        const itemsData = lineItems.map(item => ({
          requisition_id: reqId,
          item_id: item.item_id,
          quantity: item.quantity,
          uom_id: item.uom_id,
          unit_price: item.unit_price,
          total_price: item.total_price,
          line_number: item.line_number,
          notes: item.notes || '',
          item_description: item.item_name
        }))

        const itemsResult = await addRequisitionItems(itemsData)
        if (itemsResult.error) {
          logger.error('Error saving line items:', itemsResult.error)
        }
      }

      setLastSaved(new Date())
      if (!silent) {
        setSuccess('Draft saved successfully')
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err) {
      logger.error('Error saving draft:', err)
      if (!silent) {
        setError(err.message || 'Failed to save draft')
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false)
      }
    }
  }, [formData, lineItems, requisitionId, user?.id, validateForm])

  /**
   * Submit requisition for review
   */
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return

    if (!requisitionId) {
      setError('Please save draft first')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { error: submitError } = await updateRequisition(requisitionId, {
        status: 'pending',
        submitted_at: new Date().toISOString()
      })

      if (submitError) throw submitError

      setSuccess('Requisition submitted successfully!')
      setIsDraft(false)

      setTimeout(() => {
        navigate('/requisitions')
      }, 2000)
    } catch (err) {
      logger.error('Error submitting requisition:', err)
      setError(err.message || 'Failed to submit requisition')
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [requisitionId, navigate, validateForm])

  /**
   * Save current requisition as template
   */
  const handleSaveAsTemplate = useCallback(async (templateData) => {
    if (!validateForm()) return

    try {
      const fullTemplateData = {
        template_name: templateData.template_name,
        description: templateData.description,
        type: 'purchase',
        project_id: formData.project_id,
        expense_account_id: formData.expense_account_id,
        title: formData.title,
        requisition_description: formData.description,
        justification: formData.justification,
        delivery_location: formData.delivery_location,
        supplier_preference: formData.supplier_preference,
        created_by: user?.id
      }

      const { error: templateError } = await createTemplate(fullTemplateData, lineItems)

      if (templateError) throw templateError

      setSuccess('Template saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      logger.error('Error saving template:', err)
      throw err
    }
  }, [formData, lineItems, user?.id, validateForm])

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setError('')
  }, [])

  /**
   * Clear success message
   */
  const clearSuccess = useCallback(() => {
    setSuccess('')
  }, [])

  // Calculate grand total
  const grandTotal = calculateGrandTotal(lineItems)

  return {
    // Form state
    formData,
    lineItems,
    
    // UI state
    loading,
    saving,
    error,
    success,
    requisitionId,
    isDraft,
    lastSaved,
    isEditMode,
    grandTotal,
    
    // Handlers
    handleChange,
    handleLineItemsChange,
    handleSaveDraft,
    handleSubmit,
    handleSaveAsTemplate,
    loadDraft,
    validateForm,
    clearError,
    clearSuccess,
    
    // Setters (for external use)
    setFormData,
    setLineItems,
    setError
  }
}

export default useRequisitionForm
