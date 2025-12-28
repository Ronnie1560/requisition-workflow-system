import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  FileText,
  User,
  Folder,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CreditCard
} from 'lucide-react'
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
import { formatCurrency, formatDate } from '../../utils/formatters'
import { STATUS_LABELS } from '../../utils/constants'
import { logger } from '../../utils/logger'

const Reports = () => {
  const { userRole } = useAuth()

  const [activeReport, setActiveReport] = useState('status')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reportData, setReportData] = useState(null)

  // Date filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Period selection for time-based reports
  const [selectedPeriod, setSelectedPeriod] = useState('monthly')

  // Load report data when report type or filters change
  useEffect(() => {
    loadReportData()
  }, [activeReport, startDate, endDate, selectedPeriod])

  const loadReportData = async () => {
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
  }

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
      case 'spending-project-account':
        filename = 'spending_by_project_and_expense_account'
        // Flatten the hierarchical data for CSV export
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
    }

    exportToCSV(reportData, filename, columns)
  }

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
  }

  const requisitionReports = [
    { id: 'status', name: 'By Status', icon: BarChart3, description: 'Requisitions grouped by status', category: 'requisition' },
    { id: 'submitter', name: 'By Submitter', icon: User, description: 'Requisitions grouped by submitter', category: 'requisition' },
    { id: 'project', name: 'By Project', icon: Folder, description: 'Requisitions grouped by project', category: 'requisition' }
  ]

  const spendingReports = [
    { id: 'spending-project', name: 'By Project', icon: Folder, description: 'Total spending by project', category: 'spending' },
    { id: 'spending-account', name: 'By Expense Account', icon: CreditCard, description: 'Spending by expense account', category: 'spending' },
    { id: 'spending-project-account', name: 'By Project & Account', icon: Folder, description: 'Spending by project grouped by expense accounts', category: 'spending' },
    { id: 'spending-period', name: 'By Time Period', icon: Calendar, description: 'Spending by month/quarter/year', category: 'spending' },
    { id: 'spending-trends', name: 'Spending Trends', icon: TrendingUp, description: 'Spending trends over time', category: 'spending' }
  ]

  const allReports = [...requisitionReports, ...spendingReports]

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports & Analytics</h1>
        <p className="text-gray-600">Generate and export requisition reports</p>
      </div>

      {/* Report Type Selector */}
      <div className="mb-6 space-y-6">
        {/* Requisition Reports */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Requisition Reports</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {requisitionReports.map((report) => {
              const Icon = report.icon
              return (
                <button
                  key={report.id}
                  onClick={() => setActiveReport(report.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    activeReport === report.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      activeReport === report.id ? 'bg-indigo-500' : 'bg-gray-200'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        activeReport === report.id ? 'text-white' : 'text-gray-600'
                      }`} />
                    </div>
                    <h3 className="font-semibold text-gray-900">{report.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600">{report.description}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Spending Reports */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Spending Reports</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {spendingReports.map((report) => {
              const Icon = report.icon
              return (
                <button
                  key={report.id}
                  onClick={() => setActiveReport(report.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    activeReport === report.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      activeReport === report.id ? 'bg-green-500' : 'bg-gray-200'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        activeReport === report.id ? 'text-white' : 'text-gray-600'
                      }`} />
                    </div>
                    <h3 className="font-semibold text-gray-900">{report.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600">{report.description}</p>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>
          {(startDate || endDate) && (
            <button
              onClick={clearFilters}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {activeReport === 'spending-period' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Period Type
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        {/* Report Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {allReports.find(r => r.id === activeReport)?.name || 'Report'}
            </h2>
            {reportData && (
              <p className="text-sm text-gray-600 mt-1">
                {reportData.length} {reportData.length === 1 ? 'record' : 'records'} found
              </p>
            )}
          </div>
          <button
            onClick={handleExport}
            disabled={!reportData || reportData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Report Body */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600 ml-4">Loading report data...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
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
            <div>
              {activeReport === 'status' && <ReportByStatus data={reportData} />}
              {activeReport === 'submitter' && <ReportBySubmitter data={reportData} />}
              {activeReport === 'project' && <ReportByProject data={reportData} />}
              {activeReport === 'spending-project' && <SpendingByProject data={reportData} />}
              {activeReport === 'spending-account' && <SpendingByExpenseAccount data={reportData} />}
              {activeReport === 'spending-project-account' && <SpendingByProjectAndExpenseAccount data={reportData} />}
              {activeReport === 'spending-period' && <SpendingByTimePeriod data={reportData} period={selectedPeriod} />}
              {activeReport === 'spending-trends' && <SpendingTrends data={reportData} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Report by Status Component
const ReportByStatus = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.totalAmount, 0)
  const totalCount = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Count
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Amount
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              % of Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((item) => (
            <tr key={item.status} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {STATUS_LABELS[item.status] || item.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-medium">
                {item.count}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                {formatCurrency(item.totalAmount)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                {total > 0 ? ((item.totalAmount / total) * 100).toFixed(1) : 0}%
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
          <tr>
            <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
              Total
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
              {totalCount}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
              {formatCurrency(total)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
              100%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// Report by Submitter Component
const ReportBySubmitter = ({ data }) => {
  const sortedData = [...data].sort((a, b) => b.totalRequisitions - a.totalRequisitions)

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              User
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Draft
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pending
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Approved
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rejected
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Amount
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Approved Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sortedData.map((item) => (
            <tr key={item.userId} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900">{item.userName}</div>
                  <div className="text-sm text-gray-500">{item.userEmail}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                {item.totalRequisitions}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                {item.draftCount}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                {item.pendingCount}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                {item.approvedCount}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600">
                {item.rejectedCount}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                {formatCurrency(item.totalAmount)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                {formatCurrency(item.approvedAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Report by Project Component
const ReportByProject = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No project data available</p>
      </div>
    )
  }

  const sortedData = [...data].sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0))

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Project
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Draft
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pending
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Approved
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rejected
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Budget
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Approved Amount
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Utilization
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sortedData.map((item) => (
            <tr key={item.projectId} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900">{item.projectCode}</div>
                  <div className="text-sm text-gray-500">{item.projectName}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                {item.totalRequisitions}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                {item.draftCount}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                {item.pendingCount}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                {item.approvedCount}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600">
                {item.rejectedCount}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                {formatCurrency(item.projectBudget)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-medium">
                {formatCurrency(item.approvedAmount)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                <div className="flex items-center justify-end gap-2">
                  <span className={`font-medium ${
                    (item.budgetUtilization || 0) > 90 ? 'text-red-600' :
                    (item.budgetUtilization || 0) > 75 ? 'text-orange-600' :
                    'text-green-600'
                  }`}>
                    {(item.budgetUtilization || 0).toFixed(1)}%
                  </span>
                  {(item.budgetUtilization || 0) > 90 && (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Spending by Project Component (reuses project data with spending focus)
const SpendingByProject = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No spending data available</p>
      </div>
    )
  }

  const sortedData = [...data].sort((a, b) => (b.approvedAmount || 0) - (a.approvedAmount || 0))
  const totalBudget = sortedData.reduce((sum, item) => sum + (item.projectBudget || 0), 0)
  const totalApproved = sortedData.reduce((sum, item) => sum + (item.approvedAmount || 0), 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Project
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Budget
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Approved Spending
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Spending
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Budget Utilization
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Requisitions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sortedData.map((item) => (
            <tr key={item.projectId} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900">{item.projectCode}</div>
                  <div className="text-sm text-gray-500">{item.projectName}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                {formatCurrency(item.projectBudget)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                {formatCurrency(item.approvedAmount)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                {formatCurrency(item.totalAmount)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                <div className="flex items-center justify-end gap-2">
                  <span className={`font-medium ${
                    (item.budgetUtilization || 0) > 90 ? 'text-red-600' :
                    (item.budgetUtilization || 0) > 75 ? 'text-orange-600' :
                    'text-green-600'
                  }`}>
                    {(item.budgetUtilization || 0).toFixed(1)}%
                  </span>
                  {(item.budgetUtilization || 0) > 90 && (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                {item.totalRequisitions}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
          <tr>
            <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
              Total
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
              {formatCurrency(totalBudget)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-green-600">
              {formatCurrency(totalApproved)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
              {formatCurrency(sortedData.reduce((sum, item) => sum + (item.totalAmount || 0), 0))}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
              {totalBudget > 0 ? ((totalApproved / totalBudget) * 100).toFixed(1) : 0}%
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
              {sortedData.reduce((sum, item) => sum + (item.totalRequisitions || 0), 0)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// Spending by Expense Account Component
const SpendingByExpenseAccount = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No expense account data available</p>
      </div>
    )
  }

  const sortedData = [...data].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
  const totalSpent = sortedData.reduce((sum, item) => sum + (item.totalSpent || 0), 0)
  const totalApproved = sortedData.reduce((sum, item) => sum + (item.approvedSpent || 0), 0)
  const totalPending = sortedData.reduce((sum, item) => sum + (item.pendingSpent || 0), 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Expense Account
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Spent
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Approved
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pending
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Requisitions
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Items
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              % of Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sortedData.map((item) => (
            <tr key={item.accountId} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900">{item.accountCode}</div>
                  <div className="text-sm text-gray-500">{item.accountName}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                {formatCurrency(item.totalSpent)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                {formatCurrency(item.approvedSpent)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-yellow-600">
                {formatCurrency(item.pendingSpent)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                {item.requisitionCount}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                {item.itemCount}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                {totalSpent > 0 ? ((item.totalSpent / totalSpent) * 100).toFixed(1) : 0}%
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
          <tr>
            <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
              Total
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
              {formatCurrency(totalSpent)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-green-600">
              {formatCurrency(totalApproved)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-yellow-600">
              {formatCurrency(totalPending)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
              {sortedData.reduce((sum, item) => sum + (item.requisitionCount || 0), 0)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
              {sortedData.reduce((sum, item) => sum + (item.itemCount || 0), 0)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
              100%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// Spending by Time Period Component
const SpendingByTimePeriod = ({ data, period }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No spending data available for selected period</p>
      </div>
    )
  }

  const totalSpent = data.reduce((sum, item) => sum + (item.totalSpent || 0), 0)
  const totalApproved = data.reduce((sum, item) => sum + (item.approvedSpent || 0), 0)
  const totalPending = data.reduce((sum, item) => sum + (item.pendingSpent || 0), 0)
  const totalRejected = data.reduce((sum, item) => sum + (item.rejectedSpent || 0), 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Period
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Spent
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Approved
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pending
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rejected
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Requisitions
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Approved Count
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((item) => (
            <tr key={item.period} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm font-medium text-gray-900">{item.period}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                {formatCurrency(item.totalSpent)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                {formatCurrency(item.approvedSpent)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-yellow-600">
                {formatCurrency(item.pendingSpent)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600">
                {formatCurrency(item.rejectedSpent)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                {item.requisitionCount}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600">
                {item.approvedCount}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
          <tr>
            <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
              Total
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
              {formatCurrency(totalSpent)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-green-600">
              {formatCurrency(totalApproved)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-yellow-600">
              {formatCurrency(totalPending)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-red-600">
              {formatCurrency(totalRejected)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
              {data.reduce((sum, item) => sum + (item.requisitionCount || 0), 0)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-green-600">
              {data.reduce((sum, item) => sum + (item.approvedCount || 0), 0)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// Spending by Project and Expense Account Component
const SpendingByProjectAndExpenseAccount = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No project and expense account data available</p>
      </div>
    )
  }

  const sortedData = [...data].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))

  return (
    <div className="space-y-6">
      {sortedData.map((project) => {
        const expenseAccounts = Array.isArray(project.expenseAccounts) ? project.expenseAccounts : []
        const sortedAccounts = [...expenseAccounts].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))

        return (
          <div key={project.projectId} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Project Header */}
            <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <Folder className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {project.projectCode} - {project.projectName}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {project.requisitionCount} requisitions across {project.expenseAccounts.length} expense accounts
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Spending</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(project.totalSpent)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="text-green-600 font-medium">{formatCurrency(project.approvedSpent)}</span> approved,{' '}
                    <span className="text-yellow-600 font-medium">{formatCurrency(project.pendingSpent)}</span> pending
                  </p>
                </div>
              </div>
            </div>

            {/* Expense Accounts Table */}
            {sortedAccounts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No expense accounts with spending</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expense Account
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Spent
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Approved
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pending
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requisitions
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        % of Project
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {sortedAccounts.map((account) => (
                      <tr key={account.accountId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                              <CreditCard className="w-4 h-4 text-purple-600" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{account.accountCode}</div>
                              <div className="text-sm text-gray-500">{account.accountName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                          {formatCurrency(account.totalSpent)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                          {formatCurrency(account.approvedSpent)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-yellow-600">
                          {formatCurrency(account.pendingSpent)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                          {account.requisitionCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                          {account.itemCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                          {project.totalSpent > 0 ? ((account.totalSpent / project.totalSpent) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {/* Grand Total Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Projects</p>
            <p className="text-2xl font-bold text-gray-900">{sortedData.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Spending</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(sortedData.reduce((sum, p) => sum + (p.totalSpent || 0), 0))}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Approved Spending</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(sortedData.reduce((sum, p) => sum + (p.approvedSpent || 0), 0))}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Spending Trends Component
const SpendingTrends = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No trend data available</p>
      </div>
    )
  }

  const getTrendIcon = (change) => {
    const changeVal = change || 0
    if (changeVal > 0) return <TrendingUp className="w-4 h-4 text-green-600" />
    if (changeVal < 0) return <TrendingDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  const getTrendColor = (change) => {
    const changeVal = change || 0
    if (changeVal > 0) return 'text-green-600'
    if (changeVal < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Period
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Approved Spending
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Change from Previous
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              % Change
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Spending
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Requisitions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((item, index) => {
            const changeFromPrevious = item.changeFromPrevious || 0
            const percentageChange = item.percentageChange || 0

            return (
              <tr key={item.period || index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900">{item.period}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                  {formatCurrency(item.approvedSpent || 0)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <div className="flex items-center justify-end gap-2">
                    {getTrendIcon(changeFromPrevious)}
                    <span className={getTrendColor(changeFromPrevious)}>
                      {formatCurrency(Math.abs(changeFromPrevious))}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <div className="flex items-center justify-end gap-1">
                    <span className={`font-medium ${getTrendColor(changeFromPrevious)}`}>
                      {percentageChange > 0 ? '+' : ''}
                      {percentageChange.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {formatCurrency(item.totalSpent || 0)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                  {item.requisitionCount || 0}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default Reports
