import { useEffect, useState, memo } from 'react'
import PropTypes from 'prop-types'
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import {
  getProjectBudgetSummary,
  getProjectExpenseBreakdown
} from '../../services/api/requisitions'
import { logger } from '../../utils/logger'

const ProjectBudgetCard = ({ projectId, projectName }) => {
  const [budgetSummary, setBudgetSummary] = useState(null)
  const [expenseBreakdown, setExpenseBreakdown] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (projectId) {
      loadBudgetData()
    }
  }, [projectId])

  const loadBudgetData = async () => {
    setLoading(true)
    setError('')

    try {
      const [summaryResult, breakdownResult] = await Promise.all([
        getProjectBudgetSummary(projectId),
        getProjectExpenseBreakdown(projectId)
      ])

      if (summaryResult.error) throw summaryResult.error
      if (breakdownResult.error) throw breakdownResult.error

      setBudgetSummary(summaryResult.data)
      setExpenseBreakdown(breakdownResult.data || [])
    } catch (err) {
      logger.error('Error loading budget data:', err)
      setError(err.message || 'Failed to load budget data')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0)
  }

  const getUtilizationColor = (percentage) => {
    if (percentage >= 90) return 'text-red-600 bg-red-50'
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  const getProgressBarColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  if (!budgetSummary) {
    return null
  }

  const totalBudget = parseFloat(budgetSummary.total_budget || 0)
  const spentAmount = parseFloat(budgetSummary.spent_amount || 0)
  const pendingAmount = parseFloat(budgetSummary.pending_amount || 0)
  const underReviewAmount = parseFloat(budgetSummary.under_review_amount || 0)
  const availableBudget = parseFloat(budgetSummary.available_budget || 0)
  const utilization = parseFloat(budgetSummary.utilization_percentage || 0)
  const committedAmount = spentAmount + pendingAmount + underReviewAmount

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 text-white">
        <h3 className="text-lg font-semibold mb-2">{projectName || 'Project Budget'}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{formatCurrency(availableBudget)}</span>
          <span className="text-indigo-200">available</span>
        </div>
      </div>

      {/* Budget Overview */}
      <div className="p-6 space-y-6">
        {/* Total Budget */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Budget</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(totalBudget)}</p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getUtilizationColor(utilization)}`}>
            {utilization.toFixed(1)}% used
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Budget Utilization</span>
            <span>{formatCurrency(committedAmount)} / {formatCurrency(totalBudget)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getProgressBarColor(utilization)}`}
              style={{ width: `${Math.min(utilization, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Budget Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Spent */}
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-600">Approved/Spent</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(spentAmount)}</p>
            </div>
          </div>

          {/* Pending */}
          <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
            <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-600">Pending/Under Review</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(pendingAmount + underReviewAmount)}</p>
            </div>
          </div>

          {/* Available */}
          <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg">
            <TrendingUp className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-600">Available</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(availableBudget)}</p>
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        {expenseBreakdown.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Spending by Category</h4>
            <div className="space-y-3">
              {expenseBreakdown.map((item, index) => {
                const total = parseFloat(item.total_committed || 0)
                const percentage = totalBudget > 0 ? (total / totalBudget * 100) : 0

                return (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.expense_account_name}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(total)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

ProjectBudgetCard.propTypes = {
  projectId: PropTypes.string.isRequired,
  projectName: PropTypes.string
}

ProjectBudgetCard.defaultProps = {
  projectName: 'Project'
}

export default memo(ProjectBudgetCard)
