import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Users as UsersIcon,
  Plus,
  Search,
  Filter,
  Edit,
  UserCheck,
  UserX,
  Shield,
  Mail
} from 'lucide-react'
import { getAllUsers, getUserStats, toggleUserStatus, resendInvitation } from '../../services/api/users'
import { formatDate } from '../../utils/formatters'
import { USER_ROLES, ROLE_LABELS } from '../../utils/constants'
import { logger } from '../../utils/logger'

const UsersList = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resendingInvitation, setResendingInvitation] = useState(null)
  const [filters, setFilters] = useState({
    role: '',
    is_active: true,
    search: ''
  })

  // Check if user is admin
  const isAdmin = profile?.role === 'super_admin'

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const { data, error: fetchError } = await getAllUsers({
      role: filters.role,
      is_active: filters.is_active,
      search: filters.search
    })

    if (fetchError) {
      logger.error('Error loading users:', fetchError)
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }, [filters.role, filters.is_active, filters.search])

  useEffect(() => {
    const loadStats = async () => {
      const { data } = await getUserStats()
      if (data) setStats(data)
    }
    
    if (!isAdmin) {
      navigate('/dashboard')
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial data load is intentional
    loadUsers()
    loadStats()
  }, [isAdmin, navigate, loadUsers])

  const handleToggleStatus = async (userId, currentStatus) => {
    const { error } = await toggleUserStatus(userId, !currentStatus)
    if (error) {
      logger.error('Error toggling user status:', error)
    } else {
      // Trigger re-fetch by updating a filter slightly
      setFilters(prev => ({ ...prev }))
    }
  }

  const handleResendInvitation = async (userId, email, fullName) => {
    if (!window.confirm(`Resend invitation to ${fullName} (${email})?`)) {
      return
    }

    setResendingInvitation(userId)
    const { error } = await resendInvitation(userId, email)
    setResendingInvitation(null)

    if (error) {
      logger.error('Error resending invitation:', error)
      alert(`Failed to resend invitation: ${error.message}`)
    } else {
      alert(`Invitation resent successfully to ${email}`)
    }
  }

  const getRoleBadgeColor = (role) => {
    const colors = {
      [USER_ROLES.SUPER_ADMIN]: 'bg-purple-100 text-purple-800',
      [USER_ROLES.APPROVER]: 'bg-blue-100 text-blue-800',
      [USER_ROLES.REVIEWER]: 'bg-green-100 text-green-800',
      [USER_ROLES.STORE_MANAGER]: 'bg-orange-100 text-orange-800',
      [USER_ROLES.SUBMITTER]: 'bg-gray-100 text-gray-800'
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  const getOrgRoleBadgeColor = (orgRole) => {
    const colors = {
      'owner': 'bg-indigo-100 text-indigo-800',
      'admin': 'bg-blue-100 text-blue-800',
      'member': 'bg-gray-100 text-gray-800'
    }
    return colors[orgRole] || 'bg-gray-100 text-gray-800'
  }

  const filteredUsers = users.filter(user => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      return (
        user.full_name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.employee_id?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  if (!isAdmin) {
    return null
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users & Permissions</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage team members, workflow roles, organization access, and project assignments
          </p>
        </div>
        <button
          onClick={() => navigate('/users/invite')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-5 h-5" />
          Invite User
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Total Users</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Inactive</p>
            <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Approvers</p>
            <p className="text-2xl font-bold text-blue-600">{stats.byRole.approver}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Admins</p>
            <p className="text-2xl font-bold text-purple-600">{stats.byRole.super_admin}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Role Filter */}
          <div className="sm:w-48">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={filters.role}
                onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
              >
                <option value="">All Roles</option>
                <option value={USER_ROLES.SUBMITTER}>{ROLE_LABELS[USER_ROLES.SUBMITTER]}</option>
                <option value={USER_ROLES.REVIEWER}>{ROLE_LABELS[USER_ROLES.REVIEWER]}</option>
                <option value={USER_ROLES.APPROVER}>{ROLE_LABELS[USER_ROLES.APPROVER]}</option>
                <option value={USER_ROLES.STORE_MANAGER}>{ROLE_LABELS[USER_ROLES.STORE_MANAGER]}</option>
                <option value={USER_ROLES.SUPER_ADMIN}>{ROLE_LABELS[USER_ROLES.SUPER_ADMIN]}</option>
              </select>
            </div>
          </div>

          {/* Status Filter */}
          <div className="sm:w-40">
            <select
              value={filters.is_active}
              onChange={(e) => setFilters({ ...filters, is_active: e.target.value === 'true' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
            >
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>

          <button
            onClick={loadUsers}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Search
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600 mt-4">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No users found</p>
            <p className="text-sm text-gray-500 mb-6">
              {filters.search || filters.role
                ? 'Try adjusting your filters'
                : 'Invite your first user to get started'}
            </p>
            {!filters.search && !filters.role && (
              <button
                onClick={() => navigate('/users/invite')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5" />
                Invite User
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Workflow Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Org Access
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Projects
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-indigo-600 font-semibold">
                            {user.full_name?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {user.full_name}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                        {user.role === USER_ROLES.SUPER_ADMIN && <Shield className="w-3 h-3" />}
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.org_role ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getOrgRoleBadgeColor(user.org_role)}`}>
                          {user.org_role === 'owner' && <Shield className="w-3 h-3" />}
                          {user.org_role.charAt(0).toUpperCase() + user.org_role.slice(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No access</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.project_assignments?.length || 0} projects
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <UserCheck className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <UserX className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleResendInvitation(user.id, user.email, user.full_name)}
                          disabled={resendingInvitation === user.id}
                          className="text-blue-600 hover:text-blue-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                          title="Resend invitation email"
                        >
                          {resendingInvitation === user.id ? (
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Mail className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => navigate(`/users/${user.id}`)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit user"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(user.id, user.is_active)}
                          className={user.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
                          title={user.is_active ? 'Deactivate user' : 'Activate user'}
                        >
                          {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </div>
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

export default UsersList
