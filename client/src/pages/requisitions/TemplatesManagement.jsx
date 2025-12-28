import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  FileText,
  Search,
  Edit,
  Trash2,
  Plus,
  Eye,
  ArrowLeft,
  Loader,
  AlertCircle
} from 'lucide-react'
import {
  getUserTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  createRequisitionFromTemplate
} from '../../services/api/templates'
import { logger } from '../../utils/logger'

const TemplatesManagement = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({ template_name: '', description: '' })
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadTemplates()
    }
  }, [user])

  const loadTemplates = async () => {
    setLoading(true)
    setError('')

    try {
      const { data, error: err } = await getUserTemplates(user.id, {
        is_active: true,
        search: searchTerm
      })

      if (err) throw err
      setTemplates(data || [])
    } catch (err) {
      logger.error('Error loading templates:', err)
      setError(err.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    loadTemplates()
  }

  const handleViewTemplate = async (template) => {
    setActionLoading(true)
    try {
      const { data, error: err } = await getTemplateById(template.id)
      if (err) throw err
      setSelectedTemplate(data)
      setShowViewModal(true)
    } catch (err) {
      logger.error('Error loading template details:', err)
      alert(err.message || 'Failed to load template details')
    } finally {
      setActionLoading(false)
    }
  }

  const handleEditTemplate = (template) => {
    setSelectedTemplate(template)
    setEditFormData({
      template_name: template.template_name,
      description: template.description || ''
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    setActionLoading(true)
    try {
      const { error: err } = await updateTemplate(selectedTemplate.id, editFormData)
      if (err) throw err

      setShowEditModal(false)
      loadTemplates()
      alert('Template updated successfully!')
    } catch (err) {
      logger.error('Error updating template:', err)
      alert(err.message || 'Failed to update template')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return
    }

    setActionLoading(true)
    try {
      const { error: err } = await deleteTemplate(templateId)
      if (err) throw err

      loadTemplates()
      alert('Template deleted successfully!')
    } catch (err) {
      logger.error('Error deleting template:', err)
      alert(err.message || 'Failed to delete template')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUseTemplate = async (templateId) => {
    setActionLoading(true)
    try {
      const { data, error: err } = await createRequisitionFromTemplate(templateId, user.id)
      if (err) throw err

      navigate(`/requisitions/edit/${data.id}`)
    } catch (err) {
      logger.error('Error creating requisition from template:', err)
      alert(err.message || 'Failed to create requisition from template')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/requisitions')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Requisition Templates</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage your reusable requisition templates
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/requisitions/create')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-5 h-5" />
          Create New Template
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="Search templates by name or description..."
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Search
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        {loading ? (
          <div className="p-12 text-center">
            <Loader className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              {searchTerm ? 'No templates found matching your search' : 'No templates yet'}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Create your first template by clicking "Save as Template" when creating a requisition
            </p>
            <button
              onClick={() => navigate('/requisitions/create')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-5 h-5" />
              Create Requisition
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Template Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-indigo-600 mr-3" />
                        <span className="text-sm font-medium text-gray-900">
                          {template.template_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-xs truncate">
                        {template.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {template.project?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {template.template_items?.[0]?.count || 0} items
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(template.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewTemplate(template)}
                          className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-100"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditTemplate(template)}
                          className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50"
                          title="Edit template"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleUseTemplate(template.id)}
                          className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-xs"
                          title="Create requisition from template"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="Delete template"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* View Modal */}
      {showViewModal && selectedTemplate && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Template Details</h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Template Info */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Template Information</h4>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-gray-500">Template Name</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">{selectedTemplate.template_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Project</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">{selectedTemplate.project?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Expense Account</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">{selectedTemplate.expense_account?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {new Date(selectedTemplate.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {selectedTemplate.description && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Description</p>
                      <p className="text-sm text-gray-900 mt-1">{selectedTemplate.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items */}
              {selectedTemplate.template_items && selectedTemplate.template_items.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Line Items</h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Quantity</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">UOM</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Unit Price</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedTemplate.template_items.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {item.item?.name || '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {item.item_description || '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {item.uom?.name || '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {item.unit_price ? `UGX ${parseFloat(item.unit_price).toLocaleString()}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false)
                  handleUseTemplate(selectedTemplate.id)
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Use This Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTemplate && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Template</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={editFormData.template_name}
                  onChange={(e) => setEditFormData({ ...editFormData, template_name: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowEditModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={actionLoading || !editFormData.template_name.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TemplatesManagement
