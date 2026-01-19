import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Plus, FileText, Filter, Search, Download } from 'lucide-react'
import { getRequisitionsForReview } from '../../services/api/requisitions'
import { createRequisitionFromTemplate } from '../../services/api/templates'
import { formatDate, formatCurrency } from '../../utils/formatters'
import { STATUS_LABELS } from '../../utils/constants'
import { exportRequisitionsToExcel } from '../../utils/excelExport'
import TemplateSelectionModal from '../../components/requisitions/TemplateSelectionModal'
import { logger } from '../../utils/logger'

const RequisitionsList = () => {
  const navigate = useNavigate()
  const { user, profile: _profile, userRole } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [requisitions, setRequisitions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || ''
  })
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [_creatingFromTemplate, setCreatingFromTemplate] = useState(false)

  // Update URL when filters change
  useEffect(() => {
    const params = {}
    if (filters.status) params.status = filters.status
    if (filters.search) params.search = filters.search
    setSearchParams(params, { replace: true })
  }, [filters])

  useEffect(() => {
    loadRequisitions()
  }, [user, filters.status])

  const loadRequisitions = async () => {
    setLoading(true)
    try {
      const { data, error } = await getRequisitionsForReview(user.id, userRole, {
        status: filters.status
      })

      if (error) throw error
      setRequisitions(data || [])
    } catch (err) {
      logger.error('Error loading requisitions:', err)
    } finally {
      setLoading(false)
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

  const filteredRequisitions = requisitions.filter(req => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      return (
        req.requisition_number?.toLowerCase().includes(searchLower) ||
        req.title?.toLowerCase().includes(searchLower) ||
        req.project?.name?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  const stats = {
    total: requisitions.length,
    draft: requisitions.filter(r => r.status === 'draft').length,
    pending: requisitions.filter(r => r.status === 'pending').length,
    reviewed: requisitions.filter(r => r.status === 'reviewed').length,
    approved: requisitions.filter(r => r.status === 'approved').length
  }

  const handleExportToExcel = () => {
    const result = exportRequisitionsToExcel(filteredRequisitions)
    if (result.success) {
      // Success message could be added here
    } else {
      logger.error('Export failed:', result.error)
    }
  }

  const handleCreateFromTemplate = async (template) => {
    setCreatingFromTemplate(true)

    try {
      const { data, error } = await createRequisitionFromTemplate(template.id, user.id)

      if (error) throw error

      // Navigate to the created draft for editing
      navigate(`/requisitions/edit/${data.id}`)
    } catch (err) {
      logger.error('Error creating requisition from template:', err)
      alert(err.message || 'Failed to create requisition from template')
    } finally {
      setCreatingFromTemplate(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {userRole === 'reviewer' ? 'Requisitions for Review' :
             userRole === 'approver' ? 'Requisitions for Approval' :
             userRole === 'super_admin' ? 'All Requisitions' :
             'My Requisitions'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {userRole === 'reviewer' ? 'Review and process pending requisitions' :
             userRole === 'approver' ? 'Approve or reject requisitions' :
             userRole === 'super_admin' ? 'Manage all requisitions in the system' :
             'Manage your purchase requisitions and expense claims'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/requisitions/templates')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <FileText className="w-5 h-5" />
            Manage Templates
          </button>
          <button
            onClick={handleExportToExcel}
            disabled={filteredRequisitions.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            Export to Excel
          </button>
          <button
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50"
          >
            <FileText className="w-5 h-5" />
            From Template
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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Draft</p>
          <p className="text-2xl font-bold text-gray-500">{stats.draft}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Pending Review</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Pending Approval</p>
          <p className="text-2xl font-bold text-orange-600">{stats.reviewed}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Approved</p>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by number, title, or project..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending Review</option>
                <option value="reviewed">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Requisitions List */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600 mt-4">Loading requisitions...</p>
          </div>
        ) : filteredRequisitions.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No requisitions found</p>
            <p className="text-sm text-gray-500 mb-6">
              {filters.search || filters.status
                ? 'Try adjusting your filters'
                : 'Create your first requisition to get started'}
            </p>
            {!filters.search && !filters.status && (
              <button
                onClick={() => navigate('/requisitions/create')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5" />
                Create Requisition
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requisition #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequisitions.map((requisition) => (
                  <tr
                    key={requisition.id}
                    onClick={() => navigate(`/requisitions/${requisition.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">
                          {requisition.requisition_number || 'DRAFT'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {requisition.title}
                      </div>
                      {requisition.is_urgent && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 mt-1">
                          Urgent
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {requisition.project?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(requisition.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadgeClass(requisition.status)}>
                        {STATUS_LABELS[requisition.status] || requisition.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(requisition.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {requisition.requisition_items?.length || 0} items
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Template Selection Modal */}
      <TemplateSelectionModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelect={handleCreateFromTemplate}
      />
    </div>
  )
}

export default RequisitionsList
