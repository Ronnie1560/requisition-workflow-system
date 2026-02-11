/**
 * SearchableSelect Component
 *
 * A reusable searchable combobox that replaces plain <select> dropdowns.
 * Supports type-to-filter, keyboard navigation, and click-outside-to-close.
 *
 * Props:
 *   options       - Array of option objects
 *   value         - Currently selected value (matches option[valueField])
 *   onChange      - Called with { target: { name, value } } to mimic native select
 *   name          - Form field name (passed through onChange)
 *   placeholder   - Placeholder when nothing selected
 *   disabled      - Disable the control
 *   labelFn       - (option) => display string  (default: option.name)
 *   valueField    - Key to use as option value   (default: 'id')
 *   filterFn      - (option, searchTerm) => bool (custom filter)
 *   emptyMessage  - Message when no options match
 *   id            - HTML id for the input
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'
import { Search, ChevronDown, X } from 'lucide-react'

function SearchableSelect({
  options = [],
  value,
  onChange,
  name,
  placeholder = 'Select...',
  disabled = false,
  labelFn,
  valueField = 'id',
  filterFn,
  emptyMessage = 'No matches found',
  id,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(-1)

  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Resolve the label for an option
  const getLabel = useCallback(
    (option) => {
      if (labelFn) return labelFn(option)
      return option.name || String(option[valueField])
    },
    [labelFn, valueField]
  )

  // Currently selected option object
  const selectedOption = useMemo(
    () => options.find((o) => String(o[valueField]) === String(value)),
    [options, value, valueField]
  )

  // Filter options by search term
  const filtered = useMemo(() => {
    if (!search.trim()) return options
    const term = search.toLowerCase()
    if (filterFn) return options.filter((o) => filterFn(o, term))
    return options.filter((o) => getLabel(o).toLowerCase().includes(term))
  }, [options, search, filterFn, getLabel])

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setSearch('')
        setHighlightIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIndex]
      if (el) el.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex])

  // Select an option
  const selectOption = useCallback(
    (option) => {
      onChange({ target: { name, value: option[valueField] } })
      setIsOpen(false)
      setSearch('')
      setHighlightIndex(-1)
    },
    [onChange, name, valueField]
  )

  // Clear selection
  const clearSelection = useCallback(
    (e) => {
      e.stopPropagation()
      onChange({ target: { name, value: '' } })
      setSearch('')
    },
    [onChange, name]
  )

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setIsOpen(true)
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightIndex((prev) =>
            prev > 0 ? prev - 1 : filtered.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (highlightIndex >= 0 && highlightIndex < filtered.length) {
            selectOption(filtered[highlightIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          setSearch('')
          setHighlightIndex(-1)
          break
        default:
          break
      }
    },
    [isOpen, filtered, highlightIndex, selectOption]
  )

  // Open dropdown and focus search input
  const openDropdown = useCallback(() => {
    if (disabled) return
    setIsOpen(true)
    setHighlightIndex(-1)
    // Focus the search input after React renders
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [disabled])

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button — shows selected value or placeholder */}
      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={isOpen ? () => { setIsOpen(false); setSearch('') } : openDropdown}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-left
          border-gray-300 dark:border-gray-600
          bg-white dark:bg-gray-700 text-gray-900 dark:text-white
          focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed
          ${isOpen ? 'ring-2 ring-primary-500 border-primary-500' : ''}`}
      >
        <span className={`truncate ${!selectedOption ? 'text-gray-400 dark:text-gray-500' : ''}`}>
          {selectedOption ? getLabel(selectedOption) : placeholder}
        </span>
        <span className="flex items-center gap-1 ml-2 flex-shrink-0">
          {selectedOption && !disabled && (
            <X
              className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
              onClick={clearSelection}
            />
          )}
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setHighlightIndex(0)
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type to search..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
          </div>

          {/* Options list */}
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto py-1"
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
                {emptyMessage}
              </li>
            ) : (
              filtered.map((option, idx) => {
                const isSelected = String(option[valueField]) === String(value)
                const isHighlighted = idx === highlightIndex
                return (
                  <li
                    key={option[valueField]}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectOption(option)}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between
                      ${isHighlighted
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                      ${isSelected ? 'font-medium' : ''}`}
                  >
                    <span className="truncate">{getLabel(option)}</span>
                    {isSelected && (
                      <span className="text-primary-600 dark:text-primary-400 ml-2 flex-shrink-0">✓</span>
                    )}
                  </li>
                )
              })
            )}
          </ul>

          {/* Footer: result count */}
          {filtered.length > 0 && search && (
            <div className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
              {filtered.length} of {options.length} results
            </div>
          )}
        </div>
      )}
    </div>
  )
}

SearchableSelect.propTypes = {
  options: PropTypes.array.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  labelFn: PropTypes.func,
  valueField: PropTypes.string,
  filterFn: PropTypes.func,
  emptyMessage: PropTypes.string,
  id: PropTypes.string,
}

export default SearchableSelect
