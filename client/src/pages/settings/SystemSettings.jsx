import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTimedMessage } from '../../hooks/useTimedMessage'
import { useAuth } from '../../context/AuthContext'
import {
  getApprovalWorkflows,
  updateApprovalWorkflow,
  createApprovalWorkflow,
  deleteApprovalWorkflow,
  toggleWorkflowStatus
} from '../../services/api/systemSettings'
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  activateCategory
} from '../../services/api/categories'
import { Trash2, Plus, Edit2, X } from 'lucide-react'
import { logger } from '../../utils/logger'

export default function SystemSettings() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('workflows')
  const [loading, setLoading] = useState({
    workflows: false,
    categories: false
  })
  const [dataLoaded, setDataLoaded] = useState({
    workflows: false,
    categories: false
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, showSuccess] = useTimedMessage(3000)

  // Approval workflows
  const [workflows, setWorkflows] = useState([])
  const [editingWorkflow, setEditingWorkflow] = useState(null)
  const [showWorkflowModal, setShowWorkflowModal] = useState(false)

  // Categories
  const [categories, setCategories] = useState([])
  const [editingCategory, setEditingCategory] = useState(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)

  // Check if user is admin
  useEffect(() => {
    if (profile && profile.role !== 'super_admin') {
      navigate('/dashboard')
    }
  }, [profile, navigate])

  // Load data for the active tab only
  useEffect(() => {
    if (!dataLoaded[activeTab]) {
      loadTabData(activeTab)
    }
  }, [activeTab, dataLoaded])

  const loadTabData = async (tab) => {
    setLoading(prev => ({ ...prev, [tab]: true }))
    setError('')

    try {
      switch (tab) {
        case 'workflows':
          await loadWorkflows()
          break
        case 'categories':
          await loadCategories()
          break
        default:
          break
      }
      setDataLoaded(prev => ({ ...prev, [tab]: true }))
    } catch (err) {
      logger.error(`Error loading ${tab} settings:`, err)
      setError(`Failed to load ${tab} settings`)
    } finally {
      setLoading(prev => ({ ...prev, [tab]: false }))
    }
  }

  const loadWorkflows = async () => {
    const { data, error } = await getApprovalWorkflows()
    if (error) throw error

    if (data) {
      setWorkflows(data)
    }
  }

  const loadCategories = async () => {
    const { data, error } = await getAllCategories()
    if (error) throw error

    if (data) {
      setCategories(data)
    }
  }

  const handleWorkflowSubmit = async (workflowData) => {
    setSaving(true)
    setError('')
    showSuccess('')

    try {
      let result
      if (editingWorkflow?.id) {
        result = await updateApprovalWorkflow(editingWorkflow.id, workflowData)
      } else {
        result = await createApprovalWorkflow(workflowData)
      }

      if (result.error) throw result.error

      showSuccess(editingWorkflow?.id ? 'Workflow updated successfully' : 'Workflow created successfully')
      setShowWorkflowModal(false)
      setEditingWorkflow(null)
      await loadWorkflows()
    } catch (err) {
      logger.error('Error saving workflow:', err)
      setError(err.message || 'Failed to save workflow')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteWorkflow = async (workflowId) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return

    setSaving(true)
    try {
      const { error } = await deleteApprovalWorkflow(workflowId)
      if (error) throw error

      showSuccess('Workflow deleted successfully')
      await loadWorkflows()
    } catch (err) {
      logger.error('Error deleting workflow:', err)
      setError(err.message || 'Failed to delete workflow')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleWorkflow = async (workflowId, currentStatus) => {
    try {
      const { error } = await toggleWorkflowStatus(workflowId, !currentStatus)
      if (error) throw error

      showSuccess('Workflow status updated')
      await loadWorkflows()
    } catch (err) {
      logger.error('Error toggling workflow:', err)
      setError(err.message || 'Failed to toggle workflow status')
    }
  }

  const handleCategorySubmit = async (categoryData) => {
    setSaving(true)
    setError('')
    showSuccess('')

    try {
      let result
      if (editingCategory?.id) {
        result = await updateCategory(editingCategory.id, categoryData)
      } else {
        result = await createCategory(categoryData)
      }

      if (result.error) throw result.error

      showSuccess(editingCategory?.id ? 'Category updated successfully' : 'Category created successfully')
      setShowCategoryModal(false)
      setEditingCategory(null)
      await loadCategories()
    } catch (err) {
      logger.error('Error saving category:', err)
      setError(err.message || 'Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm('Are you sure you want to delete this category?')) return

    setSaving(true)
    try {
      const { error } = await deleteCategory(categoryId)
      if (error) throw error

      showSuccess('Category deleted successfully')
      await loadCategories()
    } catch (err) {
      logger.error('Error deleting category:', err)
      setError(err.message || 'Failed to delete category')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleCategory = async (categoryId, currentStatus) => {
    try {
      const { error } = await activateCategory(categoryId, !currentStatus)
      if (error) throw error

      showSuccess('Category status updated')
      await loadCategories()
    } catch (err) {
      logger.error('Error toggling category:', err)
      setError(err.message || 'Failed to toggle category status')
    }
  }

  const isLoadingCurrentTab = loading[activeTab]

  return (
    <div className="container mx-auto py-6">
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure system-wide settings and workflows
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('workflows')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'workflows'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Approval Workflows
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'categories'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Categories
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Loading State */}
          {isLoadingCurrentTab ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <>
              {/* Approval Workflows Tab */}
              {activeTab === 'workflows' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Approval Workflows</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Configure approval workflows based on requisition amounts
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingWorkflow(null)
                        setShowWorkflowModal(true)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add Workflow
                    </button>
                  </div>

                  {/* Workflows Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Workflow Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount Range
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Required Approvers
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Roles
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {workflows.map((workflow) => (
                          <tr key={workflow.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {workflow.workflow_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              ${workflow.amount_threshold_min?.toLocaleString()} -
                              {workflow.amount_threshold_max ? ` $${workflow.amount_threshold_max.toLocaleString()}` : ' Unlimited'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {workflow.required_approvers_count}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {workflow.approval_roles?.join(', ')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => handleToggleWorkflow(workflow.id, workflow.is_active)}
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  workflow.is_active
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {workflow.is_active ? 'Active' : 'Inactive'}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => {
                                  setEditingWorkflow(workflow)
                                  setShowWorkflowModal(true)
                                }}
                                className="text-blue-600 hover:text-blue-900 mr-4"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteWorkflow(workflow.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Categories Tab */}
              {activeTab === 'categories' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Manage item categories for organization
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingCategory(null)
                        setShowCategoryModal(true)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add Category
                    </button>
                  </div>

                  {/* Categories Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Code
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {categories.map((category) => (
                          <tr key={category.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {category.code}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {category.name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {category.description || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => handleToggleCategory(category.id, category.is_active)}
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  category.is_active
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {category.is_active ? 'Active' : 'Inactive'}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => {
                                  setEditingCategory(category)
                                  setShowCategoryModal(true)
                                }}
                                className="text-blue-600 hover:text-blue-900 mr-4"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(category.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Workflow Modal */}
      {showWorkflowModal && (
        <WorkflowModal
          workflow={editingWorkflow}
          onSubmit={handleWorkflowSubmit}
          onClose={() => {
            setShowWorkflowModal(false)
            setEditingWorkflow(null)
          }}
          saving={saving}
        />
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          onSubmit={handleCategorySubmit}
          onClose={() => {
            setShowCategoryModal(false)
            setEditingCategory(null)
          }}
          saving={saving}
        />
      )}
    </div>
  )
}

// Workflow Modal Component
function WorkflowModal({ workflow, onSubmit, onClose, saving }) {
  const [formData, setFormData] = useState({
    workflow_name: workflow?.workflow_name || '',
    description: workflow?.description || '',
    amount_threshold_min: workflow?.amount_threshold_min || 0,
    amount_threshold_max: workflow?.amount_threshold_max || '',
    required_approvers_count: workflow?.required_approvers_count || 1,
    approval_roles: workflow?.approval_roles || [],
    priority: workflow?.priority || 0
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {workflow ? 'Edit Workflow' : 'Add Workflow'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workflow Name *
            </label>
            <input
              type="text"
              required
              value={formData.workflow_name}
              onChange={(e) => setFormData({ ...formData, workflow_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows="3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Amount *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.amount_threshold_min}
                onChange={(e) => setFormData({ ...formData, amount_threshold_min: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Amount (leave empty for unlimited)
              </label>
              <input
                type="number"
                min="0"
                value={formData.amount_threshold_max}
                onChange={(e) => setFormData({ ...formData, amount_threshold_max: e.target.value ? parseFloat(e.target.value) : '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Required Approvers *
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.required_approvers_count}
              onChange={(e) => setFormData({ ...formData, required_approvers_count: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Category Modal Component
function CategoryModal({ category, onSubmit, onClose, saving }) {
  const [formData, setFormData] = useState({
    code: category?.code || '',
    name: category?.name || '',
    description: category?.description || ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {category ? 'Edit Category' : 'Add Category'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code *
            </label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={!!category}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows="3"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
