import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  ArrowLeft, Edit, Package, Tag, CheckCircle, XCircle,
  AlertCircle, Loader, FileText, DollarSign
} from 'lucide-react'
import {
  getItemById,
  getItemStats,
  activateItem,
  deleteItem
} from '../../services/api/items'
import { formatCurrency } from '../../utils/formatters'
import { logger } from '../../utils/logger'

const ItemDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { profile } = useAuth()

  const [item, setItem] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const loadItemDetails = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      // Load item and stats in parallel
      const [itemResult, statsResult] = await Promise.all([
        getItemById(id),
        getItemStats(id)
      ])

      if (itemResult.error) throw itemResult.error
      if (statsResult.error) throw statsResult.error

      setItem(itemResult.data)
      setStats(statsResult.data)
    } catch (err) {
      logger.error('Error loading item details:', err)
      setError(err.message || 'Failed to load item details')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) {
      loadItemDetails()
    }
  }, [id, loadItemDetails])

  const handleActivate = async () => {
    if (!window.confirm('Are you sure you want to activate this item?')) return

    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await activateItem(id)
      if (result.error) throw result.error

      setSuccess('Item activated successfully!')
      loadItemDetails()
    } catch (err) {
      logger.error('Error activating item:', err)
      setError(err.message || 'Failed to activate item')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (!window.confirm('Are you sure you want to deactivate this item? It will no longer be available for requisitions.')) return

    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await deleteItem(id)
      if (result.error) throw result.error

      setSuccess('Item deactivated successfully!')
      loadItemDetails()
    } catch (err) {
      logger.error('Error deactivating item:', err)
      setError(err.message || 'Failed to deactivate item')
    } finally {
      setActionLoading(false)
    }
  }

  // Only super admin can edit items
  const canEdit = profile?.role === 'super_admin'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading item details...</p>
        </div>
      </div>
    )
  }

  if (error && !item) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">{error}</p>
        <button
          onClick={() => navigate('/items')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Back to Items
        </button>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Item not found</p>
        <button
          onClick={() => navigate('/items')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Back to Items
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
            onClick={() => navigate('/items')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{item.code}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                item.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {item.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <h2 className="text-lg text-gray-600 mt-1">{item.name}</h2>
          </div>
          <div className="flex items-center gap-3">
            {canEdit && item.is_active && (
              <button
                onClick={() => navigate(`/items/edit/${item.id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Edit className="w-5 h-5" />
                Edit
              </button>
            )}
            {canEdit && (
              item.is_active ? (
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
              <p className="text-sm text-gray-600">Requisitions</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.requisition_count}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <Tag className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-gray-600">Account Links</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.account_links}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <Package className="w-5 h-5 text-green-600" />
              <p className="text-sm text-gray-600">Total Quantity Used</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_quantity_used.toFixed(2)}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              <p className="text-sm text-gray-600">Total Amount</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_amount_spent)}</p>
          </div>
        </div>
      )}

      {/* Item Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Item Information</h3>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Code</label>
              <p className="text-gray-900 mt-1 font-mono">{item.code}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Name</label>
              <p className="text-gray-900 mt-1">{item.name}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Description</label>
              <p className="text-gray-900 mt-1">{item.description || 'No description provided'}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Category</label>
              <p className="text-gray-900 mt-1">
                {item.category ? (
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                    {item.category.name}
                  </span>
                ) : (
                  'No category'
                )}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Default Unit of Measure</label>
              <p className="text-gray-900 mt-1">
                {item.default_uom ? `${item.default_uom.name} (${item.default_uom.code})` : 'N/A'}
              </p>
            </div>

            {item.created_by_user && (
              <div>
                <label className="text-sm font-medium text-gray-600">Created By</label>
                <p className="text-gray-900 mt-1">{item.created_by_user.full_name}</p>
                <p className="text-sm text-gray-500">{item.created_by_user.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Usage Overview */}
        {stats && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Overview</h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Times Requisitioned</span>
                  <span className="text-sm font-bold text-gray-900">{stats.requisition_count}</span>
                </div>
                <p className="text-xs text-gray-500">Number of requisition line items</p>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Account Links</span>
                  <span className="text-sm font-bold text-gray-900">{stats.account_links}</span>
                </div>
                <p className="text-xs text-gray-500">Linked to project-account combinations</p>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Total Quantity</span>
                  <span className="text-sm font-bold text-green-600">
                    {stats.total_quantity_used.toFixed(2)} {item.default_uom?.code}
                  </span>
                </div>
                <p className="text-xs text-gray-500">Total quantity used in requisitions</p>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Total Value</span>
                  <span className="text-sm font-bold text-purple-600">
                    {formatCurrency(stats.total_amount_spent)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">Total amount spent on this item</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ItemDetail
