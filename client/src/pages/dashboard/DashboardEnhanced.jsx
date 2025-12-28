import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  FileText, CheckCircle, Clock, XCircle, DollarSign, Users,
  Folder, AlertCircle, Plus, Eye, TrendingUp, TrendingDown,
  AlertTriangle, Mail, BarChart3, Calendar, ChevronDown
} from 'lucide-react'
import { getDashboardData } from '../../services/api/dashboard'
import { getUserProjects } from '../../services/api/requisitions'
import { formatDate, formatCurrency } from '../../utils/formatters'
import { STATUS_LABELS } from '../../utils/constants'
import ProjectBudgetCard from '../../components/dashboard/ProjectBudgetCard'
import { logger } from '../../utils/logger'

const DashboardEnhanced = () => {
  const navigate = useNavigate()
  const { user, profile, userRole } = useAuth()

  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [dateRange, setDateRange] = useState('all') // all, month, quarter, year, custom
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)

  useEffect(() => {
    loadDashboardData()
    loadProjects()
  }, [user, userRole, dateRange, customStartDate, customEndDate])

  const loadDashboardData = async () => {
    if (!user || !userRole) return

    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await getDashboardData(userRole, user.id)
      if (err) throw err
      setDashboardData(data)
    } catch (err) {
      logger.error('Error loading dashboard:', err)
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const loadProjects = async () => {
    if (!user || !profile) return

    try {
      const { data, error: err } = await getUserProjects(user.id, profile.role)
      if (err) throw err
      setProjects(data || [])
      if (data && data.length > 0) {
        setSelectedProjectId(data[0].id)
      }
    } catch (err) {
      logger.error('Error loading projects:', err)
    }
  }

  const getDateRangeLabel = () => {
    const labels = {
      all: 'All Time',
      month: 'This Month',
      quarter: 'This Quarter',
      year: 'This Year',
      custom: customStartDate && customEndDate ?
        `${formatDate(customStartDate)} - ${formatDate(customEndDate)}` :
        'Custom Range'
    }
    return labels[dateRange] || 'All Time'
  }

  const handleDateRangeChange = (range) => {
    setDateRange(range)
    if (range !== 'custom') {
      setShowDatePicker(false)
      setCustomStartDate('')
      setCustomEndDate('')
    } else {
      setShowDatePicker(true)
    }
  }

  const applyCustomDateRange = () => {
    if (customStartDate && customEndDate) {
      setShowDatePicker(false)
      // Trigger reload via useEffect
    }
  }

  const getStatusBadgeClass = (status) => {
    const statusColors = {
      draft: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
      under_review: 'bg-orange-100 text-orange-800',
      reviewed: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    }
    return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`
  }

  const getKeyMetrics = () => {
    if (!dashboardData?.stats) return []

    const { stats } = dashboardData

    if (userRole === 'super_admin') {
      return [
        {
          label: 'Total Requisitions',
          value: stats.total_requisitions || 0,
          icon: FileText,
          color: 'bg-blue-500',
          change: '+12%',
          trend: 'up'
        },
        {
          label: 'Total Amount',
          value: formatCurrency(stats.total_amount || 0),
          icon: DollarSign,
          color: 'bg-indigo-500',
          change: '+8%',
          trend: 'up'
        },
        {
          label: 'Approved Amount',
          value: formatCurrency(stats.approved_amount || 0),
          icon: CheckCircle,
          color: 'bg-green-500',
          change: '+15%',
          trend: 'up'
        },
        {
          label: 'Active Users',
          value: stats.total_users || 0,
          icon: Users,
          color: 'bg-purple-500',
          change: '+3',
          trend: 'up'
        }
      ]
    }

    // For other roles
    return [
      {
        label: 'Total Requisitions',
        value: stats.total || 0,
        icon: FileText,
        color: 'bg-blue-500'
      },
      {
        label: 'Total Amount',
        value: formatCurrency(stats.total_amount || 0),
        icon: DollarSign,
        color: 'bg-indigo-500'
      }
    ]
  }

  const getStatusBreakdown = () => {
    if (!dashboardData?.stats) return []

    const { stats } = dashboardData

    return [
      { label: 'Draft', value: stats.draft || 0, color: 'bg-gray-500' },
      { label: 'Pending', value: stats.pending || 0, color: 'bg-yellow-500' },
      { label: 'Under Review', value: stats.under_review || 0, color: 'bg-orange-500' },
      { label: 'Reviewed', value: stats.reviewed || 0, color: 'bg-blue-500' },
      { label: 'Approved', value: stats.approved || 0, color: 'bg-green-500' },
      { label: 'Rejected', value: stats.rejected || 0, color: 'bg-red-500' }
    ]
  }

  const getAlerts = () => {
    const alerts = []

    if (!dashboardData?.stats) return alerts

    const { stats, quickActions } = dashboardData

    // Pending reviews alert
    if (quickActions?.pendingReviews > 0) {
      alerts.push({
        type: 'warning',
        icon: AlertCircle,
        title: `${quickActions.pendingReviews} Requisitions Awaiting Review`,
        description: 'Review pending requisitions to keep workflow moving',
        action: 'Review Now',
        link: '/requisitions?status=pending,under_review'
      })
    }

    // Awaiting approval alert
    if (quickActions?.awaitingApproval > 0) {
      alerts.push({
        type: 'info',
        icon: CheckCircle,
        title: `${quickActions.awaitingApproval} Requisitions Ready for Approval`,
        description: 'These requisitions have been reviewed and need approval',
        action: 'Approve',
        link: '/requisitions?status=reviewed'
      })
    }

    // Draft alert
    if (quickActions?.drafts > 0) {
      alerts.push({
        type: 'default',
        icon: FileText,
        title: `${quickActions.drafts} Draft Requisitions`,
        description: 'Complete and submit your draft requisitions',
        action: 'View Drafts',
        link: '/requisitions?status=draft'
      })
    }

    return alerts
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-600 ml-4">Loading dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <XCircle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="text-red-900 font-semibold">Error Loading Dashboard</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={loadDashboardData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  const keyMetrics = getKeyMetrics()
  const statusBreakdown = getStatusBreakdown()
  const alerts = getAlerts()

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {profile?.full_name}!
          </h1>
          <p className="text-gray-600 mt-1">
            {userRole === 'super_admin' ? 'System Overview' : "Here's your dashboard"}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/requisitions')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-5 h-5" />
            View All
          </button>
          <button
            onClick={() => navigate('/requisitions/create')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Requisition
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
            <span className="text-sm font-semibold text-gray-900">{getDateRangeLabel()}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDateRangeChange('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                dateRange === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => handleDateRangeChange('month')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                dateRange === 'month'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => handleDateRangeChange('quarter')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                dateRange === 'quarter'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              This Quarter
            </button>
            <button
              onClick={() => handleDateRangeChange('year')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                dateRange === 'year'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              This Year
            </button>
            <button
              onClick={() => handleDateRangeChange('custom')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
                dateRange === 'custom'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Custom
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {showDatePicker && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">From:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">To:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                />
              </div>
              <button
                onClick={applyCustomDateRange}
                disabled={!customStartDate || !customEndDate}
                className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Apply
              </button>
              <button
                onClick={() => setShowDatePicker(false)}
                className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((alert, index) => {
            const Icon = alert.icon
            const alertColors = {
              warning: 'bg-orange-50 border-orange-200 text-orange-800',
              info: 'bg-blue-50 border-blue-200 text-blue-800',
              default: 'bg-gray-50 border-gray-200 text-gray-800'
            }
            return (
              <div
                key={index}
                className={`border rounded-lg p-4 ${alertColors[alert.type]}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm mb-1">{alert.title}</h3>
                    <p className="text-xs opacity-90 mb-3">{alert.description}</p>
                    <button
                      onClick={() => navigate(alert.link)}
                      className="text-xs font-medium hover:underline"
                    >
                      {alert.action} →
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {keyMetrics.map((metric, index) => {
          const Icon = metric.icon
          const TrendIcon = metric.trend === 'up' ? TrendingUp : TrendingDown
          return (
            <div key={index} className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${metric.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                {metric.change && (
                  <div className={`flex items-center gap-1 text-sm font-medium ${
                    metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <TrendIcon className="w-4 h-4" />
                    <span>{metric.change}</span>
                  </div>
                )}
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">
                {metric.label}
              </h3>
              <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
            </div>
          )
        })}
      </div>

      {/* Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Breakdown Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Status Distribution</h2>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {statusBreakdown.map((status, index) => {
              const total = statusBreakdown.reduce((sum, s) => sum + s.value, 0)
              const percentage = total > 0 ? Math.round((status.value / total) * 100) : 0
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${status.color}`}></div>
                      <span className="text-sm font-medium text-gray-700">{status.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{status.value}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${status.color}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Quick Stats</h2>
          <div className="space-y-4">
            {userRole === 'super_admin' && dashboardData?.stats && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Folder className="w-5 h-5 text-teal-500" />
                    <span className="text-sm text-gray-600">Projects</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    {dashboardData.stats.total_projects || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-500" />
                    <span className="text-sm text-gray-600">Active Users</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    {dashboardData.stats.total_users || 0}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-gray-600">Approval Rate</span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                {dashboardData?.stats ?
                  Math.round((dashboardData.stats.approved / dashboardData.stats.total_requisitions) * 100) || 0
                : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                <span className="text-sm text-gray-600">Avg. Time</span>
              </div>
              <span className="text-lg font-bold text-gray-900">3.2 days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Project Budget */}
      {projects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Project Budget</h2>
            {projects.length > 1 && (
              <select
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} - {project.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedProjectId && (
            <ProjectBudgetCard
              projectId={selectedProjectId}
              projectName={projects.find(p => p.id === selectedProjectId)?.name}
            />
          )}
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h2>
        {!dashboardData?.recentActivity || dashboardData.recentActivity.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No recent activity yet.</p>
            <p className="text-sm mt-2">Create your first requisition to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dashboardData.recentActivity.slice(0, 5).map((activity) => (
              <div
                key={activity.id}
                onClick={() => navigate(`/requisitions/${activity.id}`)}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {activity.requisition_number || 'DRAFT'}
                      </p>
                      <span className={getStatusBadgeClass(activity.status)}>
                        {STATUS_LABELS[activity.status] || activity.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{activity.title}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span>{activity.project?.name || 'No project'}</span>
                      <span>•</span>
                      <span>{formatDate(activity.updated_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="ml-4 text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(activity.total_amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DashboardEnhanced
