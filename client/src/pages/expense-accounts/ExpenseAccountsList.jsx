import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Plus, CreditCard, Search, Filter, DollarSign, FolderOpen, AlertCircle } from 'lucide-react'
import { getAllExpenseAccounts } from '../../services/api/expenseAccounts'
import { logger } from '../../utils/logger'

const ExpenseAccountsList = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [allAccounts, setAllAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(true)

  useEffect(() => {
    loadAccounts()
  }, [statusFilter])

  const loadAccounts = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await getAllExpenseAccounts({ is_active: statusFilter })
      if (error) throw error
      setAllAccounts(data || [])
    } catch (err) {
      logger.error('Error loading expense accounts:', err)
      setError(err.message || 'Failed to load expense accounts. Please try again.')
      setAllAccounts([])
    } finally {
      setLoading(false)
    }
  }

  // Real-time filtering using useMemo
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) {
      return allAccounts
    }

    const query = searchQuery.toLowerCase().trim()

    return allAccounts.filter((account) => {
      // Search in code, name, description, and project name
      const matchesCode = account.code?.toLowerCase().includes(query)
      const matchesName = account.name?.toLowerCase().includes(query)
      const matchesDescription = account.description?.toLowerCase().includes(query)
      const matchesProjectCode = account.project?.code?.toLowerCase().includes(query)
      const matchesProjectName = account.project?.name?.toLowerCase().includes(query)

      return (
        matchesCode ||
        matchesName ||
        matchesDescription ||
        matchesProjectCode ||
        matchesProjectName
      )
    })
  }, [allAccounts, searchQuery])

  // Check if user can create expense accounts (admins only)
  const canCreateAccount = profile?.role === 'super_admin'

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Accounts</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage expense account codes and categories
          </p>
        </div>
        {canCreateAccount && (
          <button
            onClick={() => navigate('/expense-accounts/create')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-5 h-5" />
            New Account
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">
            {searchQuery ? 'Filtered Results' : 'Total Accounts'}
          </p>
          <p className="text-2xl font-bold text-gray-900">{filteredAccounts.length}</p>
          {searchQuery && (
            <p className="text-xs text-gray-500 mt-1">of {allAccounts.length} total</p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-green-600">
            {filteredAccounts.filter(a => a.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Inactive</p>
          <p className="text-2xl font-bold text-gray-500">
            {filteredAccounts.filter(a => !a.is_active).length}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={loadAccounts}
              className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Real-time Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by code, name, project, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Clear search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value === 'true')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
              >
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Search hint */}
        {searchQuery && (
          <p className="mt-2 text-xs text-gray-500">
            Showing {filteredAccounts.length} result{filteredAccounts.length !== 1 ? 's' : ''} for "{searchQuery}"
          </p>
        )}
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600 mt-4">Loading expense accounts...</p>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No expense accounts found</p>
            <p className="text-sm text-gray-500 mb-6">
              {searchQuery
                ? `No results for "${searchQuery}". Try a different search term.`
                : 'Create your first expense account to get started'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 mb-4"
              >
                Clear Search
              </button>
            )}
            {canCreateAccount && !searchQuery && (
              <button
                onClick={() => navigate('/expense-accounts/create')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5" />
                Create Account
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAccounts.map((account) => (
                  <tr
                    key={account.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/expense-accounts/${account.id}`)}
                  >
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
                      {account.project ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-medium">{account.project.code}</span>
                          <span className="text-gray-400">-</span>
                          <span>{account.project.name}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">No project</span>
                      )}
                    </td>
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
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/expense-accounts/${account.id}`)
                        }}
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

export default ExpenseAccountsList
