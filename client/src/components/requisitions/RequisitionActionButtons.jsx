/**
 * RequisitionActionButtons Component
 * 
 * Renders the action buttons for requisition forms:
 * - Save Draft, Submit, Save as Template
 * - Cancel, Back buttons
 * 
 * Extracted from CreateRequisition.jsx for better maintainability.
 */
import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import SaveTemplateModal from './SaveTemplateModal'

/**
 * RequisitionActionButtons - Action buttons for requisition form
 * 
 * @param {Object} props
 * @param {Function} props.onSaveDraft - Handler for saving as draft
 * @param {Function} props.onSubmit - Handler for submitting requisition
 * @param {Function} props.onSaveTemplate - Handler for saving as template
 * @param {boolean} props.loading - Whether an action is in progress
 * @param {boolean} props.saving - Whether save is in progress
 * @param {boolean} props.isDraft - Whether this is a draft
 * @param {boolean} props.hasRequisitionId - Whether a requisition ID exists
 * @param {boolean} props.isEditMode - Whether in edit mode
 * @param {boolean} props.disabled - Whether buttons are disabled
 */
function RequisitionActionButtons({
  onSaveDraft,
  onSubmit,
  onSaveTemplate,
  loading = false,
  saving = false,
  isDraft = true,
  hasRequisitionId = false,
  isEditMode = false,
  disabled = false
}) {
  const navigate = useNavigate()
  const [showTemplateModal, setShowTemplateModal] = useState(false)

  const handleCancel = () => {
    navigate('/requisitions')
  }

  const handleSaveTemplateClick = () => {
    setShowTemplateModal(true)
  }

  const handleTemplateModalClose = () => {
    setShowTemplateModal(false)
  }

  const handleTemplateSave = async (templateData) => {
    await onSaveTemplate(templateData)
    setShowTemplateModal(false)
  }

  const isLoading = loading || saving

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
        {/* Left Side - Cancel */}
        <button
          type="button"
          onClick={handleCancel}
          disabled={isLoading}
          className="order-2 sm:order-1 w-full sm:w-auto px-4 py-2 text-sm font-medium 
                   text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 
                   border border-gray-300 dark:border-gray-600 rounded-lg
                   hover:bg-gray-50 dark:hover:bg-gray-600 
                   focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors duration-200"
        >
          Cancel
        </button>

        {/* Right Side - Action Buttons */}
        <div className="order-1 sm:order-2 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {/* Save as Template */}
          <button
            type="button"
            onClick={handleSaveTemplateClick}
            disabled={isLoading || disabled}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium 
                     text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 
                     border border-gray-300 dark:border-gray-600 rounded-lg
                     hover:bg-gray-50 dark:hover:bg-gray-600 
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-200"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              Save as Template
            </span>
          </button>

          {/* Save Draft */}
          <button
            type="button"
            onClick={() => onSaveDraft(false)}
            disabled={isLoading || disabled}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium 
                     text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 
                     border border-primary-300 dark:border-primary-700 rounded-lg
                     hover:bg-primary-100 dark:hover:bg-primary-900/50 
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-200"
          >
            <span className="flex items-center justify-center gap-2">
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  {hasRequisitionId ? 'Update Draft' : 'Save Draft'}
                </>
              )}
            </span>
          </button>

          {/* Submit */}
          {isDraft && hasRequisitionId && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isLoading || disabled}
              className="w-full sm:w-auto px-6 py-2 text-sm font-medium 
                       text-white bg-primary-600 hover:bg-primary-700 
                       border border-transparent rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors duration-200"
            >
              <span className="flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Submit for Review
                  </>
                )}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Template Modal */}
      <SaveTemplateModal
        isOpen={showTemplateModal}
        onClose={handleTemplateModalClose}
        onSave={handleTemplateSave}
      />
    </>
  )
}

RequisitionActionButtons.propTypes = {
  onSaveDraft: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onSaveTemplate: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  saving: PropTypes.bool,
  isDraft: PropTypes.bool,
  hasRequisitionId: PropTypes.bool,
  isEditMode: PropTypes.bool,
  disabled: PropTypes.bool
}

export default RequisitionActionButtons
