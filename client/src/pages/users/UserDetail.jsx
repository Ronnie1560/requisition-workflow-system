import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  Calendar,
  Save,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react'
import {
  getUserById,
  updateUser,
  updateUserRole,
  toggleUserStatus,
  assignUserToProject,
  removeUserFromProject
} from '../../services/api/users'
import { getAllProjects } from '../../services/api/projects'
import { formatDate } from '../../utils/formatters'
import { USER_ROLES, ROLE_LABELS } from '../../utils/constants'

const UserDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [userData, setUserData] = useState(null)
  const [allProjects, setAllProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showAddProject, setShowAddProject] = useState(false)
  const [selectedProject, setSelectedProject] = useState('')

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: '',
    employee_id: '',
    phone: '',
    department: ''
  })

  // Check if user is admin
  const isAdmin = profile?.role === 'super_admin'

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard')
      return
    }
    loadUserData()
    loadAllProjects()
  }, [id, isAdmin])

  const loadUserData = async () => {
    setLoading(true)
    const { data, error } = await getUserById(id)

    if (error) {
      setError('Failed to load user data')
      setLoading(false)
      return
    }

    setUserData(data)
    setFormData({
      full_name: data.full_name || '',
      email: data.email || '',
      role: data.role || '',
      employee_id: data.employee_id || '',
      phone: data.phone || '',
      department: data.department || ''
    })
    setLoading(false)
  }

  const loadAllProjects = async () => {
    // Load all active projects in the system
    const { data } = await getAllProjects({ is_active: true })
    if (data) setAllProjects(data)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleUpdateProfile = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error: updateError } = await updateUser(id, {
      full_name: formData.full_name,
      employee_id: formData.employee_id,
      phone: formData.phone,
      department: formData.department
    })

    if (updateError) {
      setError('Failed to update user profile')
      setSaving(false)
      return
    }

    setSuccess('User profile updated successfully')
    setSaving(false)
    loadUserData()
  }

  const handleUpdateRole = async () => {
    if (formData.role === userData.role) {
      setError('No changes to role')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error: roleError } = await updateUserRole(id, formData.role)

    if (roleError) {
      setError('Failed to update user role')
      setSaving(false)
      return
    }

    setSuccess('User role updated successfully')
    setSaving(false)
    loadUserData()
  }

  const handleToggleStatus = async () => {
    setSaving(true)
    setError(null)

    const { error: statusError } = await toggleUserStatus(id, !userData.is_active)

    if (statusError) {
      setError('Failed to toggle user status')
      setSaving(false)
      return
    }

    setSuccess(`User ${userData.is_active ? 'deactivated' : 'activated'} successfully`)
    setSaving(false)
    loadUserData()
  }

  const handleAddProject = async () => {
    if (!selectedProject) {
      setError('Please select a project')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error: assignError } = await assignUserToProject(
      id,
      selectedProject,
      'submitter',
      profile.id
    )

    if (assignError) {
      setError(assignError.message?.includes('duplicate')
        ? 'User is already assigned to this project'
        : 'Failed to assign project'
      )
      setSaving(false)
      return
    }

    setSuccess('Project assigned successfully')
    setSelectedProject('')
    setShowAddProject(false)
    setSaving(false)
    loadUserData()
  }

  const handleRemoveProject = async (assignmentId) => {
    if (!confirm('Are you sure you want to remove this project assignment?')) {
      return
    }

    setSaving(true)
    setError(null)

    const { error: removeError } = await removeUserFromProject(assignmentId)

    if (removeError) {
      setError('Failed to remove project assignment')
      setSaving(false)
      return
    }

    setSuccess('Project removed successfully')
    setSaving(false)
    loadUserData()
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

  // Get projects not yet assigned
  const unassignedProjects = allProjects.filter(
    p => !userData?.project_assignments?.some(a => a.project.id === p.id)
  )

  if (!isAdmin) {
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 mt-4">Loading user data...</p>
        </div>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">User not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/users')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{userData.full_name}</h1>
            <p className="text-sm text-gray-600 mt-1">{userData.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(userData.role)}`}>
              <Shield className="w-4 h-4" />
              {ROLE_LABELS[userData.role]}
            </span>
            {userData.is_active ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <UserCheck className="w-4 h-4" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                <UserX className="w-4 h-4" />
                Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <UserCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-green-800">Success</h3>
            <p className="text-sm text-green-700 mt-1">{success}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Information */}
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      disabled
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Employee ID
                    </label>
                    <input
                      type="text"
                      name="employee_id"
                      value={formData.employee_id}
                      onChange={handleInputChange}
                      placeholder="EMP-001"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+256 700 000000"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    placeholder="Finance"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={handleUpdateProfile}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Project Assignments */}
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Project Assignments</h2>
                {!showAddProject && unassignedProjects.length > 0 && (
                  <button
                    onClick={() => setShowAddProject(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Project
                  </button>
                )}
              </div>

              {/* Add Project Form */}
              {showAddProject && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex gap-3">
                    <select
                      value={selectedProject}
                      onChange={(e) => setSelectedProject(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">Select a project...</option>
                      {unassignedProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.code} - {project.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddProject}
                      disabled={saving || !selectedProject}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddProject(false)
                        setSelectedProject('')
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Project List */}
              {userData.project_assignments?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No project assignments yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {userData.project_assignments?.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {assignment.project.code} - {assignment.project.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          Assigned {formatDate(assignment.assigned_at)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveProject(assignment.id)}
                        disabled={saving}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        title="Remove project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Role Management */}
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Role & Access</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    User Role
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value={USER_ROLES.SUBMITTER}>{ROLE_LABELS[USER_ROLES.SUBMITTER]}</option>
                    <option value={USER_ROLES.REVIEWER}>{ROLE_LABELS[USER_ROLES.REVIEWER]}</option>
                    <option value={USER_ROLES.APPROVER}>{ROLE_LABELS[USER_ROLES.APPROVER]}</option>
                    <option value={USER_ROLES.STORE_MANAGER}>{ROLE_LABELS[USER_ROLES.STORE_MANAGER]}</option>
                    <option value={USER_ROLES.SUPER_ADMIN}>{ROLE_LABELS[USER_ROLES.SUPER_ADMIN]}</option>
                  </select>
                </div>

                {formData.role !== userData.role && (
                  <button
                    onClick={handleUpdateRole}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    Update Role
                  </button>
                )}

                <button
                  onClick={handleToggleStatus}
                  disabled={saving}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg ${
                    userData.is_active
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  } disabled:opacity-50`}
                >
                  {userData.is_active ? (
                    <>
                      <UserX className="w-4 h-4" />
                      Deactivate User
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      Activate User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">User Information</h2>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {formatDate(userData.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span>{userData.email}</span>
                </div>
                {userData.employee_id && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="w-4 h-4" />
                    <span>ID: {userData.employee_id}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserDetail
