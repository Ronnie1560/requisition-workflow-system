import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Save,
  Send,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Loader,
  FileText
} from 'lucide-react'
import {
  createRequisition,
  updateRequisition,
  addRequisitionItems,
  deleteAllRequisitionItems,
  getUserProjects,
  calculateGrandTotal,
  getRequisitionById
} from '../../services/api/requisitions'
import { getAllExpenseAccounts } from '../../services/api/expenseAccounts'
import { createTemplate } from '../../services/api/templates'
import LineItemsTable from '../../components/requisitions/LineItemsTable'
import FileUpload from '../../components/requisitions/FileUpload'
import SaveTemplateModal from '../../components/requisitions/SaveTemplateModal'
import { logger } from '../../utils/logger'

const CreateRequisition = () => {
  const navigate = useNavigate()
  const { id } = useParams() // Get draft ID from URL if editing
  const { user, profile } = useAuth()

  // Form state
  const [formData, setFormData] = useState({
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

  // Line items state
  const [lineItems, setLineItems] = useState([])

  // Dropdowns data
  const [projects, setProjects] = useState([])
  const [expenseAccounts, setExpenseAccounts] = useState([])

  // UI state
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [requisitionId, setRequisitionId] = useState(id || null) // Set from URL if editing
  const [isDraft, setIsDraft] = useState(true)
  const [lastSaved, setLastSaved] = useState(null)
  const [isEditMode, setIsEditMode] = useState(!!id) // Track if we're editing
  const [showTemplateModal, setShowTemplateModal] = useState(false)

  // Load user's projects on mount
  useEffect(() => {
    loadProjects()
  }, [user])

  // Load expense accounts when project changes
  useEffect(() => {
    if (formData.project_id) {
      loadExpenseAccounts(formData.project_id)
    } else {
      setExpenseAccounts([])
    }
  }, [formData.project_id])

  // Load existing draft if editing
  useEffect(() => {
    if (id) {
      loadDraft(id)
    }
  }, [id])

  // Auto-save every 30 seconds
  // Use a ref to always have access to the latest handleSaveDraft
  const handleSaveDraftRef = useCallback(() => {
    handleSaveDraft(true) // Silent save
  }, [requisitionId, isDraft, formData, lineItems, user?.id])

  useEffect(() => {
    if (requisitionId && isDraft && lineItems.length > 0) {
      const interval = setInterval(() => {
        handleSaveDraftRef()
      }, 30000) // 30 seconds

      return () => clearInterval(interval)
    }
  }, [requisitionId, isDraft, lineItems.length, handleSaveDraftRef])

  const loadProjects = async () => {
    const { data, error } = await getUserProjects(user.id, profile?.role)
    if (error) {
      setError('Failed to load projects')
    } else {
      setProjects(data || [])
    }
  }

  const loadExpenseAccounts = async (projectId) => {
    if (!projectId) {
      setExpenseAccounts([])
      return
    }

    const { data, error } = await getAllExpenseAccounts({ project_id: projectId })
    if (error) {
      logger.error('Error loading expense accounts:', error)
      setError('Failed to load expense accounts')
    } else {
      setExpenseAccounts(data || [])
    }
  }

  const loadDraft = async (draftId) => {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await getRequisitionById(draftId)

      if (error) throw error

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

      if (data.submitted_by !== user.id) {
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
        required_by: data.required_by ? data.required_by.split('T')[0] : '', // Format date for input
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
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    const updates = {
      ...formData,
      [e.target.name]: value
    }

    // Clear expense account when project changes
    if (e.target.name === 'project_id') {
      updates.expense_account_id = ''
    }

    setFormData(updates)
  }

  const handleLineItemsChange = (updatedItems) => {
    setLineItems(updatedItems)
  }

  const validateForm = () => {
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
    return true
  }

  const handleSaveDraft = async (silent = false) => {
    if (!validateForm()) {
      return
    }

    setSaving(true)
    if (!silent) setError('')

    try {
      // Sanitize data - convert empty strings to null for optional fields
      const requisitionData = {
        ...formData,
        required_by: formData.required_by || null,
        description: formData.description || null,
        justification: formData.justification || null,
        delivery_location: formData.delivery_location || null,
        supplier_preference: formData.supplier_preference || null,
        expense_account_id: formData.expense_account_id || null,
        submitted_by: user.id,
        status: 'draft',
        total_amount: calculateGrandTotal(lineItems)
      }

      let result
      if (requisitionId) {
        // Update existing draft
        result = await updateRequisition(requisitionId, requisitionData)
      } else {
        // Create new draft
        result = await createRequisition(requisitionData)
        if (result.data) {
          setRequisitionId(result.data.id)
        }
      }

      if (result.error) {
        throw result.error
      }

      // Save line items
      const reqId = requisitionId || result.data?.id
      if (reqId && lineItems.length > 0) {
        // Delete existing items first to avoid duplicates
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
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    if (!requisitionId) {
      setError('Please save draft first')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { error } = await updateRequisition(requisitionId, {
        status: 'pending',
        submitted_at: new Date().toISOString()
      })

      if (error) throw error

      setSuccess('Requisition submitted successfully!')
      setIsDraft(false)

      setTimeout(() => {
        navigate('/requisitions')
      }, 2000)
    } catch (err) {
      logger.error('Error submitting requisition:', err)
      setError(err.message || 'Failed to submit requisition')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAsTemplate = async (templateData) => {
    if (!validateForm()) {
      return
    }

    setError('')

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
        created_by: user.id
      }

      const { data, error } = await createTemplate(fullTemplateData, lineItems)

      if (error) throw error

      setSuccess('Template saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      logger.error('Error saving template:', err)
      throw err
    }
  }

  const grandTotal = calculateGrandTotal(lineItems)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/requisitions')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? 'Edit Draft' : 'Create Requisition'}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {lastSaved && (
                <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTemplateModal(true)}
            disabled={lineItems.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save current requisition as a reusable template"
          >
            <FileText className="w-5 h-5" />
            Save as Template
          </button>
          <button
            onClick={() => handleSaveDraft(false)}
            disabled={saving || !isDraft}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save Draft
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !isDraft || !requisitionId}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            Submit for Review
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-6">
        {/* Basic Information */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Requisition Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="e.g., Office Supplies for Q1 2024"
              />
            </div>

            {/* Project */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project *
              </label>
              <select
                name="project_id"
                value={formData.project_id}
                onChange={handleChange}
                required
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} - {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Expense Account */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expense Account *
              </label>
              <select
                name="expense_account_id"
                value={formData.expense_account_id}
                onChange={handleChange}
                required
                disabled={!formData.project_id}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!formData.project_id
                    ? 'Select a project first...'
                    : expenseAccounts.length === 0
                    ? 'No expense accounts for this project'
                    : 'Select an expense account...'}
                </option>
                {expenseAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {!formData.project_id
                  ? 'Please select a project to see available expense accounts'
                  : 'Only expense accounts linked to the selected project are shown'}
              </p>
            </div>

            {/* Required By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Required By
              </label>
              <input
                type="date"
                name="required_by"
                value={formData.required_by}
                onChange={handleChange}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            {/* Urgent */}
            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_urgent"
                id="is_urgent"
                checked={formData.is_urgent}
                onChange={handleChange}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="is_urgent" className="ml-2 block text-sm text-gray-700">
                Mark as Urgent
              </label>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="Provide details about this requisition..."
              />
            </div>

            {/* Justification */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Justification
              </label>
              <textarea
                name="justification"
                value={formData.justification}
                onChange={handleChange}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="Why is this requisition needed?"
              />
            </div>

            {/* Delivery Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Location
              </label>
              <input
                type="text"
                name="delivery_location"
                value={formData.delivery_location}
                onChange={handleChange}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="e.g., Main Office, Warehouse"
              />
            </div>

            {/* Supplier Preference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Supplier
              </label>
              <input
                type="text"
                name="supplier_preference"
                value={formData.supplier_preference}
                onChange={handleChange}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div>
          <LineItemsTable
            items={lineItems}
            projectAccountId={formData.project_id}
            onChange={handleLineItemsChange}
            disabled={!isDraft}
          />
        </div>

        {/* File Attachments */}
        <div>
          <FileUpload
            requisitionId={requisitionId}
            disabled={!requisitionId || !isDraft}
          />
        </div>

        {/* Grand Total */}
        <div className="border-t pt-4">
          <div className="flex justify-end">
            <div className="bg-gray-50 rounded-lg p-4 min-w-[300px]">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">
                  Grand Total:
                </span>
                <span className="text-2xl font-bold text-indigo-600">
                  UGX {grandTotal.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {lineItems.length} item{lineItems.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save as Template Modal */}
      <SaveTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSave={handleSaveAsTemplate}
        currentData={{
          project_id: formData.project_id,
          expense_account_id: formData.expense_account_id,
          title: formData.title,
          description: formData.description,
          justification: formData.justification,
          delivery_location: formData.delivery_location,
          supplier_preference: formData.supplier_preference
        }}
      />
    </div>
  )
}

export default CreateRequisition
