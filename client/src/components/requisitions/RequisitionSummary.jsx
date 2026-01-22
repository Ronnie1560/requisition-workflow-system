/**
 * RequisitionSummary Component
 * 
 * Displays the grand total and summary information for a requisition.
 * Extracted from CreateRequisition.jsx for better maintainability.
 */
import React from 'react'
import PropTypes from 'prop-types'
import { formatCurrency } from '../../utils/formatters'

/**
 * RequisitionSummary - Shows total amount and item count
 * 
 * @param {Object} props
 * @param {number} props.grandTotal - Total amount of all line items
 * @param {number} props.itemCount - Number of line items
 * @param {Date|null} props.lastSaved - When the draft was last saved
 * @param {boolean} props.isDraft - Whether this is a draft requisition
 */
function RequisitionSummary({ 
  grandTotal = 0, 
  itemCount = 0, 
  lastSaved = null,
  isDraft = true 
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Summary Info */}
          <div className="flex items-center gap-6">
            {/* Item Count */}
            <div className="text-center sm:text-left">
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                Total Items
              </span>
              <span className="text-xl font-semibold text-gray-900 dark:text-white">
                {itemCount}
              </span>
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-10 w-px bg-gray-200 dark:bg-gray-700" />

            {/* Last Saved */}
            {lastSaved && (
              <>
                <div className="text-center sm:text-left">
                  <span className="block text-sm text-gray-500 dark:text-gray-400">
                    Last Saved
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {new Date(lastSaved).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                <div className="hidden sm:block h-10 w-px bg-gray-200 dark:bg-gray-700" />
              </>
            )}

            {/* Status Badge */}
            <div className="text-center sm:text-left">
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                Status
              </span>
              <span 
                className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isDraft 
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' 
                    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                }`}
              >
                {isDraft ? 'Draft' : 'Submitted'}
              </span>
            </div>
          </div>

          {/* Grand Total */}
          <div className="text-center sm:text-right bg-primary-50 dark:bg-primary-900/20 rounded-lg px-6 py-4">
            <span className="block text-sm font-medium text-primary-600 dark:text-primary-400">
              Grand Total
            </span>
            <span className="text-2xl font-bold text-primary-700 dark:text-primary-300">
              {formatCurrency(grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

RequisitionSummary.propTypes = {
  grandTotal: PropTypes.number,
  itemCount: PropTypes.number,
  lastSaved: PropTypes.instanceOf(Date),
  isDraft: PropTypes.bool
}

export default RequisitionSummary
