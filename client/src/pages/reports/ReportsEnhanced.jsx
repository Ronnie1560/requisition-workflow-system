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
  CreditCard,
  Printer,
  Building2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  ExternalLink
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
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
import { useOrganizationSettings } from '../../hooks/useOrganizationSettings'
import { getAllProjects } from '../../services/api/projects'
import { logger } from '../../utils/logger'
import SpendingByProjectEnhanced from '../../components/reports/SpendingByProjectEnhanced'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

const ReportsEnhanced = () => {
  const { userRole, profile } = useAuth()

  const [activeReport, setActiveReport] = useState('status')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reportData, setReportData] = useState(null)

  // Organization settings - using cached hook
  const { orgSettings, loading: orgLoading, error: orgError } = useOrganizationSettings()

  // Date filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [datePreset, setDatePreset] = useState('all') // all, thisMonth, lastMonth, thisQuarter, lastQuarter, thisYear, lastYear, ytd, last30, last60, last90

  // Period selection for time-based reports
  const [selectedPeriod, setSelectedPeriod] = useState('monthly')

  // Project filter for project & account report
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState('')

  // Search/filter within results
  const [searchTerm, setSearchTerm] = useState('')

  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  // Drill-down modal state
  const [drillDownData, setDrillDownData] = useState(null)
  const [drillDownTitle, setDrillDownTitle] = useState('')
  const [showDrillDown, setShowDrillDown] = useState(false)

  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [])

  // Load report data when report type or filters change
  useEffect(() => {
    loadReportData()
  }, [activeReport, startDate, endDate, selectedPeriod, selectedProject])

  const loadProjects = async () => {
    const { data, error } = await getAllProjects({ is_active: true })
    if (!error && data) {
      setProjects(data)
    }
  }

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
          result = await getSpendingByProjectAndExpenseAccount(start, end, selectedProject || null)
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

  const generateReportHTML = () => {
    if (!reportData) return ''

    const reportTitle = allReports.find(r => r.id === activeReport)?.name || 'Report'
    const dateRangeText = (startDate || endDate)
      ? `${startDate ? `From: ${formatDate(startDate)}` : ''}${startDate && endDate ? ' • ' : ''}${endDate ? `To: ${formatDate(endDate)}` : ''}`
      : 'All Dates'

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${reportTitle} - ${orgSettings?.organization_name || 'Report'}</title>
        <style>
          @media print {
            @page {
              margin: 15mm;
              size: A4;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 10px;
            line-height: 1.4;
            color: #222;
            background: white;
            padding: 15px;
          }

          .document-header {
            border-bottom: 3px solid #2563eb;
            padding-bottom: 12px;
            margin-bottom: 15px;
          }

          .org-name {
            font-size: 18px;
            font-weight: bold;
            color: #1e40af;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }

          .doc-title-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 6px;
          }

          .doc-type {
            font-size: 14px;
            font-weight: 600;
            color: #374151;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .doc-date-range {
            font-size: 10px;
            font-weight: 600;
            color: #1e40af;
            background: #eff6ff;
            padding: 4px 12px;
            border-radius: 4px;
          }

          .info-section {
            margin-bottom: 12px;
            padding: 8px 10px;
            background: #f9fafb;
            border-radius: 4px;
          }

          .info-row {
            display: flex;
            padding: 3px 0;
            font-size: 9px;
          }

          .info-label {
            font-weight: 600;
            color: #6b7280;
            min-width: 100px;
            flex-shrink: 0;
          }

          .info-value {
            color: #111827;
            font-weight: 500;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
            margin-top: 10px;
          }

          th {
            background: #f3f4f6;
            padding: 6px 4px;
            text-align: left;
            font-weight: 600;
            color: #4b5563;
            border-bottom: 2px solid #d1d5db;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }

          td {
            padding: 5px 4px;
            border-bottom: 1px solid #e5e7eb;
            color: #374151;
          }

          .text-right {
            text-align: right;
          }

          .text-center {
            text-align: center;
          }

          tfoot td {
            font-weight: 700;
            background: #f3f4f6;
            border-top: 2px solid #9ca3af;
            border-bottom: none;
            padding: 8px 4px;
            font-size: 10px;
          }

          .total-value {
            font-size: 12px;
            color: #059669;
          }

          .document-footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #d1d5db;
            text-align: center;
            font-size: 8px;
            color: #9ca3af;
          }

          .document-footer p {
            margin: 2px 0;
          }
        </style>
      </head>
      <body>
        <div class="document-header">
          <div class="org-name">${orgSettings?.organization_name || 'Your Organization'}</div>
          <div class="doc-title-row">
            <span class="doc-type">${reportTitle}</span>
            <span class="doc-date-range">${dateRangeText}</span>
          </div>
        </div>

        <div class="info-section">
          <div class="info-row">
            <span class="info-label">Generated By:</span>
            <span class="info-value">${profile?.full_name || 'User'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Generated On:</span>
            <span class="info-value">${formatDate(new Date().toISOString())}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Total Records:</span>
            <span class="info-value">${reportData.length}</span>
          </div>
        </div>

        <div id="report-content">
          ${document.getElementById('report-content-container')?.innerHTML || 'No data available'}
        </div>

        <div class="document-footer">
          <p>Generated on ${formatDate(new Date().toISOString())} | This is a system-generated document</p>
          <p>${orgSettings?.organization_name || 'Your Organization'} - Reports & Analytics</p>
        </div>
      </body>
      </html>
    `
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow popups to print the report')
      return
    }

    const htmlContent = generateReportHTML()
    printWindow.document.write(htmlContent)
    printWindow.document.close()

    printWindow.onload = () => {
      printWindow.print()
    }
  }

  const handleExportPDF = () => {
    if (!processedReportData || processedReportData.length === 0) {
      alert('No data to export')
      return
    }

    const doc = new jsPDF('p', 'mm', 'a4')
    const reportTitle = allReports.find(r => r.id === activeReport)?.name || 'Report'
    const dateRangeText = (startDate || endDate)
      ? `${startDate ? formatDate(startDate) : ''} - ${endDate ? formatDate(endDate) : ''}`
      : 'All Dates'

    // Add header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(orgSettings?.organization_name || 'Your Organization', 14, 20)

    doc.setFontSize(14)
    doc.text(reportTitle, 14, 30)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Date Range: ${dateRangeText}`, 14, 37)
    doc.text(`Generated: ${formatDate(new Date().toISOString())}`, 14, 42)
    doc.text(`Generated by: ${profile?.full_name || 'User'}`, 14, 47)

    // Prepare table data based on report type
    let headers = []
    let rows = []

    switch (activeReport) {
      case 'status':
        headers = [['Status', 'Count', 'Total Amount', '% of Total']]
        const totalCount = processedReportData.reduce((sum, item) => sum + (item.count || 0), 0)
        rows = processedReportData.map(item => [
          STATUS_LABELS[item.status] || item.status,
          item.count,
          formatCurrency(item.totalAmount),
          `${((item.count / totalCount) * 100).toFixed(1)}%`
        ])
        break

      case 'submitter':
        headers = [['User', 'Total Reqs', 'Approved', 'Pending', 'Rejected', 'Total Amount']]
        rows = processedReportData.map(item => [
          item.userName,
          item.totalRequisitions,
          item.approvedCount || 0,
          item.pendingCount || 0,
          item.rejectedCount || 0,
          formatCurrency(item.totalAmount)
        ])
        break

      case 'project':
      case 'spending-project':
        headers = [['Project', 'Budget', 'Spent', 'Approved', 'Reqs', 'Utilization %']]
        rows = processedReportData.map(item => [
          `${item.projectCode} - ${item.projectName}`,
          formatCurrency(item.projectBudget),
          formatCurrency(item.totalAmount),
          formatCurrency(item.approvedAmount),
          item.totalRequisitions,
          `${item.budgetUtilization ? item.budgetUtilization.toFixed(1) : '0.0'}%`
        ])
        break

      case 'spending-account':
        headers = [['Account', 'Total Spent', 'Approved', 'Pending', 'Reqs']]
        rows = processedReportData.map(item => [
          `${item.accountCode} - ${item.accountName}`,
          formatCurrency(item.totalSpent),
          formatCurrency(item.approvedSpent),
          formatCurrency(item.pendingSpent),
          item.requisitionCount
        ])
        break

      case 'spending-period':
        headers = [['Period', 'Total Spent', 'Approved', 'Pending', 'Reqs']]
        rows = processedReportData.map(item => [
          item.period,
          formatCurrency(item.totalSpent),
          formatCurrency(item.approvedSpent),
          formatCurrency(item.pendingSpent),
          item.requisitionCount
        ])
        break

      case 'spending-trends':
        headers = [['Period', 'Approved Spent', 'Change', '% Change', 'Reqs']]
        rows = processedReportData.map(item => [
          item.period,
          formatCurrency(item.approvedSpent),
          formatCurrency(Math.abs(item.changeFromPrevious || 0)),
          `${Math.abs(item.percentageChange || 0).toFixed(1)}%`,
          item.requisitionCount
        ])
        break

      default:
        headers = [['Data']]
        rows = [['Report data not available for PDF export']]
    }

    // Add table
    doc.autoTable({
      head: headers,
      body: rows,
      startY: 55,
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { top: 55, left: 14, right: 14 }
    })

    // Add footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }

    // Save PDF
    const filename = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(filename)
  }

  // Helper function to get date range based on preset
  const getDateRangeFromPreset = (preset) => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()
    const date = today.getDate()

    switch (preset) {
      case 'thisMonth':
        return {
          start: new Date(year, month, 1).toISOString().split('T')[0],
          end: new Date(year, month + 1, 0).toISOString().split('T')[0]
        }
      case 'lastMonth':
        return {
          start: new Date(year, month - 1, 1).toISOString().split('T')[0],
          end: new Date(year, month, 0).toISOString().split('T')[0]
        }
      case 'thisQuarter':
        const quarterStart = Math.floor(month / 3) * 3
        return {
          start: new Date(year, quarterStart, 1).toISOString().split('T')[0],
          end: new Date(year, quarterStart + 3, 0).toISOString().split('T')[0]
        }
      case 'lastQuarter':
        const lastQuarterStart = Math.floor(month / 3) * 3 - 3
        return {
          start: new Date(year, lastQuarterStart, 1).toISOString().split('T')[0],
          end: new Date(year, lastQuarterStart + 3, 0).toISOString().split('T')[0]
        }
      case 'thisYear':
        return {
          start: new Date(year, 0, 1).toISOString().split('T')[0],
          end: new Date(year, 11, 31).toISOString().split('T')[0]
        }
      case 'lastYear':
        return {
          start: new Date(year - 1, 0, 1).toISOString().split('T')[0],
          end: new Date(year - 1, 11, 31).toISOString().split('T')[0]
        }
      case 'ytd':
        return {
          start: new Date(year, 0, 1).toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        }
      case 'last30':
        return {
          start: new Date(year, month, date - 30).toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        }
      case 'last60':
        return {
          start: new Date(year, month, date - 60).toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        }
      case 'last90':
        return {
          start: new Date(year, month, date - 90).toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        }
      case 'all':
      default:
        return { start: '', end: '' }
    }
  }

  // Handle date preset selection
  const handleDatePresetChange = (preset) => {
    setDatePreset(preset)
    const { start, end } = getDateRangeFromPreset(preset)
    setStartDate(start)
    setEndDate(end)
  }

  // Validate date range
  const validateDateRange = () => {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return 'End date must be after start date'
    }
    return null
  }

  // Handle manual date changes with validation
  const handleStartDateChange = (date) => {
    setStartDate(date)
    setDatePreset('custom')
  }

  const handleEndDateChange = (date) => {
    setEndDate(date)
    setDatePreset('custom')
  }

  // Sorting function
  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Apply sorting to data
  const sortData = (data, key, direction) => {
    if (!key || !data) return data

    return [...data].sort((a, b) => {
      let aVal = a[key]
      let bVal = b[key]

      // Handle nested properties (e.g., 'project.name')
      if (typeof aVal === 'undefined' && key.includes('.')) {
        const keys = key.split('.')
        aVal = keys.reduce((obj, k) => obj?.[k], a)
        bVal = keys.reduce((obj, k) => obj?.[k], b)
      }

      // Handle null/undefined
      if (aVal == null) return 1
      if (bVal == null) return -1

      // Compare values
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1
      if (aVal > bVal) return direction === 'asc' ? 1 : -1
      return 0
    })
  }

  // Filter data based on search term
  const filterData = (data) => {
    if (!searchTerm || !data) return data

    const term = searchTerm.toLowerCase()
    return data.filter(item => {
      return Object.values(item).some(value => {
        if (value == null) return false
        if (typeof value === 'object') {
          return Object.values(value).some(v =>
            String(v).toLowerCase().includes(term)
          )
        }
        return String(value).toLowerCase().includes(term)
      })
    })
  }

  // Process data with sorting and filtering
  const processedReportData = reportData ?
    sortData(filterData(reportData), sortConfig.key, sortConfig.direction) :
    reportData

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedProject('')
    setDatePreset('all')
    setSearchTerm('')
  }

  // Handle drill-down click
  const handleDrillDown = (title, requisitions) => {
    setDrillDownTitle(title)
    setDrillDownData(requisitions)
    setShowDrillDown(true)
  }

  const closeDrillDown = () => {
    setShowDrillDown(false)
    setDrillDownData(null)
    setDrillDownTitle('')
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
    <div className="max-w-7xl mx-auto print:max-w-none">
      {/* Organization Header - Print Friendly */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-4 border-slate-700 p-8 mb-8 print:bg-white print:border-b-2 print:border-black">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Logo - Can be replaced with actual logo */}
            {orgSettings?.logo_url ? (
              <img
                src={orgSettings.logo_url}
                alt="Organization Logo"
                className="w-16 h-16 object-contain rounded-lg print:w-20 print:h-20"
              />
            ) : (
              <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center print:bg-white print:border-2 print:border-black print:w-20 print:h-20">
                <Building2 className="w-10 h-10 text-white print:text-black" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">
                {orgSettings?.organization_name || 'Your Organization'}
              </h1>
              <p className="text-slate-600 font-medium">Procurement Management System</p>
              {orgSettings?.address_line1 && (
                <p className="text-sm text-slate-500 mt-1">
                  {orgSettings.address_line1}
                  {orgSettings.city && `, ${orgSettings.city}`}
                </p>
              )}
            </div>
          </div>
          <div className="text-right text-sm text-slate-600 print:text-black">
            <p className="font-semibold">Report Generated</p>
            <p>{new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
            <p className="mt-2">Generated by: {profile?.full_name || 'User'}</p>
            {orgSettings?.phone && (
              <p className="mt-2 text-xs">Tel: {orgSettings.phone}</p>
            )}
            {orgSettings?.email && (
              <p className="text-xs">Email: {orgSettings.email}</p>
            )}
          </div>
        </div>
      </div>

      {/* Report Title */}
      <div className="mb-8 print:mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2 print:text-xl">
              Reports & Analytics
            </h2>
            <p className="text-slate-600 print:text-black">
              Comprehensive procurement and spending analysis
            </p>
          </div>
          {(startDate || endDate) && (
            <div className="text-right print:text-left">
              <p className="text-sm font-semibold text-slate-700 print:text-black">
                {startDate && `From: ${formatDate(startDate)}`}
                {startDate && endDate && ' • '}
                {endDate && `To: ${formatDate(endDate)}`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Report Type Selector - Hide on Print */}
      <div className="mb-6 space-y-6 print:hidden">
        {/* Requisition Reports */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Requisition Reports
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {requisitionReports.map((report) => {
              const Icon = report.icon
              return (
                <button
                  key={report.id}
                  onClick={() => setActiveReport(report.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all shadow-sm hover:shadow-md ${
                    activeReport === report.id
                      ? 'border-blue-600 bg-blue-50 shadow-md'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center shadow-sm ${
                      activeReport === report.id ? 'bg-blue-600' : 'bg-slate-100'
                    }`}>
                      <Icon className={`w-6 h-6 ${
                        activeReport === report.id ? 'text-white' : 'text-slate-600'
                      }`} />
                    </div>
                    <h3 className="font-semibold text-slate-900">{report.name}</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{report.description}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Spending Reports */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Spending Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {spendingReports.map((report) => {
              const Icon = report.icon
              return (
                <button
                  key={report.id}
                  onClick={() => setActiveReport(report.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all shadow-sm hover:shadow-md ${
                    activeReport === report.id
                      ? 'border-emerald-600 bg-emerald-50 shadow-md'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center shadow-sm ${
                      activeReport === report.id ? 'bg-emerald-600' : 'bg-slate-100'
                    }`}>
                      <Icon className={`w-6 h-6 ${
                        activeReport === report.id ? 'text-white' : 'text-slate-600'
                      }`} />
                    </div>
                    <h3 className="font-semibold text-slate-900">{report.name}</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{report.description}</p>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Filters - Hide on Print */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 print:hidden">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-900">Report Filters</h3>
          </div>
          {(startDate || endDate || searchTerm) && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
            >
              Clear All Filters
            </button>
          )}
        </div>

        {/* Date Range Presets */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">Quick Date Ranges</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleDatePresetChange('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                datePreset === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => handleDatePresetChange('thisMonth')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                datePreset === 'thisMonth'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => handleDatePresetChange('lastMonth')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                datePreset === 'lastMonth'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Last Month
            </button>
            <button
              onClick={() => handleDatePresetChange('thisQuarter')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                datePreset === 'thisQuarter'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              This Quarter
            </button>
            <button
              onClick={() => handleDatePresetChange('lastQuarter')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                datePreset === 'lastQuarter'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Last Quarter
            </button>
            <button
              onClick={() => handleDatePresetChange('thisYear')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                datePreset === 'thisYear'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              This Year
            </button>
            <button
              onClick={() => handleDatePresetChange('lastYear')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                datePreset === 'lastYear'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Last Year
            </button>
            <button
              onClick={() => handleDatePresetChange('ytd')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                datePreset === 'ytd'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Year to Date
            </button>
            <button
              onClick={() => handleDatePresetChange('last30')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                datePreset === 'last30'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => handleDatePresetChange('last60')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                datePreset === 'last60'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Last 60 Days
            </button>
            <button
              onClick={() => handleDatePresetChange('last90')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                datePreset === 'last90'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Last 90 Days
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Custom Date Inputs */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Search Results
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {activeReport === 'spending-period' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Period Type
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          )}

          {activeReport === 'spending-project-account' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Folder className="w-4 h-4 inline mr-1" />
                Filter by Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} - {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Date Validation Error */}
        {validateDateRange() && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {validateDateRange()}
          </div>
        )}
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border-none">
        {/* Report Header */}
        <div className="p-6 border-b border-slate-200 print:border-none print:p-0 print:mb-6">
          <h3 className="text-2xl font-bold text-slate-900 print:text-3xl">
            {allReports.find(r => r.id === activeReport)?.name || 'Report'}
          </h3>
        </div>

        {/* Report Actions */}
        <div className="p-6 flex items-center justify-between border-b border-slate-200 print:hidden">
          {reportData && (
            <div className="text-sm text-slate-600">
              <span className="font-medium">{processedReportData?.length || 0}</span> {processedReportData?.length === 1 ? 'record' : 'records'} shown
              {searchTerm && reportData.length !== processedReportData?.length && (
                <span className="text-slate-500 ml-2">(filtered from {reportData.length})</span>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              disabled={!processedReportData || processedReportData.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={handleExportPDF}
              disabled={!processedReportData || processedReportData.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </button>
            <button
              onClick={handleExport}
              disabled={!processedReportData || processedReportData.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Report Data */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600"></div>
              <p className="mt-4 text-slate-600">Loading report data...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-red-800">Error Loading Report</h4>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          ) : (
            <div id="report-content-container">
              {activeReport === 'status' && <ReportByStatusEnhanced data={processedReportData} onSort={handleSort} sortConfig={sortConfig} onDrillDown={handleDrillDown} />}
              {activeReport === 'submitter' && <ReportBySubmitterEnhanced data={processedReportData} onSort={handleSort} sortConfig={sortConfig} onDrillDown={handleDrillDown} />}
              {activeReport === 'project' && <ReportByProjectEnhanced data={processedReportData} onSort={handleSort} sortConfig={sortConfig} onDrillDown={handleDrillDown} />}
              {activeReport === 'spending-project' && <SpendingByProjectEnhanced data={processedReportData} onSort={handleSort} sortConfig={sortConfig} onDrillDown={handleDrillDown} />}
              {activeReport === 'spending-account' && <SpendingByExpenseAccountEnhanced data={processedReportData} onSort={handleSort} sortConfig={sortConfig} onDrillDown={handleDrillDown} />}
              {activeReport === 'spending-project-account' && <SpendingByProjectAndExpenseAccountEnhanced data={processedReportData} onSort={handleSort} sortConfig={sortConfig} onDrillDown={handleDrillDown} />}
              {activeReport === 'spending-period' && <SpendingByTimePeriodEnhanced data={processedReportData} period={selectedPeriod} onSort={handleSort} sortConfig={sortConfig} onDrillDown={handleDrillDown} />}
              {activeReport === 'spending-trends' && <SpendingTrendsEnhanced data={processedReportData} onSort={handleSort} sortConfig={sortConfig} onDrillDown={handleDrillDown} />}
            </div>
          )}
        </div>
      </div>

      {/* Footer - Print Only */}
      <div className="hidden print:block mt-8 pt-4 border-t-2 border-black text-center text-sm text-slate-600">
        <p>This is a computer-generated report. No signature required.</p>
        <p className="mt-1">Generated on {new Date().toLocaleString()}</p>
      </div>

      {/* Drill-Down Modal */}
      {showDrillDown && drillDownData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-2xl font-bold text-slate-900">{drillDownTitle}</h3>
              <button
                onClick={closeDrillDown}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-slate-600" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-6">
              <div className="mb-4 text-sm text-slate-600">
                <span className="font-medium">{drillDownData.length}</span> requisition{drillDownData.length !== 1 ? 's' : ''} found
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border border-slate-200 rounded-lg">
                  <thead className="bg-slate-700 text-white">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Req #</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Amount</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {drillDownData.map((req, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                          {req.requisition_number || req.id}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            req.status === 'approved' ? 'bg-green-100 text-green-800' :
                            req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            req.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {STATUS_LABELS[req.status] || req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">
                          {formatCurrency(req.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {formatDate(req.created_at)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <a
                            href={`/requisitions/${req.id}`}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
              <button
                onClick={closeDrillDown}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Sortable Table Header Component
function SortableHeader({ label, sortKey, onSort, sortConfig, className = "" }) {
  const isSorted = sortConfig?.key === sortKey
  const direction = sortConfig?.direction

  return (
    <th
      className={`cursor-pointer hover:bg-slate-800 transition-colors ${className}`}
      onClick={() => onSort && onSort(sortKey)}
    >
      <div className="flex items-center gap-1 justify-between">
        <span>{label}</span>
        {onSort && (
          <span className="flex flex-col">
            {!isSorted && <ArrowUpDown className="w-3 h-3 opacity-50" />}
            {isSorted && direction === 'asc' && <ArrowUp className="w-3 h-3" />}
            {isSorted && direction === 'desc' && <ArrowDown className="w-3 h-3" />}
          </span>
        )}
      </div>
    </th>
  )
}

// Enhanced Report Components with Professional Styling
function ReportByStatusEnhanced({ data, onSort, sortConfig, onDrillDown }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No status data available</p>
      </div>
    )
  }

  const totalAmount = data.reduce((sum, item) => sum + (item.totalAmount || 0), 0)
  const totalCount = data.reduce((sum, item) => sum + (item.count || 0), 0)

  // Calculate metrics
  const approvedItem = data.find(item => item.status === 'approved')
  const rejectedItem = data.find(item => item.status === 'rejected')
  const pendingItem = data.find(item => item.status === 'pending' || item.status === 'under_review')

  const approvedCount = approvedItem?.count || 0
  const rejectedCount = rejectedItem?.count || 0
  const completedCount = approvedCount + rejectedCount
  const approvalRate = completedCount > 0 ? (approvedCount / completedCount) * 100 : 0
  const pendingCount = pendingItem?.count || 0

  // Prepare chart data
  const chartData = data.map(item => ({
    name: STATUS_LABELS[item.status] || item.status,
    count: item.count,
    amount: item.totalAmount / 1000, // Convert to thousands for better readability
    status: item.status
  }))

  // Prepare pie chart data
  const pieData = data.map(item => ({
    name: STATUS_LABELS[item.status] || item.status,
    value: item.count,
    status: item.status
  }))

  // Colors for different statuses
  const getStatusColor = (status) => {
    const colors = {
      'approved': '#10b981',
      'pending': '#f59e0b',
      'rejected': '#ef4444',
      'draft': '#6b7280',
      'under_review': '#3b82f6'
    }
    return colors[status] || '#94a3b8'
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-5 border border-blue-200 print:bg-white print:border-2 print:border-black">
          <p className="text-sm font-medium text-blue-900 mb-1">Total Requisitions</p>
          <p className="text-3xl font-bold text-blue-900">{totalCount}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-5 border border-emerald-200 print:bg-white print:border-2 print:border-black">
          <p className="text-sm font-medium text-emerald-900 mb-1">Total Value</p>
          <p className="text-3xl font-bold text-emerald-900">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-5 border border-amber-200 print:bg-white print:border-2 print:border-black">
          <p className="text-sm font-medium text-amber-900 mb-1">Average Value</p>
          <p className="text-3xl font-bold text-amber-900">
            {formatCurrency(totalCount > 0 ? totalAmount / totalCount : 0)}
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 p-6 print:bg-white print:border-2 print:border-black">
        <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          Key Performance Metrics
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
            <p className="text-sm font-medium text-slate-600 mb-1">Approval Rate</p>
            <p className="text-3xl font-bold text-blue-600">{approvalRate.toFixed(1)}%</p>
            <p className="text-xs text-slate-500 mt-1">
              {approvedCount} approved / {completedCount} completed
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-amber-100">
            <p className="text-sm font-medium text-slate-600 mb-1">Pending Review</p>
            <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-xs text-slate-500 mt-1">
              {totalCount > 0 ? ((pendingCount / totalCount) * 100).toFixed(1) : 0}% of total
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
            <p className="text-sm font-medium text-slate-600 mb-1">Average Value</p>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(approvedCount > 0 ? (approvedItem?.totalAmount || 0) / approvedCount : 0)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Per approved requisition</p>
          </div>
        </div>
      </div>

      {/* Chart Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        {/* Bar Chart */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h4 className="text-lg font-semibold text-slate-900 mb-4">Requisitions by Status</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: '#475569' }} label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#475569' }} label={{ value: 'Amount (K)', angle: 90, position: 'insideRight' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                formatter={(value, name) => {
                  if (name === 'amount') return [`$${value.toFixed(2)}K`, 'Amount']
                  return [value, 'Count']
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Count" radius={[8, 8, 0, 0]} />
              <Bar yAxisId="right" dataKey="amount" fill="#10b981" name="Amount (K)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h4 className="text-lg font-semibold text-slate-900 mb-4">Status Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden border border-slate-200 rounded-lg print:border-2 print:border-black">
        <table className="w-full">
          <thead className="bg-slate-700 text-white print:bg-slate-200 print:text-black">
            <tr>
              <SortableHeader label="Status" sortKey="status" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Count" sortKey="count" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Total Amount" sortKey="totalAmount" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider">% of Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {data.map((item, idx) => (
              <tr
                key={idx}
                className={`hover:bg-blue-50 transition-colors cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} print:bg-white print:cursor-default`}
                onClick={() => onDrillDown && item.requisitions && onDrillDown(
                  `${STATUS_LABELS[item.status] || item.status} Requisitions`,
                  item.requisitions
                )}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                      item.status === 'approved' ? 'bg-green-100 text-green-800' :
                      item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      item.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-slate-100 text-slate-800'
                    } print:bg-white print:border print:border-black`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-semibold text-slate-900">{item.count}</td>
                <td className="px-6 py-4 text-right font-semibold text-slate-900">{formatCurrency(item.totalAmount)}</td>
                <td className="px-6 py-4 text-right text-slate-600">
                  {((item.count / totalCount) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-semibold print:bg-slate-200 print:border-t-2 print:border-black">
            <tr>
              <td className="px-6 py-4 text-slate-900">TOTAL</td>
              <td className="px-6 py-4 text-right text-slate-900">{totalCount}</td>
              <td className="px-6 py-4 text-right text-slate-900">{formatCurrency(totalAmount)}</td>
              <td className="px-6 py-4 text-right text-slate-900">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// Spending By Expense Account Report
function SpendingByExpenseAccountEnhanced({ data, onSort, sortConfig, onDrillDown }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No expense account data available</p>
      </div>
    )
  }

  const totalSpent = data.reduce((sum, item) => sum + (item.totalSpent || 0), 0)
  const totalRequisitions = data.reduce((sum, item) => sum + (item.requisitionCount || 0), 0)

  // Prepare chart data - limit to top 10 for readability
  const chartData = [...data]
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10)
    .map(item => ({
      name: item.accountCode,
      approved: item.approvedSpent / 1000,
      pending: item.pendingSpent / 1000,
      total: item.totalSpent / 1000
    }))

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-5 border border-emerald-200 print:bg-white print:border-2 print:border-black">
          <p className="text-sm font-medium text-emerald-900 mb-1">Total Spent</p>
          <p className="text-3xl font-bold text-emerald-900">{formatCurrency(totalSpent)}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-5 border border-blue-200 print:bg-white print:border-2 print:border-black">
          <p className="text-sm font-medium text-blue-900 mb-1">Total Requisitions</p>
          <p className="text-3xl font-bold text-blue-900">{totalRequisitions}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-5 border border-purple-200 print:bg-white print:border-2 print:border-black">
          <p className="text-sm font-medium text-purple-900 mb-1">Expense Accounts</p>
          <p className="text-3xl font-bold text-purple-900">{data.length}</p>
        </div>
      </div>

      {/* Chart Visualization */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 print:hidden">
        <h4 className="text-lg font-semibold text-slate-900 mb-4">Top 10 Expense Accounts by Spending</h4>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fill: '#475569' }} label={{ value: 'Amount (K)', position: 'insideBottom', offset: -5 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#475569' }} width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              formatter={(value) => [`$${value.toFixed(2)}K`]}
            />
            <Legend />
            <Bar dataKey="approved" fill="#10b981" name="Approved" stackId="a" />
            <Bar dataKey="pending" fill="#f59e0b" name="Pending" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden border border-slate-200 rounded-lg print:border-2 print:border-black">
        <table className="w-full">
          <thead className="bg-slate-700 text-white print:bg-slate-200 print:text-black">
            <tr>
              <SortableHeader label="Account" sortKey="accountCode" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Total Spent" sortKey="totalSpent" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Approved" sortKey="approvedSpent" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Pending" sortKey="pendingSpent" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Requisitions" sortKey="requisitionCount" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider">% of Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {data.map((item, idx) => (
              <tr key={idx} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} print:bg-white`}>
                <td className="px-6 py-4">
                  <div>
                    <p className="font-semibold text-slate-900">{item.accountCode}</p>
                    <p className="text-sm text-slate-600">{item.accountName}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-semibold text-slate-900">{formatCurrency(item.totalSpent)}</td>
                <td className="px-6 py-4 text-right text-slate-700">{formatCurrency(item.approvedSpent)}</td>
                <td className="px-6 py-4 text-right text-slate-700">{formatCurrency(item.pendingSpent)}</td>
                <td className="px-6 py-4 text-right text-slate-700">{item.requisitionCount}</td>
                <td className="px-6 py-4 text-right text-slate-600">
                  {totalSpent > 0 ? ((item.totalSpent / totalSpent) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-semibold print:bg-slate-200 print:border-t-2 print:border-black">
            <tr>
              <td className="px-6 py-4 text-slate-900">TOTAL</td>
              <td className="px-6 py-4 text-right text-slate-900">{formatCurrency(totalSpent)}</td>
              <td className="px-6 py-4 text-right text-slate-900">-</td>
              <td className="px-6 py-4 text-right text-slate-900">-</td>
              <td className="px-6 py-4 text-right text-slate-900">{totalRequisitions}</td>
              <td className="px-6 py-4 text-right text-slate-900">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// Report By Submitter
function ReportBySubmitterEnhanced({ data, onSort, sortConfig, onDrillDown }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No submitter data available</p>
      </div>
    )
  }

  const totalRequisitions = data.reduce((sum, item) => sum + (item.totalRequisitions || 0), 0)
  const totalAmount = data.reduce((sum, item) => sum + (item.totalAmount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-5 border border-blue-200 print:bg-white print:border-2 print:border-black">
          <p className="text-sm font-medium text-blue-900 mb-1">Total Users</p>
          <p className="text-3xl font-bold text-blue-900">{data.length}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-5 border border-emerald-200 print:bg-white print:border-2 print:border-black">
          <p className="text-sm font-medium text-emerald-900 mb-1">Total Requisitions</p>
          <p className="text-3xl font-bold text-emerald-900">{totalRequisitions}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-5 border border-purple-200 print:bg-white print:border-2 print:border-black">
          <p className="text-sm font-medium text-purple-900 mb-1">Total Amount</p>
          <p className="text-3xl font-bold text-purple-900">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden border border-slate-200 rounded-lg print:border-2 print:border-black">
        <table className="w-full">
          <thead className="bg-slate-700 text-white print:bg-slate-200 print:text-black">
            <tr>
              <SortableHeader label="User" sortKey="userName" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Total Reqs" sortKey="totalRequisitions" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Approved" sortKey="approvedCount" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Pending" sortKey="pendingCount" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Rejected" sortKey="rejectedCount" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Total Amount" sortKey="totalAmount" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {data.map((item, idx) => (
              <tr
                key={idx}
                className={`hover:bg-blue-50 transition-colors cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} print:bg-white print:cursor-default`}
                onClick={() => onDrillDown && item.requisitions && onDrillDown(
                  `Requisitions by ${item.userName}`,
                  item.requisitions
                )}
              >
                <td className="px-6 py-4">
                  <div>
                    <p className="font-semibold text-slate-900">{item.userName}</p>
                    <p className="text-sm text-slate-600">{item.userEmail}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-semibold text-slate-900">{item.totalRequisitions}</td>
                <td className="px-6 py-4 text-right text-slate-700">{item.approvedCount || 0}</td>
                <td className="px-6 py-4 text-right text-slate-700">{item.pendingCount || 0}</td>
                <td className="px-6 py-4 text-right text-slate-700">{item.rejectedCount || 0}</td>
                <td className="px-6 py-4 text-right font-semibold text-slate-900">{formatCurrency(item.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Report By Project
function ReportByProjectEnhanced({ data, onSort, sortConfig, onDrillDown }) {
  return <SpendingByProjectEnhanced data={data} onSort={onSort} sortConfig={sortConfig} onDrillDown={onDrillDown} />
}

// Spending By Project & Expense Account
function SpendingByProjectAndExpenseAccountEnhanced({ data, onSort, sortConfig }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Folder className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {data.map((project, idx) => (
        <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden print:border-2 print:border-black print:page-break-inside-avoid">
          <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 print:bg-slate-200">
            <h3 className="text-lg font-bold text-slate-900">
              {project.projectCode} - {project.projectName}
            </h3>
          </div>
          <table className="w-full">
            <thead className="bg-slate-700 text-white print:bg-slate-200 print:text-black">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Expense Account</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Total Spent</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Approved</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Pending</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Requisitions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {project.expenseAccounts && project.expenseAccounts.length > 0 ? (
                project.expenseAccounts.map((account, accountIdx) => (
                  <tr key={accountIdx} className={accountIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-6 py-3">
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{account.accountCode}</p>
                        <p className="text-xs text-slate-600">{account.accountName}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-sm">{formatCurrency(account.totalSpent)}</td>
                    <td className="px-6 py-3 text-right text-sm">{formatCurrency(account.approvedSpent)}</td>
                    <td className="px-6 py-3 text-right text-sm">{formatCurrency(account.pendingSpent)}</td>
                    <td className="px-6 py-3 text-right text-sm">{account.requisitionCount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500 text-sm">
                    No expense accounts found for this project
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// Spending By Time Period
function SpendingByTimePeriodEnhanced({ data, period, onSort, sortConfig }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No period data available</p>
      </div>
    )
  }

  const totalSpent = data.reduce((sum, item) => sum + (item.totalSpent || 0), 0)

  // Prepare chart data
  const chartData = data.map(item => ({
    period: item.period,
    approved: item.approvedSpent / 1000,
    pending: item.pendingSpent / 1000,
    rejected: item.rejectedSpent / 1000,
    total: item.totalSpent / 1000
  }))

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200 print:bg-white print:border-2 print:border-black">
        <p className="text-sm font-medium text-blue-900 mb-2">Total Spending ({period})</p>
        <p className="text-4xl font-bold text-blue-900">{formatCurrency(totalSpent)}</p>
      </div>

      {/* Chart Visualization */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 print:hidden">
        <h4 className="text-lg font-semibold text-slate-900 mb-4">Spending by Period</h4>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fill: '#475569' }} />
            <YAxis tick={{ fill: '#475569' }} label={{ value: 'Amount (K)', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              formatter={(value) => [`$${value.toFixed(2)}K`]}
            />
            <Legend />
            <Bar dataKey="approved" fill="#10b981" name="Approved" stackId="a" />
            <Bar dataKey="pending" fill="#f59e0b" name="Pending" stackId="a" />
            <Bar dataKey="rejected" fill="#ef4444" name="Rejected" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden border border-slate-200 rounded-lg print:border-2 print:border-black">
        <table className="w-full">
          <thead className="bg-slate-700 text-white print:bg-slate-200 print:text-black">
            <tr>
              <SortableHeader label="Period" sortKey="period" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Total Spent" sortKey="totalSpent" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Approved" sortKey="approvedSpent" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Pending" sortKey="pendingSpent" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Requisitions" sortKey="requisitionCount" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {data.map((item, idx) => (
              <tr key={idx} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} print:bg-white`}>
                <td className="px-6 py-4 font-semibold text-slate-900">{item.period}</td>
                <td className="px-6 py-4 text-right font-semibold text-slate-900">{formatCurrency(item.totalSpent)}</td>
                <td className="px-6 py-4 text-right text-slate-700">{formatCurrency(item.approvedSpent)}</td>
                <td className="px-6 py-4 text-right text-slate-700">{formatCurrency(item.pendingSpent)}</td>
                <td className="px-6 py-4 text-right text-slate-700">{item.requisitionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Spending Trends
function SpendingTrendsEnhanced({ data, onSort, sortConfig }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No trend data available</p>
      </div>
    )
  }

  // Calculate forecast using linear regression
  const calculateForecast = (historicalData, periodsToForecast = 3) => {
    if (!historicalData || historicalData.length < 3) return []

    // Check if data has the required period field
    const lastItem = historicalData[historicalData.length - 1]
    if (!lastItem || !lastItem.period) return []

    // Simple linear regression
    const n = historicalData.length
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0

    historicalData.forEach((item, index) => {
      const x = index
      const y = item.approvedSpent || 0
      sumX += x
      sumY += y
      sumXY += x * y
      sumX2 += x * x
    })

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // Generate forecast periods
    const forecasts = []
    const lastPeriod = lastItem.period
    const [year, month] = lastPeriod.split('-').map(Number)

    for (let i = 1; i <= periodsToForecast; i++) {
      const forecastValue = slope * (n + i - 1) + intercept
      const nextMonth = month + i
      const nextYear = year + Math.floor((nextMonth - 1) / 12)
      const adjustedMonth = ((nextMonth - 1) % 12) + 1
      const forecastPeriod = `${nextYear}-${String(adjustedMonth).padStart(2, '0')}`

      forecasts.push({
        period: forecastPeriod,
        approvedSpent: forecastValue
      })
    }

    return forecasts
  }

  // Prepare chart data with forecasts
  const forecasts = calculateForecast(data, 3)
  const chartData = [
    ...data.map(item => ({
      period: item?.period || 'N/A',
      approved: (item?.approvedSpent || 0) / 1000,
      total: (item?.totalSpent || 0) / 1000,
      pending: (item?.pendingSpent || 0) / 1000,
      requisitions: item?.requisitionCount || 0
    })),
    ...forecasts.map(item => ({
      period: item?.period || 'N/A',
      forecast: (item?.approvedSpent || 0) / 1000
    }))
  ]

  // Calculate forecast insights
  const avgMonthlySpend = data.length > 0
    ? data.reduce((sum, item) => sum + (item?.approvedSpent || 0), 0) / data.length
    : 0
  const forecastedNextMonth = forecasts.length > 0 ? (forecasts[0]?.approvedSpent || 0) : 0
  const trendDirection = forecastedNextMonth > avgMonthlySpend ? 'increasing' : 'decreasing'
  const trendPercent = avgMonthlySpend > 0
    ? Math.abs(((forecastedNextMonth - avgMonthlySpend) / avgMonthlySpend) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Forecast Insights - Only show if we have enough data for forecasting */}
      {forecasts.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border-2 border-purple-200 p-6 print:bg-white print:border-2 print:border-black">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            Spending Forecast & Insights
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-purple-100">
            <p className="text-sm font-medium text-slate-600 mb-1">Next Month Forecast</p>
            <p className="text-3xl font-bold text-purple-600">{formatCurrency(forecastedNextMonth)}</p>
            <p className="text-xs text-slate-500 mt-1">
              Projected for {forecasts.length > 0 ? forecasts[0].period : 'N/A'}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
            <p className="text-sm font-medium text-slate-600 mb-1">Average Monthly Spend</p>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(avgMonthlySpend)}</p>
            <p className="text-xs text-slate-500 mt-1">Based on historical data</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-amber-100">
            <p className="text-sm font-medium text-slate-600 mb-1">Trend Direction</p>
            <div className="flex items-center gap-2">
              {trendDirection === 'increasing' ? (
                <TrendingUp className="w-8 h-8 text-amber-600" />
              ) : (
                <TrendingDown className="w-8 h-8 text-green-600" />
              )}
              <div>
                <p className={`text-2xl font-bold ${trendDirection === 'increasing' ? 'text-amber-600' : 'text-green-600'}`}>
                  {trendDirection === 'increasing' ? '+' : '-'}{trendPercent.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500">{trendDirection} trend</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-6 print:hidden">
        <h4 className="text-lg font-semibold text-slate-900 mb-4">Spending Trends Over Time</h4>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fill: '#475569' }} />
            <YAxis tick={{ fill: '#475569' }} label={{ value: 'Amount (K)', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              formatter={(value, name) => {
                if (name === 'Requisitions') return [value]
                return [`$${value.toFixed(2)}K`]
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={3} name="Approved Spent" dot={{ r: 5 }} activeDot={{ r: 7 }} />
            <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} name="Total Spent" dot={{ r: 4 }} strokeDasharray="5 5" />
            <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} name="Pending" dot={{ r: 4 }} />
            <Line type="monotone" dataKey="forecast" stroke="#9333ea" strokeWidth={2} name="Forecast" dot={{ r: 5 }} strokeDasharray="10 5" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden border border-slate-200 rounded-lg print:border-2 print:border-black">
        <table className="w-full">
          <thead className="bg-slate-700 text-white print:bg-slate-200 print:text-black">
            <tr>
              <SortableHeader label="Period" sortKey="period" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Approved Spent" sortKey="approvedSpent" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Change" sortKey="changeFromPrevious" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="% Change" sortKey="percentageChange" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
              <SortableHeader label="Requisitions" sortKey="requisitionCount" onSort={onSort} sortConfig={sortConfig} className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {data.map((item, idx) => {
              const change = item?.changeFromPrevious || 0
              const percentChange = item?.percentageChange || 0
              return (
                <tr key={idx} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} print:bg-white`}>
                  <td className="px-6 py-4 font-semibold text-slate-900">{item?.period || 'N/A'}</td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-900">{formatCurrency(item?.approvedSpent || 0)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(Math.abs(change))}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {percentChange > 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : percentChange < 0 ? (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      ) : (
                        <Minus className="w-4 h-4 text-slate-400" />
                      )}
                      <span className={
                        percentChange > 0 ? 'text-green-600' :
                        percentChange < 0 ? 'text-red-600' :
                        'text-slate-600'
                      }>
                        {Math.abs(percentChange).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-700">{item?.requisitionCount || 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ReportsEnhanced
