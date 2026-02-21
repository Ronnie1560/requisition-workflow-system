import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Plus, Package, Search, Filter, AlertCircle, Tag, Upload } from 'lucide-react'
import { getAllItems } from '../../services/api/items'
import { getActiveCategories } from '../../services/api/categories'
import { logger } from '../../utils/logger'

// Custom debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

const ItemsList = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [allItems, setAllItems] = useState([]) // All items from server
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('') // Immediate input value
  const [filters, setFilters] = useState({
    is_active: true,
    category_id: ''
  })

  // Debounce search input (300ms delay for API calls if needed)
  const _debouncedSearch = useDebounce(searchInput, 300)

  // Load items when status/category filters change
  useEffect(() => {
    loadItems()
    loadCategories()
  }, [filters.is_active, filters.category_id])

  // Relevance-based sorting and filtering (client-side, instant)
  const filteredAndSortedItems = useMemo(() => {
    if (!allItems.length) return []
    
    const searchTerm = searchInput.toLowerCase().trim()
    
    if (!searchTerm) {
      // No search - just return items sorted by code
      return [...allItems].sort((a, b) => a.code.localeCompare(b.code))
    }

    // Score each item based on relevance
    const scoredItems = allItems.map(item => {
      const code = (item.code || '').toLowerCase()
      const name = (item.name || '').toLowerCase()
      const description = (item.description || '').toLowerCase()
      const categoryName = (item.category?.name || '').toLowerCase()
      
      let score = 0
      
      // Exact matches (highest priority)
      if (code === searchTerm) score += 100
      if (name === searchTerm) score += 90
      
      // Starts with (high priority)
      if (code.startsWith(searchTerm)) score += 50
      if (name.startsWith(searchTerm)) score += 45
      
      // Word starts with (medium-high priority)
      const nameWords = name.split(/\s+/)
      if (nameWords.some(word => word.startsWith(searchTerm))) score += 30
      
      // Contains (medium priority)
      if (code.includes(searchTerm)) score += 20
      if (name.includes(searchTerm)) score += 15
      if (categoryName.includes(searchTerm)) score += 10
      if (description.includes(searchTerm)) score += 5
      
      return { item, score }
    })

    // Filter out non-matching items and sort by score (descending)
    return scoredItems
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.item.code.localeCompare(b.item.code))
      .map(({ item }) => item)
  }, [allItems, searchInput])

  const loadItems = async () => {
    setLoading(true)
    setError('')
    try {
      // Load all items matching status/category, search will be client-side
      const { data, error } = await getAllItems({
        is_active: filters.is_active,
        category_id: filters.category_id
      })
      if (error) throw error
      setAllItems(data || [])
    } catch (err) {
      logger.error('Error loading items:', err)
      setError(err.message || 'Failed to load items. Please try again.')
      setAllItems([])
    } finally {
      setLoading(false)
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

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchInput('')
  }, [])

  // Check if user can create items (admins only)
  const canCreateItem = profile?.role === 'super_admin'

  // Use filtered items for display
  const items = filteredAndSortedItems

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Items Catalog</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage items and services for requisitions
          </p>
        </div>
        {canCreateItem && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/items/import')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Upload className="w-5 h-5" />
              Import
            </button>
            <button
              onClick={() => navigate('/items/create')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-5 h-5" />
              New Item
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Total Items</p>
          <p className="text-2xl font-bold text-gray-900">{allItems.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Showing</p>
          <p className="text-2xl font-bold text-blue-600">{items.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-green-600">
            {allItems.filter(i => i.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Categories</p>
          <p className="text-2xl font-bold text-indigo-600">
            {categories.length}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={loadItems}
              className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search - Real-time as you type */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by code, name, description, or category..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              {searchInput && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  ×
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="sm:w-56">
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={filters.category_id}
                  onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status Filter */}
            <div className="sm:w-48">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={filters.is_active}
                  onChange={(e) => setFilters({ ...filters, is_active: e.target.value === 'true' })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                >
                  <option value="true">Active Only</option>
                  <option value="false">Inactive Only</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Search hint */}
          {searchInput && (
            <p className="text-sm text-gray-500">
              Found {items.length} {items.length === 1 ? 'item' : 'items'} matching "{searchInput}"
              {items.length > 0 && ' (sorted by relevance)'}
            </p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600 mt-4">Loading items...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No items found</p>
            <p className="text-sm text-gray-500 mb-6">
              {searchInput || filters.category_id
                ? 'Try adjusting your search or filters'
                : 'Create your first item to get started'}
            </p>
            {canCreateItem && !searchInput && !filters.category_id && (
              <button
                onClick={() => navigate('/items/create')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5" />
                Create Item
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">UOM</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/items/${item.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Package className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-900">{item.code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-gray-500 line-clamp-1">{item.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {item.category ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          {item.category.name}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">No category</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.default_uom?.code || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        item.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/items/${item.id}`)
                        }}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                      >
                        View Details
                      </button>
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

export default ItemsList
