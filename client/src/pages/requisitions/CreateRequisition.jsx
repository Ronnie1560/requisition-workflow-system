/**
 * CreateRequisition Page (Refactored)
 * 
 * Main page component for creating/editing requisitions.
 * Refactored from 724 lines to ~200 lines by extracting:
 * - useRequisitionForm hook (form state and handlers)
 * - RequisitionMetadataForm (form fields)
 * - RequisitionSummary (total display)
 * - RequisitionActionButtons (action buttons)
 */
import { useEffect, useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useWorkflowRole } from '../../hooks/useWorkflowRole'
import { ArrowLeft, AlertCircle, CheckCircle, Loader } from 'lucide-react'

// Custom hook for form logic
import { useRequisitionForm } from '../../hooks/useRequisitionForm'

// API services
import { getUserProjects } from '../../services/api/requisitions'
import { getAllExpenseAccounts } from '../../services/api/expenseAccounts'

// Components
import LineItemsTable from '../../components/requisitions/LineItemsTable'
import FileUpload from '../../components/requisitions/FileUpload'
import RequisitionMetadataForm from '../../components/requisitions/RequisitionMetadataForm'
import RequisitionSummary from '../../components/requisitions/RequisitionSummary'
import RequisitionActionButtons from '../../components/requisitions/RequisitionActionButtons'

import { logger } from '../../utils/logger'

/**
 * CreateRequisition - Main page component
 */
const CreateRequisition = () => {
  const navigate = useNavigate()
  const { id: draftId } = useParams()
  const { user } = useAuth()
  const { workflowRole } = useWorkflowRole()

  // Use custom hook for form management
  const {
    formData,
    lineItems,
    loading,
    saving,
    error,
    success,
    requisitionId,
    isDraft,
    lastSaved,
    isEditMode,
    grandTotal,
    handleChange,
    handleLineItemsChange,
    handleSaveDraft,
    handleSubmit,
    handleSaveAsTemplate,
    loadDraft,
    clearError
  } = useRequisitionForm(draftId)

  // Dropdown data (local to this component)
  const [projects, setProjects] = useState([])
  const [expenseAccounts, setExpenseAccounts] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingExpenseAccounts, setLoadingExpenseAccounts] = useState(false)

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      if (!user?.id) return
      
      setLoadingProjects(true)
      try {
        const { data, error: loadError } = await getUserProjects(user.id, workflowRole)
        if (loadError) {
          logger.error('Failed to load projects:', loadError)
        } else {
          setProjects(data || [])
        }
      } finally {
        setLoadingProjects(false)
      }
    }
    loadProjects()
  }, [user?.id, workflowRole])

  // Load expense accounts when project changes
  useEffect(() => {
    const loadExpenseAccounts = async () => {
      if (!formData.project_id) {
        setExpenseAccounts([])
        return
      }

      setLoadingExpenseAccounts(true)
      try {
        const { data, error: loadError } = await getAllExpenseAccounts({ 
          project_id: formData.project_id 
        })
        if (loadError) {
          logger.error('Failed to load expense accounts:', loadError)
        } else {
          setExpenseAccounts(data || [])
        }
      } finally {
        setLoadingExpenseAccounts(false)
      }
    }
    loadExpenseAccounts()
  }, [formData.project_id])

  // Load existing draft if editing
  useEffect(() => {
    if (draftId) {
      loadDraft(draftId)
    }
  }, [draftId, loadDraft])

  // Auto-save every 30 seconds
  const handleAutoSave = useCallback(() => {
    handleSaveDraft(true) // Silent save
  }, [handleSaveDraft])

  useEffect(() => {
    if (requisitionId && isDraft && lineItems.length > 0) {
      const interval = setInterval(handleAutoSave, 30000)
      return () => clearInterval(interval)
    }
  }, [requisitionId, isDraft, lineItems.length, handleAutoSave])

  // Dismiss error on click
  const handleDismissError = () => clearError()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/requisitions')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Go back to requisitions list"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEditMode ? 'Edit Draft' : 'Create Requisition'}
            </h1>
            {lastSaved && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Last saved: {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader className="w-5 h-5 animate-spin" />
            <span>Loading...</span>
          </div>
        )}
      </header>

      {/* Error Alert */}
      {error && (
        <div 
          className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3"
          role="alert"
          onClick={handleDismissError}
        >
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div 
          className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3"
          role="status"
        >
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
        </div>
      )}

      {/* Main Form Content */}
      <div className="space-y-6">
        {/* Metadata Form */}
        <RequisitionMetadataForm
          formData={formData}
          onChange={handleChange}
          projects={projects}
          expenseAccounts={expenseAccounts}
          loadingProjects={loadingProjects}
          loadingExpenseAccounts={loadingExpenseAccounts}
          disabled={!isDraft}
        />

        {/* Line Items */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <LineItemsTable
            items={lineItems}
            projectAccountId={formData.project_id}
            onChange={handleLineItemsChange}
            disabled={!isDraft}
          />
        </div>

        {/* File Attachments */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <FileUpload
            requisitionId={requisitionId}
            disabled={!requisitionId || !isDraft}
          />
        </div>

        {/* Summary */}
        <RequisitionSummary
          grandTotal={grandTotal}
          itemCount={lineItems.length}
          lastSaved={lastSaved}
          isDraft={isDraft}
        />

        {/* Action Buttons */}
        <RequisitionActionButtons
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmit}
          onSaveTemplate={handleSaveAsTemplate}
          loading={loading}
          saving={saving}
          isDraft={isDraft}
          hasRequisitionId={!!requisitionId}
          isEditMode={isEditMode}
          disabled={lineItems.length === 0}
        />
      </div>
    </div>
  )
}

export default CreateRequisition
