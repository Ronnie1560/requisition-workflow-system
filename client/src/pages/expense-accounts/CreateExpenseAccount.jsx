import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Save, ArrowLeft, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import {
  createExpenseAccount,
  updateExpenseAccount,
  getExpenseAccountById
} from '../../services/api/expenseAccounts'
import { getAllProjects } from '../../services/api/projects'
import { logger } from '../../utils/logger'

const CreateExpenseAccount = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user: _user } = useAuth()

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    project_id: '',
    is_active: true
  })

  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const isEditMode = !!id

  useEffect(() => {
    loadProjects()
    if (id) {
      loadAccount(id)
    }
  }, [id])

  const loadProjects = async () => {
    try {
      const { data, error } = await getAllProjects({ is_active: true })
      if (error) throw error
      setProjects(data || [])
    } catch (err) {
      logger.error('Error loading projects:', err)
      setError('Failed to load projects')
    }
  }

  const loadAccount = async (accountId) => {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await getExpenseAccountById(accountId)

      if (error) throw error

      if (!data) {
        setError('Expense account not found')
        return
      }

      setFormData({
        code: data.code || '',
        name: data.name || '',
        description: data.description || '',
        project_id: data.project_id || '',
        is_active: data.is_active !== undefined ? data.is_active : true
      })
    } catch (err) {
      logger.error('Error loading expense account:', err)
      setError(err.message || 'Failed to load expense account')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setFormData({
      ...formData,
      [e.target.name]: value
    })
  }

  const validateForm = () => {
    if (!formData.code.trim()) {
      setError('Account code is required')
      return false
    }
    if (!formData.name.trim()) {
      setError('Account name is required')
      return false
    }
    if (!formData.project_id) {
      setError('Project is required')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const accountData = {
        ...formData
      }

      let result
      if (isEditMode) {
        result = await updateExpenseAccount(id, accountData)
      } else {
        result = await createExpenseAccount(accountData)
      }

      if (result.error) throw result.error

      setSuccess(isEditMode ? 'Expense account updated successfully!' : 'Expense account created successfully!')

      setTimeout(() => {
        navigate('/expense-accounts')
      }, 1500)
    } catch (err) {
      logger.error('Error saving expense account:', err)
      setError(err.message || 'Failed to save expense account')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading expense account...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/expense-accounts')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit Expense Account' : 'Create New Expense Account'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {isEditMode ? 'Update expense account information' : 'Add a new expense account to the system'}
          </p>
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
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Account Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Code *
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  required
                  disabled={isEditMode}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-100"
                  placeholder="e.g., 5100"
                />
                {isEditMode && (
                  <p className="text-xs text-gray-500 mt-1">Account code cannot be changed</p>
                )}
              </div>

              {/* Account Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="e.g., Office Supplies"
                />
              </div>

              {/* Project */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project *
                </label>
                <select
                  name="project_id"
                  value={formData.project_id}
                  onChange={handleChange}
                  required
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="">Select a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} - {project.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Each expense account must belong to one project
                </p>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="Provide details about this expense account..."
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Status
            </h2>
            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_active"
                id="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                Account is active
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2 ml-6">
              Inactive accounts will not be available for new requisitions
            </p>
          </div>

          {/* Actions */}
          <div className="border-t pt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/expense-accounts')}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {isEditMode ? 'Update Account' : 'Create Account'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default CreateExpenseAccount
