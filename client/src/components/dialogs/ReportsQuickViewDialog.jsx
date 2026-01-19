import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  FileText,
  User,
  Folder,
  TrendingUp,
  CreditCard,
  RefreshCw,
  X
} from 'lucide-react'
import Dialog from '../ui/Dialog'
import {
  getRequisitionsByStatus,
  getRequisitionsBySubmitter,
  getRequisitionsByProject,
  getSpendingByExpenseAccount,
  getSpendingByProjectAndExpenseAccount,
  getSpendingByTimePeriod,
  getSpendingTrends,
  exportToCSV
} from '../../services/api/reports'
import { formatCurrency } from '../../utils/formatters'
import { STATUS_LABELS } from '../../utils/constants'
import { logger } from '../../utils/logger'

/**
 * Reports Quick View Dialog
 * Provides quick access to reports without navigating away from current page
 */
export function ReportsQuickViewDialog({ isOpen, onClose }) {
  const [activeReport, setActiveReport] = useState('status')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reportData, setReportData] = useState(null)

  // Date filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Period selection for time-based reports
  const [selectedPeriod, setSelectedPeriod] = useState('monthly')

  const loadReportData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let result
      const start = startDate || null
      const end = endDate || null

      switch (activeReport) {
        case 'status':
          result = await getRequisitionsByStatus(start, end)
          break
        case 'submitter':
          result = await getRequisitionsBySubmitter(start, end)
          break
        case 'project':
          result = await getRequisitionsByProject(start, end)
          break
        case 'spending-project':
          result = await getRequisitionsByProject(start, end)
          break
        case 'spending-account':
          result = await getSpendingByExpenseAccount(start, end)
          break
        case 'spending-project-account':
          result = await getSpendingByProjectAndExpenseAccount(start, end)
          break
        case 'spending-period':
          result = await getSpendingByTimePeriod(selectedPeriod, start, end)
          break
        case 'spending-trends':
          result = await getSpendingTrends(start, end)
          break
        default:
          result = { data: null, error: null }
      }

      if (result.error) throw result.error
      setReportData(result.data)
    } catch (err) {
      logger.error('Error loading report:', err)
      setError(err.message || 'Failed to load report data')
    } finally {
      setLoading(false)
    }
  }, [activeReport, startDate, endDate, selectedPeriod])

  // Load report data when report type or filters change
  useEffect(() => {
    if (isOpen) {
      loadReportData()
    }
  }, [isOpen, loadReportData])

  const handleExport = () => {
    if (!reportData || reportData.length === 0) {
      alert('No data to export')
      return
    }

    let columns = []
    let filename = ''

    switch (activeReport) {
      case 'status':
        filename = 'requisitions_by_status'
        columns = [
          { label: 'Status', accessor: (row) => STATUS_LABELS[row.status] || row.status },
          { label: 'Count', accessor: (row) => row.count },
          { label: 'Total Amount', accessor: (row) => row.totalAmount }
        ]
        break
      case 'submitter':
        filename = 'requisitions_by_submitter'
        columns = [
          { label: 'User Name', accessor: (row) => row.userName },
          { label: 'Email', accessor: (row) => row.userEmail },
          { label: 'Total Requisitions', accessor: (row) => row.totalRequisitions },
          { label: 'Draft', accessor: (row) => row.draftCount },
          { label: 'Pending', accessor: (row) => row.pendingCount },
          { label: 'Approved', accessor: (row) => row.approvedCount },
          { label: 'Rejected', accessor: (row) => row.rejectedCount },
          { label: 'Total Amount', accessor: (row) => row.totalAmount },
          { label: 'Approved Amount', accessor: (row) => row.approvedAmount }
        ]
        break
      case 'project':
      case 'spending-project':
        filename = 'spending_by_project'
        columns = [
          { label: 'Project Code', accessor: (row) => row.projectCode },
          { label: 'Project Name', accessor: (row) => row.projectName },
          { label: 'Total Requisitions', accessor: (row) => row.totalRequisitions },
          { label: 'Budget', accessor: (row) => row.projectBudget },
          { label: 'Total Amount', accessor: (row) => row.totalAmount },
          { label: 'Approved Amount', accessor: (row) => row.approvedAmount },
          { label: 'Budget Utilization %', accessor: (row) => (row.budgetUtilization || 0).toFixed(2) }
        ]
        break
      case 'spending-account':
        filename = 'spending_by_expense_account'
        columns = [
          { label: 'Account Code', accessor: (row) => row.accountCode },
          { label: 'Account Name', accessor: (row) => row.accountName },
          { label: 'Total Spent', accessor: (row) => row.totalSpent },
          { label: 'Approved Spent', accessor: (row) => row.approvedSpent },
          { label: 'Pending Spent', accessor: (row) => row.pendingSpent },
          { label: 'Requisition Count', accessor: (row) => row.requisitionCount },
          { label: 'Item Count', accessor: (row) => row.itemCount }
        ]
        break
      case 'spending-period':
        filename = `spending_by_${selectedPeriod}`
        columns = [
          { label: 'Period', accessor: (row) => row.period },
          { label: 'Total Spent', accessor: (row) => row.totalSpent },
          { label: 'Approved Spent', accessor: (row) => row.approvedSpent },
          { label: 'Pending Spent', accessor: (row) => row.pendingSpent },
          { label: 'Rejected Spent', accessor: (row) => row.rejectedSpent },
          { label: 'Requisition Count', accessor: (row) => row.requisitionCount },
          { label: 'Approved Count', accessor: (row) => row.approvedCount }
        ]
        break
      case 'spending-trends':
        filename = 'spending_trends'
        columns = [
          { label: 'Period', accessor: (row) => row.period },
          { label: 'Approved Spent', accessor: (row) => row.approvedSpent },
          { label: 'Change from Previous', accessor: (row) => row.changeFromPrevious },
          { label: 'Percentage Change', accessor: (row) => row.percentageChange.toFixed(2) + '%' },
          { label: 'Total Spent', accessor: (row) => row.totalSpent },
          { label: 'Requisition Count', accessor: (row) => row.requisitionCount }
        ]
        break
      case 'spending-project-account': {
        filename = 'spending_by_project_and_expense_account'
        const flattenedData = []
        reportData.forEach(project => {
          project.expenseAccounts.forEach(account => {
            flattenedData.push({
              projectCode: project.projectCode,
              projectName: project.projectName,
              accountCode: account.accountCode,
              accountName: account.accountName,
              totalSpent: account.totalSpent,
              approvedSpent: account.approvedSpent,
              pendingSpent: account.pendingSpent,
              requisitionCount: account.requisitionCount,
              itemCount: account.itemCount
            })
          })
        })
        columns = [
          { label: 'Project Code', accessor: (row) => row.projectCode },
          { label: 'Project Name', accessor: (row) => row.projectName },
          { label: 'Account Code', accessor: (row) => row.accountCode },
          { label: 'Account Name', accessor: (row) => row.accountName },
          { label: 'Total Spent', accessor: (row) => row.totalSpent },
          { label: 'Approved Spent', accessor: (row) => row.approvedSpent },
          { label: 'Pending Spent', accessor: (row) => row.pendingSpent },
          { label: 'Requisition Count', accessor: (row) => row.requisitionCount },
          { label: 'Item Count', accessor: (row) => row.itemCount }
        ]
        exportToCSV(flattenedData, filename, columns)
        return
      }
    }

    exportToCSV(reportData, filename, columns)
  }

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
  }

  const reportTypes = [
    // Requisition Reports
    { id: 'status', name: 'By Status', icon: BarChart3, category: 'Requisition Reports' },
    { id: 'submitter', name: 'By Submitter', icon: User, category: 'Requisition Reports' },
    { id: 'project', name: 'By Project', icon: Folder, category: 'Requisition Reports' },
    // Spending Reports
    { id: 'spending-project', name: 'Project Spending', icon: Folder, category: 'Spending Reports' },
    { id: 'spending-account', name: 'Expense Account', icon: CreditCard, category: 'Spending Reports' },
    { id: 'spending-period', name: 'Time Period', icon: Calendar, category: 'Spending Reports' },
    { id: 'spending-trends', name: 'Trends', icon: TrendingUp, category: 'Spending Reports' }
  ]

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Reports & Analytics" maxWidth="7xl">
      <div className="flex flex-col h-full">
        {/* Report Type Tabs */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap gap-2">
            {reportTypes.map((report) => {
              const Icon = report.icon
              return (
                <button
                  key={report.id}
                  onClick={() => setActiveReport(report.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeReport === report.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {report.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Filters Bar */}
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start Date"
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex-1"
              />
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End Date"
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex-1"
              />
            </div>

            {activeReport === 'spending-period' && (
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}

            {(startDate || endDate) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}

            <button
              onClick={loadReportData}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            <button
              onClick={handleExport}
              disabled={!reportData || reportData.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600 ml-4">Loading report data...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          ) : !reportData || reportData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No data available for the selected filters</p>
              <p className="text-sm mt-2">Try adjusting your date range or filters</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-sm text-gray-600">
                  {reportData.length} {reportData.length === 1 ? 'record' : 'records'} found
                </p>
              </div>
              <div className="overflow-x-auto">
                {activeReport === 'status' && <ReportByStatusTable data={reportData} />}
                {activeReport === 'submitter' && <ReportBySubmitterTable data={reportData} />}
                {(activeReport === 'project' || activeReport === 'spending-project') && <ReportByProjectTable data={reportData} />}
                {activeReport === 'spending-account' && <SpendingByAccountTable data={reportData} />}
                {activeReport === 'spending-period' && <SpendingByPeriodTable data={reportData} />}
                {activeReport === 'spending-trends' && <SpendingTrendsTable data={reportData} />}
                {activeReport === 'spending-project-account' && <SpendingByProjectAccountTable data={reportData} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}

ReportsQuickViewDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
}

// Compact table components for dialog view

const ReportByStatusTable = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.totalAmount, 0)
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">%</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item) => (
          <tr key={item.status} className="hover:bg-gray-50">
            <td className="px-4 py-2 text-sm">
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                {STATUS_LABELS[item.status] || item.status}
              </span>
            </td>
            <td className="px-4 py-2 text-right text-sm font-medium">{item.count}</td>
            <td className="px-4 py-2 text-right text-sm">{formatCurrency(item.totalAmount)}</td>
            <td className="px-4 py-2 text-right text-sm text-gray-600">
              {total > 0 ? ((item.totalAmount / total) * 100).toFixed(1) : 0}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

ReportByStatusTable.propTypes = { data: PropTypes.array.isRequired }

const ReportBySubmitterTable = ({ data }) => {
  const sortedData = [...data].sort((a, b) => b.totalRequisitions - a.totalRequisitions)
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Approved</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {sortedData.map((item) => (
          <tr key={item.userId} className="hover:bg-gray-50">
            <td className="px-4 py-2">
              <div className="text-sm font-medium text-gray-900">{item.userName}</div>
              <div className="text-xs text-gray-500">{item.userEmail}</div>
            </td>
            <td className="px-4 py-2 text-right text-sm font-medium">{item.totalRequisitions}</td>
            <td className="px-4 py-2 text-right text-sm text-green-600">{item.approvedCount}</td>
            <td className="px-4 py-2 text-right text-sm">{formatCurrency(item.approvedAmount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

ReportBySubmitterTable.propTypes = { data: PropTypes.array.isRequired }

const ReportByProjectTable = ({ data }) => {
  const sortedData = [...data].sort((a, b) => (b.approvedAmount || 0) - (a.approvedAmount || 0))
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Budget</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Approved</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Utilization</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {sortedData.map((item) => (
          <tr key={item.projectId} className="hover:bg-gray-50">
            <td className="px-4 py-2">
              <div className="text-sm font-medium text-gray-900">{item.projectCode}</div>
              <div className="text-xs text-gray-500">{item.projectName}</div>
            </td>
            <td className="px-4 py-2 text-right text-sm">{formatCurrency(item.projectBudget)}</td>
            <td className="px-4 py-2 text-right text-sm text-green-600 font-medium">
              {formatCurrency(item.approvedAmount)}
            </td>
            <td className="px-4 py-2 text-right text-sm">
              <span className={`font-medium ${
                (item.budgetUtilization || 0) > 90 ? 'text-red-600' :
                (item.budgetUtilization || 0) > 75 ? 'text-orange-600' :
                'text-green-600'
              }`}>
                {(item.budgetUtilization || 0).toFixed(1)}%
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

ReportByProjectTable.propTypes = { data: PropTypes.array.isRequired }

const SpendingByAccountTable = ({ data }) => {
  const sortedData = [...data].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Approved</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {sortedData.map((item) => (
          <tr key={item.accountId} className="hover:bg-gray-50">
            <td className="px-4 py-2">
              <div className="text-sm font-medium text-gray-900">{item.accountCode}</div>
              <div className="text-xs text-gray-500">{item.accountName}</div>
            </td>
            <td className="px-4 py-2 text-right text-sm font-medium">{formatCurrency(item.totalSpent)}</td>
            <td className="px-4 py-2 text-right text-sm text-green-600">{formatCurrency(item.approvedSpent)}</td>
            <td className="px-4 py-2 text-right text-sm text-yellow-600">{formatCurrency(item.pendingSpent)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

SpendingByAccountTable.propTypes = { data: PropTypes.array.isRequired }

const SpendingByPeriodTable = ({ data }) => {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Approved</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item) => (
          <tr key={item.period} className="hover:bg-gray-50">
            <td className="px-4 py-2 text-sm font-medium">{item.period}</td>
            <td className="px-4 py-2 text-right text-sm font-medium">{formatCurrency(item.totalSpent)}</td>
            <td className="px-4 py-2 text-right text-sm text-green-600">{formatCurrency(item.approvedSpent)}</td>
            <td className="px-4 py-2 text-right text-sm text-gray-600">{item.requisitionCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

SpendingByPeriodTable.propTypes = { data: PropTypes.array.isRequired }

const SpendingTrendsTable = ({ data }) => {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Approved</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">% Change</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item) => (
          <tr key={item.period} className="hover:bg-gray-50">
            <td className="px-4 py-2 text-sm font-medium">{item.period}</td>
            <td className="px-4 py-2 text-right text-sm text-green-600">{formatCurrency(item.approvedSpent)}</td>
            <td className="px-4 py-2 text-right text-sm">
              <span className={item.changeFromPrevious >= 0 ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(Math.abs(item.changeFromPrevious))}
              </span>
            </td>
            <td className="px-4 py-2 text-right text-sm font-medium">
              <span className={item.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                {item.percentageChange > 0 ? '+' : ''}{item.percentageChange.toFixed(1)}%
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

SpendingTrendsTable.propTypes = { data: PropTypes.array.isRequired }

const SpendingByProjectAccountTable = ({ data }) => {
  return (
    <div className="space-y-4">
      {data.map((project) => (
        <div key={project.projectId} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">
                  {project.projectCode} - {project.projectName}
                </h4>
                <p className="text-xs text-gray-600 mt-0.5">
                  {project.expenseAccounts.length} expense accounts
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{formatCurrency(project.totalSpent)}</p>
              </div>
            </div>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Approved</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {project.expenseAccounts.map((account) => (
                <tr key={account.accountId} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="text-sm font-medium text-gray-900">{account.accountCode}</div>
                    <div className="text-xs text-gray-500">{account.accountName}</div>
                  </td>
                  <td className="px-4 py-2 text-right text-sm font-medium">{formatCurrency(account.totalSpent)}</td>
                  <td className="px-4 py-2 text-right text-sm text-green-600">{formatCurrency(account.approvedSpent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

SpendingByProjectAccountTable.propTypes = { data: PropTypes.array.isRequired }

export default ReportsQuickViewDialog
