import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOrganization } from '../../context/OrganizationContext'
import { FileText, CheckCircle, Clock, XCircle, DollarSign, Users, Folder, AlertCircle, Plus, Eye, ArrowRight, Edit, ClipboardCheck } from 'lucide-react'
import { getDashboardData } from '../../services/api/dashboard'
import { getUserProjects } from '../../services/api/requisitions'
import { formatDate, formatCurrency } from '../../utils/formatters'
import { STATUS_LABELS } from '../../utils/constants'
import ProjectBudgetCard from '../../components/dashboard/ProjectBudgetCard'
import DefaultOrgBanner from '../../components/organizations/DefaultOrgBanner'
import { logger } from '../../utils/logger'

const Dashboard = () => {
  const navigate = useNavigate()
  const { user, profile, userRole } = useAuth()
  const { currentOrg, loading: orgLoading } = useOrganization()

  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)

  useEffect(() => {
    // Wait for organization context to be ready
    if (orgLoading || !currentOrg) return

    loadDashboardData()
    loadProjects()
  }, [user, userRole, currentOrg, orgLoading])

  const loadDashboardData = async () => {
    if (!user || !userRole || !currentOrg) return

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
    if (!user || !profile || !currentOrg) return

    try {
      const { data, error: err } = await getUserProjects(user.id, profile.role)
      if (err) throw err
      setProjects(data || [])
      // Auto-select first project if available
      if (data && data.length > 0) {
        setSelectedProjectId(data[0].id)
      }
    } catch (err) {
      logger.error('Error loading projects:', err)
    }
  }

  const getStatsConfig = () => {
    if (!dashboardData?.stats) return []

    const { stats } = dashboardData

    switch (userRole) {
      case 'submitter':
        return [
          { name: 'Total Requisitions', value: stats.total, icon: FileText, color: 'bg-blue-500' },
          { name: 'Draft', value: stats.draft, icon: FileText, color: 'bg-gray-500' },
          { name: 'Pending Review', value: stats.pending, icon: Clock, color: 'bg-yellow-500', highlight: stats.pending > 0 },
          { name: 'Under Review', value: stats.under_review, icon: AlertCircle, color: 'bg-orange-500' },
          { name: 'Reviewed', value: stats.reviewed, icon: CheckCircle, color: 'bg-blue-500' },
          { name: 'Approved', value: stats.approved, icon: CheckCircle, color: 'bg-green-500' },
          { name: 'Rejected', value: stats.rejected, icon: XCircle, color: 'bg-red-500' },
          { name: 'Total Amount', value: formatCurrency(stats.total_amount), icon: DollarSign, color: 'bg-indigo-500' }
        ]

      case 'reviewer':
        return [
          { name: 'Total Requisitions', value: stats.total, icon: FileText, color: 'bg-blue-500' },
          { name: 'Awaiting Action', value: stats.awaiting_action, icon: AlertCircle, color: 'bg-orange-500', highlight: stats.awaiting_action > 0 },
          { name: 'Pending', value: stats.pending, icon: Clock, color: 'bg-yellow-500' },
          { name: 'Under Review', value: stats.under_review, icon: AlertCircle, color: 'bg-orange-500' },
          { name: 'Reviewed', value: stats.reviewed, icon: CheckCircle, color: 'bg-blue-500' },
          { name: 'Approved', value: stats.approved, icon: CheckCircle, color: 'bg-green-500' },
          { name: 'Rejected', value: stats.rejected, icon: XCircle, color: 'bg-red-500' },
          { name: 'Total Amount', value: formatCurrency(stats.total_amount), icon: DollarSign, color: 'bg-indigo-500' }
        ]

      case 'approver':
        return [
          { name: 'Total in Queue', value: stats.total, icon: FileText, color: 'bg-blue-500' },
          { name: 'Awaiting Approval', value: stats.awaiting_approval, icon: AlertCircle, color: 'bg-orange-500', highlight: stats.awaiting_approval > 0 },
          { name: 'Reviewed', value: stats.reviewed, icon: CheckCircle, color: 'bg-blue-500' },
          { name: 'Approved', value: stats.approved, icon: CheckCircle, color: 'bg-green-500' },
          { name: 'Rejected', value: stats.rejected, icon: XCircle, color: 'bg-red-500' },
          { name: 'Approved Amount', value: formatCurrency(stats.approved_amount), icon: DollarSign, color: 'bg-green-500' },
          { name: 'Total Amount', value: formatCurrency(stats.total_amount), icon: DollarSign, color: 'bg-indigo-500' }
        ]

      case 'super_admin':
        return [
          { name: 'Total Requisitions', value: stats.total_requisitions, icon: FileText, color: 'bg-blue-500' },
          { name: 'Active Users', value: stats.total_users, icon: Users, color: 'bg-purple-500' },
          { name: 'Active Projects', value: stats.total_projects, icon: Folder, color: 'bg-teal-500' },
          { name: 'Draft', value: stats.draft, icon: FileText, color: 'bg-gray-500' },
          { name: 'Pending', value: stats.pending, icon: Clock, color: 'bg-yellow-500' },
          { name: 'Under Review', value: stats.under_review, icon: AlertCircle, color: 'bg-orange-500' },
          { name: 'Reviewed', value: stats.reviewed, icon: CheckCircle, color: 'bg-blue-500' },
          { name: 'Approved', value: stats.approved, icon: CheckCircle, color: 'bg-green-500' },
          { name: 'Rejected', value: stats.rejected, icon: XCircle, color: 'bg-red-500' },
          { name: 'Total Amount', value: formatCurrency(stats.total_amount), icon: DollarSign, color: 'bg-indigo-500' },
          { name: 'Approved Amount', value: formatCurrency(stats.approved_amount), icon: DollarSign, color: 'bg-green-500' }
        ]

      default:
        return []
    }
  }

  const getStatusBadgeClass = (status) => {
    const baseClass = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'

    // Map status to complete Tailwind classes (can't use dynamic class construction)
    const statusStyles = {
      'draft': 'bg-gray-100 text-gray-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'under_review': 'bg-blue-100 text-blue-800',
      'reviewed': 'bg-blue-100 text-blue-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'cancelled': 'bg-gray-100 text-gray-600',
      'partially_received': 'bg-purple-100 text-purple-800',
      'completed': 'bg-indigo-100 text-indigo-800'
    }

    const colorClass = statusStyles[status] || 'bg-gray-100 text-gray-800'
    return `${baseClass} ${colorClass}`
  }

  const getDashboardSubtitle = () => {
    switch (userRole) {
      case 'reviewer': return 'Review and process pending requisitions'
      case 'approver': return 'Approve or reject reviewed requisitions'
      case 'super_admin': return 'System-wide overview and management'
      default: return "Here's an overview of your requisitions"
    }
  }

  const getQuickActions = () => {
    if (!dashboardData?.quickActions) return []

    const actions = []
    const { quickActions } = dashboardData

    // Draft Requisitions (for submitters and admins)
    if (quickActions.drafts !== undefined) {
      actions.push({
        title: 'Draft Requisitions',
        description: 'Continue working on your drafts',
        count: quickActions.drafts,
        icon: Edit,
        color: 'bg-gray-500',
        borderColor: 'border-gray-300',
        hoverColor: 'hover:border-gray-400',
        link: '/requisitions?status=draft'
      })
    }

    // Pending Reviews (for reviewers and admins)
    if (quickActions.pendingReviews !== undefined) {
      actions.push({
        title: 'Pending Reviews',
        description: 'Requisitions waiting for your review',
        count: quickActions.pendingReviews,
        icon: AlertCircle,
        color: 'bg-orange-500',
        borderColor: 'border-orange-300',
        hoverColor: 'hover:border-orange-400',
        link: '/requisitions?status=pending,under_review',
        highlight: quickActions.pendingReviews > 0
      })
    }

    // Awaiting Approval (for approvers and admins)
    if (quickActions.awaitingApproval !== undefined) {
      actions.push({
        title: 'Awaiting Approval',
        description: 'Reviewed requisitions ready for approval',
        count: quickActions.awaitingApproval,
        icon: ClipboardCheck,
        color: 'bg-blue-500',
        borderColor: 'border-blue-300',
        hoverColor: 'hover:border-blue-400',
        link: '/requisitions?status=reviewed',
        highlight: quickActions.awaitingApproval > 0
      })
    }

    return actions
  }

  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-600 ml-4">
          {orgLoading ? 'Loading organization...' : 'Loading dashboard...'}
        </p>
      </div>
    )
  }

  if (!currentOrg) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <XCircle className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Organization Selected</h3>
        <p className="text-gray-600 mb-4">Please select or create an organization to continue.</p>
        <button
          onClick={() => navigate('/settings/organization')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Go to Organizations
        </button>
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

  const stats = getStatsConfig()
  const quickActions = getQuickActions()

  return (
    <div>
      {/* Default Organization Banner */}
      <DefaultOrgBanner />

      {/* Welcome Section */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {profile?.full_name || 'User'}!
          </h1>
          <p className="text-gray-600">
            {getDashboardSubtitle()}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/requisitions')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Eye className="w-5 h-5" />
            View All
          </button>
          <button
            onClick={() => navigate('/requisitions/create')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-5 h-5" />
            New Requisition
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <div
                  key={action.title}
                  onClick={() => navigate(action.link)}
                  className={`bg-white rounded-lg shadow border-2 ${action.borderColor} ${action.hoverColor} p-6 cursor-pointer transition-all ${
                    action.highlight ? 'ring-2 ring-orange-100' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`${action.color} w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-gray-900">{action.count}</p>
                      {action.highlight && action.count > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 mt-1">
                          Action Needed
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {action.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {action.description}
                  </p>
                  <div className="flex items-center text-sm font-medium text-indigo-600">
                    View all
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Project Budget Card */}
      {projects.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Project Budget</h2>
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.name}
              className={`bg-white rounded-lg shadow p-6 border ${
                stat.highlight ? 'border-orange-400 ring-2 ring-orange-100' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                {stat.highlight && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Action Required
                  </span>
                )}
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">
                {stat.name}
              </h3>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Recent Activity
        </h2>
        {!dashboardData?.recentActivity || dashboardData.recentActivity.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No recent activity yet.</p>
            <p className="text-sm mt-2">
              Create your first requisition to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {dashboardData.recentActivity.map((activity) => (
              <div
                key={activity.id}
                onClick={() => navigate(`/requisitions/${activity.id}`)}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex-shrink-0">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {activity.requisition_number || 'DRAFT'}
                      </p>
                      <span className={getStatusBadgeClass(activity.status)}>
                        {STATUS_LABELS[activity.status] || activity.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate mb-1">
                      {activity.title}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{activity.project?.name || 'No project'}</span>
                      <span>•</span>
                      <span>{activity.submitted_by_user?.full_name || 'Unknown'}</span>
                      <span>•</span>
                      <span>{formatDate(activity.updated_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4">
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

export default Dashboard
