import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  ArrowLeft, Edit, DollarSign,
  CreditCard, CheckCircle, XCircle, AlertCircle,
  Loader, FileText
} from 'lucide-react'
import {
  getExpenseAccountById,
  getExpenseAccountStats,
  activateExpenseAccount,
  deleteExpenseAccount
} from '../../services/api/expenseAccounts'
import { formatDate, formatCurrency } from '../../utils/formatters'
import { logger } from '../../utils/logger'

const ExpenseAccountDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { profile } = useAuth()

  const [account, setAccount] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (id) {
      loadAccountDetails()
    }
  }, [id])

  const loadAccountDetails = async () => {
    setLoading(true)
    setError('')

    try {
      // Load all account data in parallel
      const [accountResult, statsResult] = await Promise.all([
        getExpenseAccountById(id),
        getExpenseAccountStats(id)
      ])

      if (accountResult.error) throw accountResult.error
      if (statsResult.error) throw statsResult.error

      setAccount(accountResult.data)
      setStats(statsResult.data)
    } catch (err) {
      logger.error('Error loading expense account details:', err)
      setError(err.message || 'Failed to load expense account details')
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async () => {
    if (!window.confirm('Are you sure you want to activate this expense account?')) return

    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await activateExpenseAccount(id)
      if (result.error) throw result.error

      setSuccess('Expense account activated successfully!')
      loadAccountDetails()
    } catch (err) {
      logger.error('Error activating expense account:', err)
      setError(err.message || 'Failed to activate expense account')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (!window.confirm('Are you sure you want to deactivate this expense account? It will no longer be available for new requisitions.')) return

    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await deleteExpenseAccount(id)
      if (result.error) throw result.error

      setSuccess('Expense account deactivated successfully!')
      loadAccountDetails()
    } catch (err) {
      logger.error('Error deactivating expense account:', err)
      setError(err.message || 'Failed to deactivate expense account')
    } finally {
      setActionLoading(false)
    }
  }


  // Only super admin can edit expense accounts
  const canEdit = profile?.role === 'super_admin'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading expense account details...</p>
        </div>
      </div>
    )
  }

  if (error && !account) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">{error}</p>
        <button
          onClick={() => navigate('/expense-accounts')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Back to Expense Accounts
        </button>
      </div>
    )
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Expense account not found</p>
        <button
          onClick={() => navigate('/expense-accounts')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Back to Expense Accounts
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/expense-accounts')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{account.code}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                account.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {account.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <h2 className="text-lg text-gray-600 mt-1">{account.name}</h2>
          </div>
          <div className="flex items-center gap-3">
            {canEdit && account.is_active && (
              <button
                onClick={() => navigate(`/expense-accounts/edit/${account.id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Edit className="w-5 h-5" />
                Edit
              </button>
            )}
            {canEdit && (
              account.is_active ? (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-gray-600">Total Requisitions</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_requisitions}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <p className="text-sm text-gray-600">Total Spent</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_spent)}</p>
            <p className="text-xs text-gray-500 mt-1">Approved requisitions</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              <p className="text-sm text-gray-600">Total Committed</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_committed)}</p>
            <p className="text-xs text-gray-500 mt-1">All requisitions</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Information */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Code</label>
              <p className="text-gray-900 mt-1 font-mono">{account.code}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Name</label>
              <p className="text-gray-900 mt-1">{account.name}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Description</label>
              <p className="text-gray-900 mt-1">{account.description || 'No description provided'}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Project</label>
              {account.project ? (
                <div className="mt-1">
                  <button
                    onClick={() => navigate(`/projects/${account.project.id}`)}
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {account.project.code} - {account.project.name}
                  </button>
                  {!account.project.is_active && (
                    <span className="ml-2 text-xs text-gray-500">(Inactive)</span>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 mt-1">No project assigned</p>
              )}
            </div>

            {account.created_by_user && (
              <div>
                <label className="text-sm font-medium text-gray-600">Created By</label>
                <p className="text-gray-900 mt-1">{account.created_by_user.full_name}</p>
                <p className="text-sm text-gray-500">{account.created_by_user.email}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-600">Created On</label>
              <p className="text-gray-900 mt-1">{formatDate(account.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Usage Overview */}
        {stats && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Overview</h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Total Requisitions</span>
                  <span className="text-sm font-bold text-gray-900">{stats.total_requisitions}</span>
                </div>
                <p className="text-xs text-gray-500">Requisitions using this account</p>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Total Items</span>
                  <span className="text-sm font-bold text-gray-900">{stats.total_items}</span>
                </div>
                <p className="text-xs text-gray-500">Line items using this account</p>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Approved Spending</span>
                  <span className="text-sm font-bold text-green-600">{formatCurrency(stats.total_spent)}</span>
                </div>
                <p className="text-xs text-gray-500">From approved requisitions</p>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Pending Spending</span>
                  <span className="text-sm font-bold text-blue-600">
                    {formatCurrency(stats.total_committed - stats.total_spent)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">From pending requisitions</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ExpenseAccountDetail
