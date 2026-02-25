import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Pencil, Check, X, Search, ToggleLeft, ToggleRight,
  Loader2, AlertCircle, CheckCircle2, Ruler, Package
} from 'lucide-react'
import {
  getAllUOMTypesAdmin,
  createUOMType,
  updateUOMType,
  toggleUOMType
} from '../../services/api/items'
import { logger } from '../../utils/logger'

/**
 * UOM (Unit of Measure) Management Component
 * Allows org admins to view, add, edit, and toggle UOM types
 */
export default function UOMManagement() {
  const [uomTypes, setUomTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // Add/Edit form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ code: '', name: '', description: '' })
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  // Toggling state
  const [togglingId, setTogglingId] = useState(null)

  const loadUOMTypes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await getAllUOMTypesAdmin()
      if (fetchError) throw fetchError
      setUomTypes(data || [])
    } catch (err) {
      logger.error('Error loading UOM types:', err)
      setError(err.message || 'Failed to load UOM types')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUOMTypes()
  }, [loadUOMTypes])

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  // Filter UOM types
  const filteredUOMs = uomTypes.filter(uom => {
    const matchesSearch = !search ||
      uom.code.toLowerCase().includes(search.toLowerCase()) ||
      uom.name.toLowerCase().includes(search.toLowerCase()) ||
      (uom.description || '').toLowerCase().includes(search.toLowerCase())
    const matchesActive = showInactive || uom.is_active
    return matchesSearch && matchesActive
  })

  // Group by category
  const groupedUOMs = {
    count: filteredUOMs.filter(u => ['PCS', 'EA', 'SET', 'PKT', 'BOX', 'CTN', 'DZ'].includes(u.code)),
    weight: filteredUOMs.filter(u => ['KG', 'G', 'MT', 'LB'].includes(u.code)),
    volume: filteredUOMs.filter(u => ['L', 'ML', 'GAL'].includes(u.code)),
    length: filteredUOMs.filter(u => ['M', 'CM', 'MM', 'FT', 'IN'].includes(u.code)),
    area: filteredUOMs.filter(u => ['SQM', 'SQFT'].includes(u.code)),
    services: filteredUOMs.filter(u => ['HR', 'DAY', 'MON', 'SVC'].includes(u.code)),
    custom: filteredUOMs.filter(u =>
      !['PCS', 'EA', 'SET', 'PKT', 'BOX', 'CTN', 'DZ',
        'KG', 'G', 'MT', 'LB', 'L', 'ML', 'GAL',
        'M', 'CM', 'MM', 'FT', 'IN', 'SQM', 'SQFT',
        'HR', 'DAY', 'MON', 'SVC'].includes(u.code)
    ),
  }

  const handleStartAdd = () => {
    setEditingId(null)
    setFormData({ code: '', name: '', description: '' })
    setFormError(null)
    setShowForm(true)
  }

  const handleStartEdit = (uom) => {
    setEditingId(uom.id)
    setFormData({ code: uom.code, name: uom.name, description: uom.description || '' })
    setFormError(null)
    setShowForm(true)
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormError(null)
  }

  const handleSaveForm = async (e) => {
    e.preventDefault()
    setFormError(null)

    // Validation
    const code = formData.code.trim().toUpperCase()
    const name = formData.name.trim()
    if (!code) { setFormError('Code is required'); return }
    if (!name) { setFormError('Name is required'); return }
    if (code.length > 10) { setFormError('Code must be 10 characters or less'); return }

    // Check for duplicate code (excluding current edit)
    const duplicate = uomTypes.find(u =>
      u.code.toUpperCase() === code && u.id !== editingId
    )
    if (duplicate) { setFormError(`Code "${code}" already exists`); return }

    setFormSaving(true)
    try {
      if (editingId) {
        // Update
        const { error: updateError } = await updateUOMType(editingId, {
          code,
          name,
          description: formData.description.trim()
        })
        if (updateError) throw updateError
        setSuccess(`UOM "${code}" updated successfully`)
      } else {
        // Create
        const { error: createError } = await createUOMType({
          code,
          name,
          description: formData.description.trim(),
          is_active: true
        })
        if (createError) throw createError
        setSuccess(`UOM "${code}" created successfully`)
      }
      setShowForm(false)
      setEditingId(null)
      await loadUOMTypes()
    } catch (err) {
      logger.error('Error saving UOM type:', err)
      setFormError(err.message || 'Failed to save UOM type')
    } finally {
      setFormSaving(false)
    }
  }

  const handleToggle = async (uom) => {
    setTogglingId(uom.id)
    try {
      const { error: toggleError } = await toggleUOMType(uom.id, !uom.is_active)
      if (toggleError) throw toggleError
      setSuccess(`"${uom.code}" ${uom.is_active ? 'deactivated' : 'activated'}`)
      await loadUOMTypes()
    } catch (err) {
      logger.error('Error toggling UOM type:', err)
      setError(err.message || 'Failed to update UOM status')
    } finally {
      setTogglingId(null)
    }
  }

  const activeCount = uomTypes.filter(u => u.is_active).length
  const inactiveCount = uomTypes.filter(u => !u.is_active).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-600 ml-3">Loading UOM types...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Units of Measure</h2>
          <p className="text-sm text-gray-500 mt-1">
            {activeCount} active{inactiveCount > 0 && `, ${inactiveCount} inactive`} — used in item catalog and requisitions
          </p>
        </div>
        <button
          onClick={handleStartAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Custom UOM
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">
            {editingId ? 'Edit UOM Type' : 'Add Custom UOM Type'}
          </h3>
          <form onSubmit={handleSaveForm} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  maxLength={10}
                  placeholder="e.g., ROLL"
                  className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  disabled={editingId !== null}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  maxLength={50}
                  placeholder="e.g., Roll"
                  className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  maxLength={200}
                  placeholder="e.g., Roll of material"
                  className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            {formError && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {formError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={formSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                {formSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {editingId ? 'Update' : 'Add'}
              </button>
              <button
                type="button"
                onClick={handleCancelForm}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code, name, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          />
          Show inactive ({inactiveCount})
        </label>
      </div>

      {/* UOM List */}
      <div className="space-y-4">
        {renderGroup('Count & Packaging', groupedUOMs.count, Package)}
        {renderGroup('Weight', groupedUOMs.weight, Ruler)}
        {renderGroup('Volume', groupedUOMs.volume, Ruler)}
        {renderGroup('Length', groupedUOMs.length, Ruler)}
        {renderGroup('Area', groupedUOMs.area, Ruler)}
        {renderGroup('Services & Time', groupedUOMs.services, Ruler)}
        {groupedUOMs.custom.length > 0 && renderGroup('Custom', groupedUOMs.custom, Plus)}
      </div>

      {filteredUOMs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Ruler className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">{search ? 'No UOM types match your search' : 'No UOM types found'}</p>
        </div>
      )}

      {/* Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-500">
          <strong>Tip:</strong> Deactivated UOM types won&apos;t appear in item dropdowns but existing items using them won&apos;t be affected.
          Add custom UOM types for industry-specific measurements (e.g., Ream, Barrel, Pallet, Bundle).
        </p>
      </div>
    </div>
  )

  function renderGroup(label, items, Icon) {
    if (items.length === 0) return null

    return (
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" />
          {label}
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {items.map(uom => (
            <div
              key={uom.id}
              className={`flex items-center justify-between px-4 py-2.5 ${
                !uom.is_active ? 'opacity-50 bg-gray-50' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-gray-100 text-gray-700 whitespace-nowrap">
                  {uom.code}
                </span>
                <span className="text-sm font-medium text-gray-900 truncate">{uom.name}</span>
                {uom.description && (
                  <span className="text-xs text-gray-400 truncate hidden md:inline">
                    — {uom.description}
                  </span>
                )}
                {!uom.is_active && (
                  <span className="text-xs text-red-500 font-medium">Inactive</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleStartEdit(uom)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleToggle(uom)}
                  disabled={togglingId === uom.id}
                  className={`p-1.5 rounded transition-colors ${
                    uom.is_active
                      ? 'text-green-500 hover:text-red-500 hover:bg-red-50'
                      : 'text-gray-400 hover:text-green-500 hover:bg-green-50'
                  }`}
                  title={uom.is_active ? 'Deactivate' : 'Activate'}
                >
                  {togglingId === uom.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : uom.is_active ? (
                    <ToggleRight className="w-4 h-4" />
                  ) : (
                    <ToggleLeft className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
}
