import { useState, useEffect, memo, useRef } from 'react'
import PropTypes from 'prop-types'
import { Trash2, AlertTriangle, Package, MessageSquare, Search } from 'lucide-react'
import { getAllItemsForRequisition, getUomTypes, calculatePriceVariance, isPriceVarianceHigh } from '../../services/api/requisitions'

const LineItemsTable = ({ items, projectAccountId, onChange, disabled }) => {
  const [allItems, setAllItems] = useState([])
  const [uomTypes, setUomTypes] = useState([])
  const [expandedNotes, setExpandedNotes] = useState({})
  // Track the search text and active dropdown for empty rows
  const [emptyRowSearch, setEmptyRowSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const searchInputRef = useRef(null)
  const dropdownRef = useRef(null)
  const tempIdCounterRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      const [itemsResult, uomResult] = await Promise.all([
        getAllItemsForRequisition(),
        getUomTypes()
      ])
      if (cancelled) return
      if (!itemsResult.error && itemsResult.data) setAllItems(itemsResult.data)
      if (!uomResult.error && uomResult.data) setUomTypes(uomResult.data)
    }
    loadData()
    return () => { cancelled = true }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        searchInputRef.current && !searchInputRef.current.contains(e.target)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectItem = (item) => {
    tempIdCounterRef.current += 1
    const newItem = {
      id: `temp-${tempIdCounterRef.current}`,
      item_id: item.id,
      item_name: item.name,
      item_code: item.code,
      quantity: 1,
      uom_id: item.default_uom_id,
      uom_name: item.uom?.name || '',
      unit_price: 0,
      total_price: 0,
      line_number: items.length + 1,
      notes: ''
    }

    onChange([...items, newItem])
    setEmptyRowSearch('')
    setShowDropdown(false)
  }

  const updateLineItem = (index, field, value) => {
    const updatedItems = [...items]
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    }

    if (field === 'quantity' || field === 'unit_price') {
      const quantity = field === 'quantity' ? parseFloat(value) || 0 : updatedItems[index].quantity
      const unitPrice = field === 'unit_price' ? parseFloat(value) || 0 : updatedItems[index].unit_price
      updatedItems[index].total_price = quantity * unitPrice
    }

    onChange(updatedItems)
  }

  const removeLineItem = (index) => {
    const updatedItems = items.filter((_, i) => i !== index)
    updatedItems.forEach((item, i) => {
      item.line_number = i + 1
    })
    onChange(updatedItems)
  }

  const updateUom = (index, uomId) => {
    const uom = uomTypes.find(u => u.id === uomId)
    updateLineItem(index, 'uom_id', uomId)
    if (uom) {
      const updatedItems = [...items]
      updatedItems[index].uom_name = uom.name
      onChange(updatedItems)
    }
  }

  const toggleNotes = (itemId) => {
    setExpandedNotes(prev => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  // Filter items for the inline search dropdown
  const filteredItems = allItems.filter(item => {
    if (!emptyRowSearch.trim()) return true
    const term = emptyRowSearch.toLowerCase()
    return (
      item.name.toLowerCase().includes(term) ||
      item.code.toLowerCase().includes(term) ||
      (item.category && item.category.toLowerCase().includes(term))
    )
  })

  // Determine if the last filled row is complete (has item + qty > 0 + price > 0)
  const lastFilledItem = items.length > 0 ? items[items.length - 1] : null
  const lastRowComplete = lastFilledItem
    ? lastFilledItem.item_id && lastFilledItem.quantity > 0 && lastFilledItem.unit_price > 0
    : true // show empty row if no items at all

  // Show the empty "new item" row when: project selected, not disabled, and last row is complete (or no items yet)
  const showEmptyRow = projectAccountId && !disabled && lastRowComplete

  // Running total
  const runningTotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
          {items.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
      </div>

      {!projectAccountId && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          Please select a project first to enable adding items.
        </div>
      )}

      {/* Table Layout */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Column Headers */}
        <div className="hidden sm:grid sm:grid-cols-24 gap-0 bg-gray-50 border-b border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider"
          style={{ gridTemplateColumns: '2rem 1fr 5rem 6.5rem 7rem 7rem 5rem' }}
        >
          <div>#</div>
          <div>Item</div>
          <div>Qty</div>
          <div>UoM</div>
          <div>Unit Price</div>
          <div className="text-right">Total</div>
          <div></div>
        </div>

        {/* Filled Item Rows */}
        <div className="divide-y divide-gray-100">
          {items.map((item, index) => {
            const priceVariance = calculatePriceVariance(item.unit_price, item.preferred_price)
            const hasHighVariance = isPriceVarianceHigh(item.unit_price, item.preferred_price)
            const isNotesExpanded = expandedNotes[item.id]
            const hasNotes = item.notes && item.notes.trim().length > 0

            return (
              <div
                key={item.id}
                className={hasHighVariance ? 'bg-yellow-50' : 'bg-white'}
              >
                {/* Main Row */}
                <div
                  className="px-4 py-3 items-center gap-3 hidden sm:grid"
                  style={{ gridTemplateColumns: '2rem 1fr 5rem 6.5rem 7rem 7rem 5rem' }}
                >
                  {/* Line Number */}
                  <span className="text-xs font-medium text-gray-400">
                    {item.line_number}
                  </span>

                  {/* Item Info */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.item_name}
                    </p>
                    <p className="text-xs text-gray-400">{item.item_code}</p>
                  </div>

                  {/* Quantity */}
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                    disabled={disabled}
                    min="0"
                    step="0.01"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-100"
                  />

                  {/* UoM */}
                  <select
                    value={item.uom_id}
                    onChange={(e) => updateUom(index, e.target.value)}
                    disabled={disabled}
                    className="w-full px-1 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-100"
                  >
                    {uomTypes.map((uom) => (
                      <option key={uom.id} value={uom.id}>
                        {uom.name}
                      </option>
                    ))}
                  </select>

                  {/* Unit Price */}
                  <div>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(index, 'unit_price', e.target.value)}
                      disabled={disabled}
                      min="0"
                      step="0.01"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-100"
                    />
                    {hasHighVariance && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3 text-yellow-600" />
                        <span className="text-xs text-yellow-700">
                          {priceVariance > 0 ? '+' : ''}{priceVariance.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <p className="text-sm font-semibold text-gray-900 text-right">
                    UGX {item.total_price.toLocaleString()}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      type="button"
                      onClick={() => toggleNotes(item.id)}
                      disabled={disabled}
                      className={`p-1.5 rounded-md transition-colors ${
                        hasNotes
                          ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      } disabled:opacity-50`}
                      title={isNotesExpanded ? 'Hide notes' : 'Add/edit notes'}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      disabled={disabled}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Mobile layout */}
                <div className="sm:hidden px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{item.line_number}. {item.item_name}</p>
                      <p className="text-xs text-gray-400">{item.item_code}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button type="button" onClick={() => toggleNotes(item.id)} disabled={disabled}
                        className={`p-1.5 rounded-md ${hasNotes ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400'}`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => removeLineItem(index)} disabled={disabled}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <input type="number" value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                      disabled={disabled} min="0" step="0.01" placeholder="Qty"
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100"
                    />
                    <select value={item.uom_id} onChange={(e) => updateUom(index, e.target.value)}
                      disabled={disabled}
                      className="px-1 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100"
                    >
                      {uomTypes.map((uom) => (
                        <option key={uom.id} value={uom.id}>{uom.name}</option>
                      ))}
                    </select>
                    <input type="number" value={item.unit_price}
                      onChange={(e) => updateLineItem(index, 'unit_price', e.target.value)}
                      disabled={disabled} min="0" step="0.01" placeholder="Price"
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100"
                    />
                    <p className="text-sm font-semibold text-gray-900 text-right self-center">
                      UGX {item.total_price.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Expandable Notes */}
                {isNotesExpanded && (
                  <div className="px-4 pb-3 border-t border-gray-100">
                    <label className="block text-xs font-medium text-gray-500 mb-1 mt-2">Note</label>
                    <textarea
                      value={item.notes || ''}
                      onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                      disabled={disabled}
                      placeholder="Specifications, preferred brand, delivery instructions..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100 resize-none"
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* Empty "Add New Item" Row with inline search */}
          {showEmptyRow && (
            <div className="bg-gray-50/50">
              <div
                className="px-4 py-3 items-center gap-3 hidden sm:grid"
                style={{ gridTemplateColumns: '2rem 1fr 5rem 6.5rem 7rem 7rem 5rem' }}
              >
                {/* Line Number */}
                <span className="text-xs font-medium text-gray-300">
                  {items.length + 1}
                </span>

                {/* Inline Search Input */}
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={emptyRowSearch}
                      onChange={(e) => {
                        setEmptyRowSearch(e.target.value)
                        setShowDropdown(true)
                      }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder="Type to search items..."
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-dashed border-gray-300 rounded-md focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none bg-white placeholder-gray-400"
                    />
                  </div>

                  {/* Dropdown */}
                  {showDropdown && (
                    <div
                      ref={dropdownRef}
                      className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                    >
                      {filteredItems.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                          <p className="text-sm text-gray-500">No items found</p>
                        </div>
                      ) : (
                        filteredItems.slice(0, 50).map((item) => (
                          <button
                            key={item.id}
                            onClick={() => selectItem(item)}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                <p className="text-xs text-gray-400">
                                  {item.code}
                                  {item.category && ` • ${item.category}`}
                                </p>
                              </div>
                              <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                                {item.uom?.name || ''}
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Placeholder columns */}
                <div className="text-xs text-gray-300 text-center">—</div>
                <div className="text-xs text-gray-300 text-center">—</div>
                <div className="text-xs text-gray-300 text-center">—</div>
                <div className="text-xs text-gray-300 text-right">—</div>
                <div></div>
              </div>

              {/* Mobile empty row */}
              <div className="sm:hidden px-4 py-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={emptyRowSearch}
                    onChange={(e) => {
                      setEmptyRowSearch(e.target.value)
                      setShowDropdown(true)
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Type to search and add items..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-dashed border-gray-300 rounded-md focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none bg-white placeholder-gray-400"
                  />
                  {showDropdown && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredItems.length === 0 ? (
                        <div className="px-4 py-4 text-center text-sm text-gray-500">No items found</div>
                      ) : (
                        filteredItems.slice(0, 30).map((item) => (
                          <button key={item.id} onClick={() => selectItem(item)}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 border-b border-gray-50 last:border-0"
                          >
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-400">{item.code}</p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* No items empty state (only when no project or disabled) */}
        {items.length === 0 && !showEmptyRow && (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium mb-1">No items added yet</p>
            <p className="text-sm text-gray-400">
              Select a project above to start adding items
            </p>
          </div>
        )}

        {/* Running Total Footer */}
        {items.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
            <span className="text-sm font-medium text-gray-600">
              Total ({items.length} {items.length === 1 ? 'item' : 'items'})
            </span>
            <span className="text-base font-bold text-gray-900">
              UGX {runningTotal.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Price Variance Warning */}
      {items.some(item => isPriceVarianceHigh(item.unit_price, item.preferred_price)) && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-yellow-800">
              Price Variance Detected
            </h4>
            <p className="text-sm text-yellow-700 mt-1">
              One or more items have a price variance greater than 10% from the preferred price.
              Please review or provide justification.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

LineItemsTable.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    item_id: PropTypes.string,
    item_name: PropTypes.string.isRequired,
    item_code: PropTypes.string,
    quantity: PropTypes.number.isRequired,
    uom_id: PropTypes.string,
    uom_name: PropTypes.string,
    unit_price: PropTypes.number.isRequired,
    total_price: PropTypes.number.isRequired,
    line_number: PropTypes.number,
    notes: PropTypes.string,
    preferred_price: PropTypes.number
  })).isRequired,
  projectAccountId: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool
}

LineItemsTable.defaultProps = {
  projectAccountId: null,
  disabled: false
}

export default memo(LineItemsTable)
