import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Save, ArrowLeft, AlertCircle, CheckCircle, Loader, FilePlus } from 'lucide-react'
import {
  createItem,
  updateItem,
  getItemById,
  getAllUOMTypes
} from '../../services/api/items'
import { getActiveCategories } from '../../services/api/categories'
import { logger } from '../../utils/logger'

const CreateItem = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category_id: '',
    default_uom_id: '',
    is_active: true
  })

  const [uomTypes, setUomTypes] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saveAction, setSaveAction] = useState('close') // 'close' or 'new'
  const nameInputRef = useRef(null)
  const isEditMode = !!id

  useEffect(() => {
    loadUOMTypes()
    loadCategories()
    if (id) {
      loadItem(id)
    }
  }, [id])

  const loadUOMTypes = async () => {
    try {
      const { data, error } = await getAllUOMTypes()
      if (error) throw error
      setUomTypes(data || [])
    } catch (err) {
      logger.error('Error loading UOM types:', err)
      setError('Failed to load UOM types')
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await getActiveCategories()
      if (error) throw error
      setCategories(data || [])
    } catch (err) {
      logger.error('Error loading categories:', err)
    }
  }

  const loadItem = async (itemId) => {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await getItemById(itemId)

      if (error) throw error

      if (!data) {
        setError('Item not found')
        return
      }

      setFormData({
        code: data.code || '',
        name: data.name || '',
        description: data.description || '',
        category_id: data.category_id || '',
        default_uom_id: data.default_uom_id || '',
        is_active: data.is_active !== undefined ? data.is_active : true
      })
    } catch (err) {
      logger.error('Error loading item:', err)
      setError(err.message || 'Failed to load item')
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
    if (!formData.name.trim()) {
      setError('Item name is required')
      return false
    }
    if (!formData.default_uom_id) {
      setError('Default UOM is required')
      return false
    }
    return true
  }

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      category_id: '',
      default_uom_id: '',
      is_active: true
    })
    setError('')
    // Focus name input for quick entry
    setTimeout(() => nameInputRef.current?.focus(), 100)
  }

  const handleSubmit = async (e, action = 'close') => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setSaving(true)
    setSaveAction(action)
    setError('')
    setSuccess('')

    try {
      const itemData = {
        ...formData,
        created_by: user.id
      }

      let result
      if (isEditMode) {
        result = await updateItem(id, itemData)
      } else {
        result = await createItem(itemData)
      }

      if (result.error) throw result.error

      if (action === 'new' && !isEditMode) {
        setSuccess('Item created successfully! Ready for next item.')
        resetForm()
      } else {
        setSuccess(isEditMode ? 'Item updated successfully!' : 'Item created successfully!')
        setTimeout(() => {
          navigate('/items')
        }, 1500)
      }
    } catch (err) {
      logger.error('Error saving item:', err)
      setError(err.message || 'Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading item...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/items')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit Item' : 'Create New Item'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {isEditMode ? 'Update item information' : 'Add a new item to the catalog'}
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
      <form onSubmit={(e) => handleSubmit(e, 'close')}>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Item Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Item Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Code {!isEditMode && <span className="text-gray-500 text-xs">(Auto-generated if left blank)</span>}
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  disabled={isEditMode}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-100"
                  placeholder={isEditMode ? formData.code : "Leave blank for auto-generation (e.g., ITEM-001)"}
                />
                {isEditMode && (
                  <p className="text-xs text-gray-500 mt-1">Item code cannot be changed</p>
                )}
              </div>

              {/* Item Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Name *
                </label>
                <input
                  type="text"
                  name="name"
                  ref={nameInputRef}
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="e.g., Ballpoint Pen"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Default UOM */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Unit of Measure *
                </label>
                <select
                  name="default_uom_id"
                  value={formData.default_uom_id}
                  onChange={handleChange}
                  required
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="">Select UOM</option>
                  {uomTypes.map((uom) => (
                    <option key={uom.id} value={uom.id}>
                      {uom.name} ({uom.code})
                    </option>
                  ))}
                </select>
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
                  placeholder="Provide details about this item..."
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
                Item is active
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2 ml-6">
              Inactive items will not be available for requisitions
            </p>
          </div>

          {/* Actions */}
          <div className="border-t pt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/items')}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            {!isEditMode && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'new')}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 border border-indigo-300 text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && saveAction === 'new' ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FilePlus className="w-5 h-5" />
                    Save &amp; New
                  </>
                )}
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && saveAction === 'close' ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {isEditMode ? 'Update Item' : 'Save & Close'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default CreateItem
