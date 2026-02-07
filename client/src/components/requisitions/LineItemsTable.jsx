import { useState, useEffect, useCallback, memo, useRef } from 'react'
import PropTypes from 'prop-types'
import { Plus, Trash2, AlertTriangle, Search } from 'lucide-react'
import { getAllItemsForRequisition, getUomTypes, calculatePriceVariance, isPriceVarianceHigh } from '../../services/api/requisitions'

const LineItemsTable = ({ items, projectAccountId, onChange, disabled }) => {
  const [allItems, setAllItems] = useState([])
  const [uomTypes, setUomTypes] = useState([])
  const [showItemSelector, setShowItemSelector] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
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

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
        <button
          onClick={() => setShowItemSelector(true)}
          disabled={disabled || !projectAccountId}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          Add Item
        </button>
      </div>

      {/* Item Selector Modal */}
      {showItemSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Select Item
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, code, or category..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <div className="grid grid-cols-1 gap-2">
                {filteredItems.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No items found. Try a different search term.
                  </p>
                ) : (
                  filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addLineItem(item)}
                      className="text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {item.name}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            Code: {item.code}
                            {item.category && ` • ${item.category}`}
                          </p>
                          {item.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm text-gray-600">
                            {item.uom?.name || 'No UOM'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowItemSelector(false)
                  setSearchTerm('')
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Line Items Table */}
      {items.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-2">No items added yet</p>
          <p className="text-sm text-gray-400">
            Click "Add Item" to add line items to this requisition
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  UoM
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item, index) => {
                const priceVariance = calculatePriceVariance(item.unit_price, item.preferred_price)
                const hasHighVariance = isPriceVarianceHigh(item.unit_price, item.preferred_price)

                return (
                  <tr key={item.id} className={hasHighVariance ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.line_number}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.item_name}
                        </p>
                        <p className="text-xs text-gray-500">{item.item_code}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                        disabled={disabled}
                        min="0"
                        step="0.01"
                        className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.uom_id}
                        onChange={(e) => updateUom(index, e.target.value)}
                        disabled={disabled}
                        className="w-32 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100"
                      >
                        {uomTypes.map((uom) => (
                          <option key={uom.id} value={uom.id}>
                            {uom.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateLineItem(index, 'unit_price', e.target.value)}
                          disabled={disabled}
                          min="0"
                          step="0.01"
                          className="w-32 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100"
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
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      UGX {item.total_price.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                        disabled={disabled}
                        placeholder="Optional notes"
                        className="w-40 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeLineItem(index)}
                        disabled={disabled}
                        className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
