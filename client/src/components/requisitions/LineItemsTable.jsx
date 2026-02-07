import { useState, useEffect, useCallback, memo, useRef } from 'react'
import PropTypes from 'prop-types'
import { Plus, Trash2, AlertTriangle, Search, Package, MessageSquare } from 'lucide-react'
import { getAllItemsForRequisition, getUomTypes, calculatePriceVariance, isPriceVarianceHigh } from '../../services/api/requisitions'

const LineItemsTable = ({ items, projectAccountId, onChange, disabled }) => {
  const [allItems, setAllItems] = useState([])
  const [uomTypes, setUomTypes] = useState([])
  const [showItemSelector, setShowItemSelector] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedNotes, setExpandedNotes] = useState({})
  const tempIdCounterRef = useRef(0)

  const loadAllItems = useCallback(async () => {
    const { data, error } = await getAllItemsForRequisition()
    if (!error && data) {
      setAllItems(data)
    }
  }, [])

  const loadUomTypes = useCallback(async () => {
    const { data, error } = await getUomTypes()
    if (!error && data) {
      setUomTypes(data)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial data load is intentional
    loadUomTypes()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial data load is intentional
    loadAllItems()
  }, [loadUomTypes, loadAllItems])

  const addLineItem = (item) => {
    tempIdCounterRef.current += 1
    const newItem = {
      id: `temp-${tempIdCounterRef.current}`,
      item_id: item.id,
      item_name: item.name,
      item_code: item.code,
      quantity: 1,
      uom_id: item.default_uom_id,
      uom_name: item.uom?.name || '',
      unit_price: 0, // User will enter the price
      total_price: 0,
      line_number: items.length + 1,
      notes: ''
    }

    onChange([...items, newItem])
    setShowItemSelector(false)
    setSearchTerm('')
  }

  const updateLineItem = (index, field, value) => {
    const updatedItems = [...items]
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    }

    // Recalculate total
    if (field === 'quantity' || field === 'unit_price') {
      const quantity = field === 'quantity' ? parseFloat(value) || 0 : updatedItems[index].quantity
      const unitPrice = field === 'unit_price' ? parseFloat(value) || 0 : updatedItems[index].unit_price
      updatedItems[index].total_price = quantity * unitPrice
    }

    onChange(updatedItems)

    // Auto-open item selector when user fills in the last item's price
    // This makes it easier to add multiple items without clicking "Add Item" each time
    if (field === 'unit_price' && parseFloat(value) > 0 && index === updatedItems.length - 1 && !disabled && projectAccountId) {
      // Small delay to let the current input complete
      setTimeout(() => {
        setShowItemSelector(true)
      }, 300)
    }
  }

  const removeLineItem = (index) => {
    const updatedItems = items.filter((_, i) => i !== index)
    // Renumber items
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

  const filteredItems = allItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const toggleNotes = (itemId) => {
    setExpandedNotes(prev => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  // Calculate running total
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
        <button
          onClick={() => setShowItemSelector(true)}
          disabled={disabled || !projectAccountId}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {!projectAccountId && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          Please select a project first to enable adding items.
        </div>
      )}

      {/* Item Selector Modal */}
      {showItemSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Select Item
                </h3>
                <span className="text-sm text-gray-500">
                  {filteredItems.length} available
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, code, or category..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[50vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredItems.length === 0 ? (
                  <div className="col-span-full text-center py-8">
                    <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No items found. Try a different search term.</p>
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addLineItem(item)}
                      className="text-left p-3 border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-all group"
                    >
                      <p className="font-medium text-gray-900 group-hover:text-indigo-700 text-sm">
                        {item.name}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-500">
                          {item.code}
                          {item.category && ` • ${item.category}`}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.uom?.name || 'No UOM'}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowItemSelector(false)
                  setSearchTerm('')
                }}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Line Items - Card Layout */}
      {items.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium mb-1">No items added yet</p>
          <p className="text-sm text-gray-400">
            {projectAccountId 
              ? 'Click "Add Item" to add line items to this requisition'
              : 'Select a project above to start adding items'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Column Headers */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-4">Item</div>
            <div className="col-span-2">Qty &amp; UoM</div>
            <div className="col-span-2">Unit Price</div>
            <div className="col-span-2 text-right">Total</div>
            <div className="col-span-2"></div>
          </div>

          {/* Item Cards */}
          {items.map((item, index) => {
            const priceVariance = calculatePriceVariance(item.unit_price, item.preferred_price)
            const hasHighVariance = isPriceVarianceHigh(item.unit_price, item.preferred_price)
            const isNotesExpanded = expandedNotes[item.id]
            const hasNotes = item.notes && item.notes.trim().length > 0

            return (
              <div
                key={item.id}
                className={`border rounded-lg transition-all ${
                  hasHighVariance
                    ? 'border-yellow-300 bg-yellow-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {/* Main Row */}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  {/* Item Info */}
                  <div className="sm:col-span-4 flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-medium text-gray-600 flex-shrink-0">
                      {item.line_number}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.item_name}
                      </p>
                      <p className="text-xs text-gray-500">{item.item_code}</p>
                    </div>
                  </div>

                  {/* Quantity + UoM */}
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                      disabled={disabled}
                      min="0"
                      step="0.01"
                      className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-100"
                      aria-label="Quantity"
                    />
                    <select
                      value={item.uom_id}
                      onChange={(e) => updateUom(index, e.target.value)}
                      disabled={disabled}
                      className="w-24 px-1 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-100"
                      aria-label="Unit of Measure"
                    >
                      {uomTypes.map((uom) => (
                        <option key={uom.id} value={uom.id}>
                          {uom.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Unit Price */}
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(index, 'unit_price', e.target.value)}
                      disabled={disabled}
                      min="0"
                      step="0.01"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-100"
                      aria-label="Unit Price"
                    />
                    {hasHighVariance && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3 text-yellow-600" />
                        <span className="text-xs text-yellow-700">
                          {priceVariance > 0 ? '+' : ''}{priceVariance.toFixed(1)}% variance
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="sm:col-span-2 text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      UGX {item.total_price.toLocaleString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="sm:col-span-2 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => toggleNotes(item.id)}
                      disabled={disabled}
                      className={`p-1.5 rounded-md transition-colors ${
                        hasNotes 
                          ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' 
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={isNotesExpanded ? 'Hide notes' : 'Add/edit notes'}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      disabled={disabled}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expandable Notes Row */}
                {isNotesExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                    <label className="block text-xs font-medium text-gray-500 mb-1 mt-3">Note for this item</label>
                    <textarea
                      value={item.notes || ''}
                      onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                      disabled={disabled}
                      placeholder="Add a note for this item (e.g., specifications, preferred brand, delivery instructions)..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-100 resize-none"
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* Running Total Footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-sm font-medium text-gray-600">
              Total ({items.length} {items.length === 1 ? 'item' : 'items'})
            </span>
            <span className="text-base font-bold text-gray-900">
              UGX {runningTotal.toLocaleString()}
            </span>
          </div>
        </div>
      )}

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
