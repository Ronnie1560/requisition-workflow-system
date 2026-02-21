import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Upload, Download, FileSpreadsheet, AlertCircle,
  CheckCircle, Loader, X, AlertTriangle, FileText
} from 'lucide-react'
import { bulkCreateItems, getAllUOMTypes } from '../../services/api/items'
import { getActiveCategories } from '../../services/api/categories'
import { logger } from '../../utils/logger'
import { useEffect } from 'react'

const REQUIRED_COLUMNS = ['name']
const OPTIONAL_COLUMNS = ['code', 'description', 'category', 'uom']
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]

const ImportItems = () => {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [step, setStep] = useState('upload') // upload | preview | importing | done
  const [file, setFile] = useState(null)
  const [parsedRows, setParsedRows] = useState([])
  const [validRows, setValidRows] = useState([])
  const [invalidRows, setInvalidRows] = useState([])
  const [categories, setCategories] = useState([])
  const [uomTypes, setUomTypes] = useState([])
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    loadReferenceData()
  }, [])

  const loadReferenceData = async () => {
    try {
      const [catResult, uomResult] = await Promise.all([
        getActiveCategories(),
        getAllUOMTypes()
      ])
      setCategories(catResult.data || [])
      setUomTypes(uomResult.data || [])
    } catch (err) {
      logger.error('Error loading reference data:', err)
    }
  }

  const generateTemplate = () => {
    const headers = ALL_COLUMNS.join(',')
    const exampleRows = [
      'Ballpoint Pen,,Blue ink ballpoint pen,Office Supplies,EA',
      'A4 Paper,,80gsm white A4 paper (500 sheets),Office Supplies,PKT',
      'Stapler,,Heavy-duty desktop stapler,Office Supplies,EA',
    ]
    const csv = [headers, ...exampleRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'items_import_template.csv'
    link.click()
  }

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim())
    if (lines.length < 2) return { headers: [], rows: [] }

    // Parse header
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase())

    // Parse data rows
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.every(v => !v.trim())) continue // skip empty rows

      const row = {}
      headers.forEach((header, idx) => {
        row[header] = values[idx]?.trim() || ''
      })
      row._row = i + 1 // 1-based row number for display
      rows.push(row)
    }

    return { headers, rows }
  }

  // Handle quoted CSV fields properly
  const parseCSVLine = (line) => {
    const result = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    result.push(current)
    return result
  }

  const matchCategory = (name) => {
    if (!name) return null
    const lower = name.toLowerCase().trim()
    const match = categories.find(c =>
      c.name.toLowerCase() === lower || c.code?.toLowerCase() === lower
    )
    return match?.id || null
  }

  const matchUOM = (name) => {
    if (!name) return null
    const lower = name.toLowerCase().trim()
    const match = uomTypes.find(u =>
      u.code.toLowerCase() === lower ||
      u.name.toLowerCase() === lower
    )
    return match?.id || null
  }

  const validateAndMap = useCallback((rows) => {
    const valid = []
    const invalid = []

    rows.forEach(row => {
      const errors = []

      if (!row.name?.trim()) {
        errors.push('Name is required')
      }

      // Map category name to ID
      const category_id = matchCategory(row.category)
      if (row.category && !category_id) {
        errors.push(`Unknown category: "${row.category}"`)
      }

      // Map UOM name/code to ID
      const default_uom_id = matchUOM(row.uom)
      if (row.uom && !default_uom_id) {
        errors.push(`Unknown UOM: "${row.uom}"`)
      }

      const mapped = {
        _row: row._row,
        name: row.name?.trim() || '',
        code: row.code?.trim() || '',
        description: row.description?.trim() || '',
        category: row.category || '',
        uom: row.uom || '',
        category_id,
        default_uom_id,
        errors
      }

      if (errors.length > 0) {
        invalid.push(mapped)
      } else {
        valid.push(mapped)
      }
    })

    return { valid, invalid }
  }, [categories, uomTypes])

  const handleFile = (selectedFile) => {
    setError('')
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB')
      return
    }

    setFile(selectedFile)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const { headers, rows } = parseCSV(e.target.result)

        if (!headers.includes('name')) {
          setError('CSV must contain a "name" column. Download the template for the expected format.')
          return
        }

        setParsedRows(rows)
        const { valid, invalid } = validateAndMap(rows)
        setValidRows(valid)
        setInvalidRows(invalid)
        setStep('preview')
      } catch (err) {
        logger.error('CSV parse error:', err)
        setError('Failed to parse CSV file. Please check the format.')
      }
    }
    reader.readAsText(selectedFile)
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleImport = async () => {
    if (validRows.length === 0) return

    setImporting(true)
    setStep('importing')

    try {
      const itemsToCreate = validRows.map(row => ({
        name: row.name,
        code: row.code || null,
        description: row.description || null,
        category_id: row.category_id,
        default_uom_id: row.default_uom_id,
      }))

      const { data, error } = await bulkCreateItems(itemsToCreate)

      if (error) throw error

      setResults(data)
      setStep('done')
    } catch (err) {
      logger.error('Import error:', err)
      setError(err.message || 'Import failed')
      setStep('preview')
    } finally {
      setImporting(false)
    }
  }

  const resetImport = () => {
    setFile(null)
    setParsedRows([])
    setValidRows([])
    setInvalidRows([])
    setResults(null)
    setError('')
    setStep('upload')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/items')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Items</h1>
          <p className="text-sm text-gray-600 mt-1">
            Bulk import items from a CSV file
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Upload CSV File</h2>
            <p className="text-sm text-gray-600">
              Upload a CSV file with your items. The file must include a <strong>name</strong> column.
              Optional columns: <strong>code</strong>, <strong>description</strong>, <strong>category</strong>, <strong>uom</strong>.
            </p>
          </div>

          {/* Template download */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">Download Template</p>
                <p className="text-xs text-blue-700">Get a sample CSV with the expected format and example data</p>
              </div>
            </div>
            <button
              onClick={generateTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              Template
            </button>
          </div>

          {/* Reference data info */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-700 mb-2">Available Categories ({categories.length})</p>
              <div className="flex flex-wrap gap-1">
                {categories.slice(0, 10).map(c => (
                  <span key={c.id} className="text-xs bg-white px-2 py-0.5 rounded border">{c.name}</span>
                ))}
                {categories.length > 10 && (
                  <span className="text-xs text-gray-500">+{categories.length - 10} more</span>
                )}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-700 mb-2">Available UOM Types ({uomTypes.length})</p>
              <div className="flex flex-wrap gap-1">
                {uomTypes.slice(0, 10).map(u => (
                  <span key={u.id} className="text-xs bg-white px-2 py-0.5 rounded border">{u.code} ({u.name})</span>
                ))}
                {uomTypes.length > 10 && (
                  <span className="text-xs text-gray-500">+{uomTypes.length - 10} more</span>
                )}
              </div>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
            }`}
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">
              {dragActive ? 'Drop your CSV file here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-gray-500 mt-1">CSV files only, max 5MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{file?.name}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600">Total: <strong>{parsedRows.length}</strong></span>
                <span className="text-green-600">Valid: <strong>{validRows.length}</strong></span>
                {invalidRows.length > 0 && (
                  <span className="text-red-600">Errors: <strong>{invalidRows.length}</strong></span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={resetImport}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Start Over
              </button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                Import {validRows.length} Item{validRows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>

          {/* Invalid rows */}
          {invalidRows.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-medium text-red-800">
                  {invalidRows.length} row{invalidRows.length !== 1 ? 's' : ''} with errors (will be skipped)
                </h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {invalidRows.map((row, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-red-500 font-mono text-xs min-w-[3rem]">Row {row._row}</span>
                    <span className="text-red-700">
                      {row.name || '(empty)'}: {row.errors.join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700">
                Preview — {validRows.length} items ready to import
              </h3>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Row</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Code</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name *</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">UOM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {validRows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-500 font-mono">{row._row}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{row.code || <span className="text-gray-400 italic">Auto</span>}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{row.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">{row.description || '—'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.category || '—'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.uom || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Importing */}
      {step === 'importing' && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <Loader className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">Importing Items...</h2>
          <p className="text-sm text-gray-600 mt-2">
            Creating {validRows.length} items. This may take a moment.
          </p>
        </div>
      )}

      {/* Step 4: Results */}
      {step === 'done' && results && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Import Complete</h2>
                <p className="text-sm text-gray-600">
                  {results.created.length} item{results.created.length !== 1 ? 's' : ''} created successfully
                  {results.errors.length > 0 && `, ${results.errors.length} failed`}
                </p>
              </div>
            </div>

            {/* Created items */}
            {results.created.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Created Items</h3>
                <div className="bg-green-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {results.created.map((item, i) => (
                      <div key={i} className="text-sm flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                        <span className="text-gray-700 font-mono text-xs">{item.code}</span>
                        <span className="text-gray-900 truncate">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Failed items */}
            {results.errors.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-red-700 mb-2">Failed Items</h3>
                <div className="bg-red-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {results.errors.map((err, i) => (
                    <div key={i} className="text-sm flex items-start gap-2 mb-1">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                      <span className="text-red-700">Row {err.row}: {err.name || '(empty)'} — {err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={() => navigate('/items')}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
              >
                View Items
              </button>
              <button
                onClick={resetImport}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
              >
                Import More
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImportItems
