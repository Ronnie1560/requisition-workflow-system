import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  ArrowLeft, Edit, Calendar, DollarSign, Users,
  FolderOpen, CheckCircle, XCircle, AlertCircle,
  Loader, FileText, CreditCard
} from 'lucide-react'
import {
  getProjectById,
  getProjectStats,
  getProjectTeam,
  getProjectExpenseAccounts,
  activateProject,
  deleteProject
} from '../../services/api/projects'
import { formatDate, formatCurrency } from '../../utils/formatters'
import { logger } from '../../utils/logger'

const ProjectDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { profile } = useAuth()

  const [project, setProject] = useState(null)
  const [stats, setStats] = useState(null)
  const [team, setTeam] = useState([])
  const [expenseAccounts, setExpenseAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (id) {
      loadProjectDetails()
    }
  }, [id])

  const loadProjectDetails = async () => {
    setLoading(true)
    setError('')

    try {
      // Load all project data in parallel
      const [projectResult, statsResult, teamResult, accountsResult] = await Promise.all([
        getProjectById(id),
        getProjectStats(id),
        getProjectTeam(id),
        getProjectExpenseAccounts(id)
      ])

      if (projectResult.error) throw projectResult.error
      if (statsResult.error) throw statsResult.error
      if (teamResult.error) throw teamResult.error
      if (accountsResult.error) throw accountsResult.error

      setProject(projectResult.data)
      setStats(statsResult.data)
      setTeam(teamResult.data || [])
      setExpenseAccounts(accountsResult.data || [])
    } catch (err) {
      logger.error('Error loading project details:', err)
      setError(err.message || 'Failed to load project details')
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async () => {
    if (!window.confirm('Are you sure you want to activate this project?')) return

    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await activateProject(id)
      if (result.error) throw result.error

      setSuccess('Project activated successfully!')
      loadProjectDetails()
    } catch (err) {
      logger.error('Error activating project:', err)
      setError(err.message || 'Failed to activate project')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (!window.confirm('Are you sure you want to deactivate this project? It will no longer be available for new requisitions.')) return

    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await deleteProject(id)
      if (result.error) throw result.error

      setSuccess('Project deactivated successfully!')
      loadProjectDetails()
    } catch (err) {
      logger.error('Error deactivating project:', err)
      setError(err.message || 'Failed to deactivate project')
    } finally {
      setActionLoading(false)
    }
  }


  const getProjectStatus = () => {
    if (!project) return { label: 'Unknown', color: 'bg-gray-500' }
    if (!project.is_active) return { label: 'Inactive', color: 'bg-gray-500' }

    const now = new Date()
    const startDate = project.start_date ? new Date(project.start_date) : null
    const endDate = project.end_date ? new Date(project.end_date) : null

    if (endDate && endDate < now) {
      return { label: 'Completed', color: 'bg-blue-500' }
    }
    if (startDate && startDate > now) {
      return { label: 'Planned', color: 'bg-yellow-500' }
    }
    return { label: 'Active', color: 'bg-green-500' }
  }

  // Only super admin can edit projects
  const canEdit = profile?.role === 'super_admin'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading project details...</p>
        </div>
      </div>
    )
  }

  if (error && !project) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">{error}</p>
        <button
          onClick={() => navigate('/projects')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Back to Projects
        </button>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Project not found</p>
        <button
          onClick={() => navigate('/projects')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Back to Projects
        </button>
      </div>
    )
  }

  const status = getProjectStatus()

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{project.code}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${status.color}`}>
                {status.label}
              </span>
            </div>
            <h2 className="text-lg text-gray-600 mt-1">{project.name}</h2>
          </div>
          <div className="flex items-center gap-3">
            {canEdit && project.is_active && (
              <button
                onClick={() => navigate(`/projects/edit/${project.id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Edit className="w-5 h-5" />
                Edit
              </button>
            )}
            {canEdit && (
              project.is_active ? (
                <button
                  onClick={handleDeactivate}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  Deactivate
                </button>
              ) : (
                <button
                  onClick={handleActivate}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  Activate
                </button>
              )
            )}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <p className="text-sm text-gray-600">Total Requisitions</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_requisitions}</p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.pending_requisitions} pending, {stats.approved_requisitions} approved
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <p className="text-sm text-gray-600">Total Spent</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_spent)}</p>
            {project.budget && (
              <p className="text-xs text-gray-500 mt-1">
                of {formatCurrency(project.budget)} budget
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-gray-600">Team Members</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.assigned_users}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <CreditCard className="w-5 h-5 text-purple-600" />
              <p className="text-sm text-gray-600">Expense Accounts</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.expense_accounts}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Information */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h3>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Description</label>
              <p className="text-gray-900 mt-1">{project.description || 'No description provided'}</p>
            </div>

            {project.start_date && (
              <div>
                <label className="text-sm font-medium text-gray-600">Start Date</label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900">{formatDate(project.start_date)}</p>
                </div>
              </div>
            )}

            {project.end_date && (
              <div>
                <label className="text-sm font-medium text-gray-600">End Date</label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900">{formatDate(project.end_date)}</p>
                </div>
              </div>
            )}

            {project.budget && (
              <div>
                <label className="text-sm font-medium text-gray-600">Budget</label>
                <div className="flex items-center gap-2 mt-1">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900">{formatCurrency(project.budget)}</p>
                </div>
              </div>
            )}

            {project.created_by_user && (
              <div>
                <label className="text-sm font-medium text-gray-600">Created By</label>
                <p className="text-gray-900 mt-1">{project.created_by_user.full_name}</p>
                <p className="text-sm text-gray-500">{project.created_by_user.email}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-600">Created On</label>
              <p className="text-gray-900 mt-1">{formatDate(project.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Budget Overview */}
        {project.budget && stats && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Overview</h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Total Budget</span>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(project.budget)}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Approved Spending</span>
                  <span className="text-sm font-bold text-green-600">{formatCurrency(stats.total_spent)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${Math.min((stats.total_spent / project.budget) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {((stats.total_spent / project.budget) * 100).toFixed(1)}% of budget
                </p>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Total Committed</span>
                  <span className="text-sm font-bold text-blue-600">{formatCurrency(stats.total_committed)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${Math.min((stats.total_committed / project.budget) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {((stats.total_committed / project.budget) * 100).toFixed(1)}% of budget
                </p>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Remaining Budget</span>
                  <span className="text-sm font-bold text-indigo-600">
                    {formatCurrency(Math.max(project.budget - stats.total_spent, 0))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="mt-6 bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
          <p className="text-sm text-gray-600 mt-1">Users assigned to this project</p>
        </div>

        {team.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No team members assigned yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">System Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {team.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {member.user?.full_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {member.user?.email || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="capitalize">{member.user?.role?.replace('_', ' ') || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="capitalize">{member.project_role || 'member'}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(member.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expense Accounts */}
      <div className="mt-6 bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Expense Accounts</h3>
          <p className="text-sm text-gray-600 mt-1">Expense accounts linked to this project</p>
        </div>

        {expenseAccounts.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No expense accounts linked to this project yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {expenseAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="font-medium text-gray-900">{account.code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{account.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {account.description || 'No description'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        account.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {account.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/expense-accounts/${account.id}`)}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectDetail
