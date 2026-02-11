/**
 * RequisitionMetadataForm Component
 * 
 * Renders the metadata/header section of a requisition form including:
 * - Title, Project, Expense Account
 * - Urgency, Required By Date
 * - Delivery Location, Supplier Preference
 * - Description, Justification
 * 
 * Extracted from CreateRequisition.jsx for better maintainability
 */
import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import { logger } from '../../utils/logger'
import SearchableSelect from '../common/SearchableSelect'

/**
 * RequisitionMetadataForm - Form fields for requisition metadata
 * 
 * @param {Object} props
 * @param {Object} props.formData - Current form values
 * @param {Function} props.onChange - Handler for field changes
 * @param {Array} props.projects - Available projects
 * @param {Array} props.expenseAccounts - Available expense accounts
 * @param {boolean} props.loadingProjects - Whether projects are loading
 * @param {boolean} props.loadingExpenseAccounts - Whether expense accounts are loading
 * @param {boolean} props.disabled - Whether form is disabled
 */
function RequisitionMetadataForm({
  formData,
  onChange,
  projects = [],
  expenseAccounts = [],
  loadingProjects = false,
  loadingExpenseAccounts = false,
  disabled = false
}) {
  // Filter expense accounts by selected project
  const filteredExpenseAccounts = useMemo(() => {
    if (!formData.project_id) return []
    return expenseAccounts.filter(
      account => account.project_id === formData.project_id
    )
  }, [formData.project_id, expenseAccounts])

  // Log when project changes (for debugging)
  const handleProjectChange = (e) => {
    logger.debug('Project changed to:', e.target.value)
    onChange(e)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Requisition Details
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Enter the basic information for this requisition
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Title */}
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Requisition Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={onChange}
            disabled={disabled}
            placeholder="e.g., Office Supplies Q1 2025"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          />
        </div>

        {/* Project and Expense Account Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Project */}
          <div>
            <label
              htmlFor="project_id"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Project <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              id="project_id"
              name="project_id"
              value={formData.project_id}
              onChange={handleProjectChange}
              options={projects}
              disabled={disabled || loadingProjects}
              placeholder={loadingProjects ? 'Loading projects...' : 'Select a project'}
              labelFn={(p) => `${p.code} - ${p.name}`}
              filterFn={(p, term) =>
                p.code?.toLowerCase().includes(term) ||
                p.name?.toLowerCase().includes(term)
              }
              emptyMessage="No projects found"
            />
          </div>

          {/* Expense Account */}
          <div>
            <label
              htmlFor="expense_account_id"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Expense Account <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              id="expense_account_id"
              name="expense_account_id"
              value={formData.expense_account_id}
              onChange={onChange}
              options={filteredExpenseAccounts}
              disabled={disabled || loadingExpenseAccounts || !formData.project_id}
              placeholder={
                !formData.project_id
                  ? 'Select a project first'
                  : loadingExpenseAccounts
                    ? 'Loading accounts...'
                    : filteredExpenseAccounts.length === 0
                      ? 'No expense accounts for this project'
                      : 'Search expense accounts...'
              }
              labelFn={(a) => `${a.code} - ${a.name}`}
              filterFn={(a, term) =>
                a.code?.toLowerCase().includes(term) ||
                a.name?.toLowerCase().includes(term) ||
                a.description?.toLowerCase().includes(term)
              }
              emptyMessage="No matching expense accounts"
            />
          </div>
        </div>

        {/* Urgency and Required By Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Urgency */}
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </span>
            <label
              htmlFor="is_urgent"
              className="flex items-center gap-2 w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg
                       bg-gray-50 dark:bg-gray-700/50 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                id="is_urgent"
                name="is_urgent"
                checked={formData.is_urgent}
                onChange={onChange}
                disabled={disabled}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500
                         border-gray-300 dark:border-gray-600 rounded
                         disabled:opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Urgent Request</span>
                <span className="text-gray-500 dark:text-gray-400 ml-1">
                  (expedited processing)
                </span>
              </span>
            </label>
          </div>

          {/* Required By Date */}
          <div>
            <label
              htmlFor="required_by"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Required By Date
            </label>
            <input
              type="date"
              id="required_by"
              name="required_by"
              value={formData.required_by}
              onChange={onChange}
              disabled={disabled}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Delivery Location and Supplier Preference Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Delivery Location */}
          <div>
            <label
              htmlFor="delivery_location"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Delivery Location
            </label>
            <input
              type="text"
              id="delivery_location"
              name="delivery_location"
              value={formData.delivery_location}
              onChange={onChange}
              disabled={disabled}
              placeholder="e.g., Building A, Room 101"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            />
          </div>

          {/* Supplier Preference */}
          <div>
            <label
              htmlFor="supplier_preference"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Preferred Supplier
            </label>
            <input
              type="text"
              id="supplier_preference"
              name="supplier_preference"
              value={formData.supplier_preference}
              onChange={onChange}
              disabled={disabled}
              placeholder="e.g., Staples, Amazon Business"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Description and Justification Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={onChange}
              disabled={disabled}
              rows={3}
              placeholder="Describe the items or services being requested..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed
                       resize-none"
            />
          </div>

          {/* Justification */}
          <div>
            <label
              htmlFor="justification"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Business Justification
            </label>
            <textarea
              id="justification"
              name="justification"
              value={formData.justification}
              onChange={onChange}
              disabled={disabled}
              rows={3}
              placeholder="Explain why this purchase is necessary..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed
                       resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

RequisitionMetadataForm.propTypes = {
  formData: PropTypes.shape({
    title: PropTypes.string,
    project_id: PropTypes.string,
    expense_account_id: PropTypes.string,
    description: PropTypes.string,
    justification: PropTypes.string,
    required_by: PropTypes.string,
    delivery_location: PropTypes.string,
    supplier_preference: PropTypes.string,
    is_urgent: PropTypes.bool
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    code: PropTypes.string,
    name: PropTypes.string.isRequired
  })),
  expenseAccounts: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    code: PropTypes.string,
    name: PropTypes.string.isRequired,
    project_id: PropTypes.string.isRequired
  })),
  loadingProjects: PropTypes.bool,
  loadingExpenseAccounts: PropTypes.bool,
  disabled: PropTypes.bool
}

export default RequisitionMetadataForm
