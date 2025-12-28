import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Mail,
  User,
  Shield,
  ArrowLeft,
  Send,
  AlertCircle
} from 'lucide-react'
import { inviteUser } from '../../services/api/users'
import { getAllProjects } from '../../services/api/projects'
import { USER_ROLES, ROLE_LABELS } from '../../utils/constants'

const InviteUser = () => {
  const navigate = useNavigate()
  const { profile, user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [availableProjects, setAvailableProjects] = useState([])

  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    role: USER_ROLES.SUBMITTER,
    projects: []
  })

  // Check if user is admin
  const isAdmin = profile?.role === 'super_admin'

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard')
      return
    }
    loadProjects()
  }, [isAdmin])

  const loadProjects = async () => {
    // Load all projects (admin can see all)
    const { data, error } = await getAllProjects({ is_active: true })
    if (data) {
      setAvailableProjects(data)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleProjectToggle = (projectId) => {
    setFormData(prev => ({
      ...prev,
      projects: prev.projects.includes(projectId)
        ? prev.projects.filter(id => id !== projectId)
        : [...prev.projects, projectId]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validate form
    if (!formData.email || !formData.fullName || !formData.role) {
      setError('Please fill in all required fields')
      setLoading(false)
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    // Send invitation
    const { data, error: inviteError } = await inviteUser({
      email: formData.email,
      fullName: formData.fullName,
      role: formData.role,
      projects: formData.projects
    })

    if (inviteError) {
      setError(inviteError.message || 'Failed to send invitation')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    // Redirect after 2 seconds
    setTimeout(() => {
      navigate('/users')
    }, 2000)
  }

  if (!isAdmin) {
    return null
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Sent!</h2>
          <p className="text-gray-600 mb-6">
            An invitation email has been sent to <strong>{formData.email}</strong>
          </p>
          <p className="text-sm text-gray-500">
            Redirecting to users list...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/users')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Invite New User</h1>
        <p className="text-sm text-gray-600 mt-1">
          Send an email invitation to a new user
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Invite Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 space-y-6">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="user@example.com"
                required
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              An invitation will be sent to this email address
            </p>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="John Doe"
                required
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                required
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
              >
                <option value={USER_ROLES.SUBMITTER}>{ROLE_LABELS[USER_ROLES.SUBMITTER]}</option>
                <option value={USER_ROLES.REVIEWER}>{ROLE_LABELS[USER_ROLES.REVIEWER]}</option>
                <option value={USER_ROLES.APPROVER}>{ROLE_LABELS[USER_ROLES.APPROVER]}</option>
                <option value={USER_ROLES.STORE_MANAGER}>{ROLE_LABELS[USER_ROLES.STORE_MANAGER]}</option>
                <option value={USER_ROLES.SUPER_ADMIN}>{ROLE_LABELS[USER_ROLES.SUPER_ADMIN]}</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formData.role === USER_ROLES.SUBMITTER && 'Can create and submit requisitions'}
              {formData.role === USER_ROLES.REVIEWER && 'Can review requisitions and add comments'}
              {formData.role === USER_ROLES.APPROVER && 'Can approve or reject requisitions'}
              {formData.role === USER_ROLES.STORE_MANAGER && 'Can manage goods receiving and stores'}
              {formData.role === USER_ROLES.SUPER_ADMIN && 'Full system access and administration'}
            </p>
          </div>

          {/* Project Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Assignments (Optional)
            </label>
            <div className="border border-gray-300 rounded-lg divide-y divide-gray-200 max-h-64 overflow-y-auto">
              {availableProjects.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No projects available
                </div>
              ) : (
                availableProjects.map((project) => (
                  <label
                    key={project.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.projects.includes(project.id)}
                      onChange={() => handleProjectToggle(project.id)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {project.code} - {project.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        Budget: UGX {project.budget?.toLocaleString() || 'N/A'}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Select projects this user can work on (you can assign more later)
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">What happens next?</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>User receives an invitation email</li>
                  <li>User clicks the link to set their password</li>
                  <li>User can log in with full access to assigned projects</li>
                  <li>You can modify their role and projects anytime</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/users')}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Invitation
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default InviteUser
