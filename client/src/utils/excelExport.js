// Lazy load ExcelJS only when needed (saves ~300KB from initial bundle)
// import ExcelJS from 'exceljs' // Removed - now loaded dynamically

import { formatDate, formatCurrency } from './formatters'
import { STATUS_LABELS } from './constants'
import { logger } from './logger'

/**
 * Excel Export Utilities
 * Functions to export data to Excel files using ExcelJS
 *
 * Note: ExcelJS is lazy-loaded to reduce initial bundle size
 */

/**
 * Lazy load ExcelJS library
 * @returns {Promise<typeof import('exceljs')>}
 */
const loadExcelJS = async () => {
  try {
    const module = await import('exceljs')
    return module.default
  } catch (error) {
    logger.error('Failed to load ExcelJS:', error)
    throw new Error('Could not load Excel export functionality. Please try again.')
  }
}

/**
 * Helper to trigger file download in browser
 */
const downloadExcelFile = async (workbook, filename) => {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Apply header styling to a worksheet
 */
const styleHeaderRow = (worksheet) => {
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' } // Blue-600
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 24
}

/**
 * Export requisitions to Excel
 */
export const exportRequisitionsToExcel = async (requisitions, filename = 'Requisitions') => {
  try {
    // Lazy load ExcelJS (saves ~300KB from initial bundle)
    const ExcelJS = await loadExcelJS()

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'PCM Requisition System'
    workbook.created = new Date()

    const worksheet = workbook.addWorksheet('Requisitions')

    // Define columns
    worksheet.columns = [
      { header: 'Requisition Number', key: 'requisition_number', width: 18 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Project', key: 'project', width: 25 },
      { header: 'Expense Account', key: 'expense_account', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Submitted By', key: 'submitted_by', width: 20 },
      { header: 'Submitted Date', key: 'submitted_date', width: 15 },
      { header: 'Required By', key: 'required_by', width: 15 },
      { header: 'Total Amount', key: 'total_amount', width: 15 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Justification', key: 'justification', width: 40 },
      { header: 'Delivery Location', key: 'delivery_location', width: 25 },
      { header: 'Supplier Preference', key: 'supplier_preference', width: 25 },
      { header: 'Created Date', key: 'created_date', width: 15 },
      { header: 'Updated Date', key: 'updated_date', width: 15 }
    ]

    // Add data rows
    requisitions.forEach(req => {
      worksheet.addRow({
        requisition_number: req.requisition_number || 'DRAFT',
        title: req.title,
        project: req.project?.name || '',
        expense_account: req.expense_account?.name || '',
        status: STATUS_LABELS[req.status] || req.status,
        submitted_by: req.submitted_by_user?.full_name || '',
        submitted_date: req.submitted_at ? formatDate(req.submitted_at) : '',
        required_by: req.required_by ? formatDate(req.required_by) : '',
        total_amount: req.total_amount || 0,
        description: req.description || '',
        justification: req.justification || '',
        delivery_location: req.delivery_location || '',
        supplier_preference: req.supplier_preference || '',
        created_date: formatDate(req.created_at),
        updated_date: formatDate(req.updated_at)
      })
    })

    // Style header row
    styleHeaderRow(worksheet)

    // Format currency column
    worksheet.getColumn('total_amount').numFmt = '"$"#,##0.00'

    // Add alternating row colors
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' } // Gray-100
        }
      }
    })

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0]
    const fullFilename = `${filename}_${timestamp}.xlsx`

    // Download file
    await downloadExcelFile(workbook, fullFilename)

    return { success: true }
  } catch (error) {
    logger.error('Error exporting to Excel:', error)
    return { success: false, error }
  }
}

/**
 * Export requisition details (including line items) to Excel
 */
export const exportRequisitionDetailsToExcel = async (requisition) => {
  try {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'PCM Requisition System'
    workbook.created = new Date()

    // Sheet 1: Requisition Header
    const headerSheet = workbook.addWorksheet('Requisition Details')
    
    headerSheet.columns = [
      { header: 'Field', key: 'field', width: 25 },
      { header: 'Value', key: 'value', width: 50 }
    ]

    const headerData = [
      { field: 'Requisition Number', value: requisition.requisition_number || 'DRAFT' },
      { field: 'Title', value: requisition.title },
      { field: 'Project', value: requisition.project?.name || '' },
      { field: 'Expense Account', value: requisition.expense_account?.name || '' },
      { field: 'Status', value: STATUS_LABELS[requisition.status] || requisition.status },
      { field: 'Submitted By', value: requisition.submitted_by_user?.full_name || '' },
      { field: 'Submitted Date', value: requisition.submitted_at ? formatDate(requisition.submitted_at) : '' },
      { field: 'Required By', value: requisition.required_by ? formatDate(requisition.required_by) : '' },
      { field: 'Total Amount', value: formatCurrency(requisition.total_amount) },
      { field: 'Description', value: requisition.description || '' },
      { field: 'Justification', value: requisition.justification || '' },
      { field: 'Delivery Location', value: requisition.delivery_location || '' },
      { field: 'Supplier Preference', value: requisition.supplier_preference || '' }
    ]

    headerData.forEach(row => headerSheet.addRow(row))
    styleHeaderRow(headerSheet)

    // Style field column
    headerSheet.getColumn('field').font = { bold: true }
    headerSheet.getColumn('field').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' }
    }

    // Sheet 2: Line Items
    if (requisition.requisition_items && requisition.requisition_items.length > 0) {
      const itemsSheet = workbook.addWorksheet('Line Items')

      itemsSheet.columns = [
        { header: 'Line #', key: 'line_number', width: 8 },
        { header: 'Item Code', key: 'item_code', width: 15 },
        { header: 'Item Name', key: 'item_name', width: 30 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'UOM', key: 'uom', width: 10 },
        { header: 'Unit Price', key: 'unit_price', width: 12 },
        { header: 'Total Price', key: 'total_price', width: 12 },
        { header: 'Notes', key: 'notes', width: 30 }
      ]

      requisition.requisition_items.forEach(item => {
        itemsSheet.addRow({
          line_number: item.line_number,
          item_code: item.item?.code || '',
          item_name: item.item?.name || item.item_description,
          description: item.item_description || '',
          quantity: item.quantity,
          uom: item.uom?.name || '',
          unit_price: item.unit_price,
          total_price: item.total_price,
          notes: item.notes || ''
        })
      })

      styleHeaderRow(itemsSheet)

      // Format currency columns
      itemsSheet.getColumn('unit_price').numFmt = '"$"#,##0.00'
      itemsSheet.getColumn('total_price').numFmt = '"$"#,##0.00'

      // Add total row
      const totalRow = itemsSheet.addRow({
        line_number: '',
        item_code: '',
        item_name: '',
        description: '',
        quantity: '',
        uom: '',
        unit_price: 'TOTAL:',
        total_price: requisition.total_amount,
        notes: ''
      })
      totalRow.font = { bold: true }
      totalRow.getCell('total_price').numFmt = '"$"#,##0.00'
    }

    // Generate filename
    const reqNumber = requisition.requisition_number || 'DRAFT'
    const filename = `Requisition_${reqNumber}.xlsx`

    // Download file
    await downloadExcelFile(workbook, filename)

    return { success: true }
  } catch (error) {
    logger.error('Error exporting requisition details:', error)
    return { success: false, error }
  }
}

/**
 * Export budget summary to Excel
 */
export const exportBudgetSummaryToExcel = async (projectName, budgetSummary, expenseBreakdown) => {
  try {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'PCM Requisition System'
    workbook.created = new Date()

    // Sheet 1: Budget Summary
    const summarySheet = workbook.addWorksheet('Budget Summary')

    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 25 },
      { header: 'Value', key: 'value', width: 20 }
    ]

    const summaryData = [
      { metric: 'Project', value: projectName },
      { metric: '', value: '' },
      { metric: 'Total Budget', value: budgetSummary.total_budget },
      { metric: 'Spent Amount', value: budgetSummary.spent_amount },
      { metric: 'Pending Amount', value: budgetSummary.pending_amount },
      { metric: 'Under Review Amount', value: budgetSummary.under_review_amount },
      { metric: 'Available Budget', value: budgetSummary.available_budget },
      { metric: 'Utilization %', value: `${budgetSummary.utilization_percentage}%` }
    ]

    summaryData.forEach(row => summarySheet.addRow(row))
    styleHeaderRow(summarySheet)

    // Format currency cells (rows 3-7)
    for (let i = 3; i <= 7; i++) {
      const cell = summarySheet.getCell(`B${i}`)
      cell.numFmt = '"$"#,##0.00'
    }

    // Sheet 2: Expense Breakdown
    if (expenseBreakdown && expenseBreakdown.length > 0) {
      const breakdownSheet = workbook.addWorksheet('Expense Breakdown')

      breakdownSheet.columns = [
        { header: 'Expense Account', key: 'expense_account', width: 30 },
        { header: 'Spent', key: 'spent', width: 15 },
        { header: 'Pending', key: 'pending', width: 15 },
        { header: 'Total Committed', key: 'total_committed', width: 18 }
      ]

      expenseBreakdown.forEach(item => {
        breakdownSheet.addRow({
          expense_account: item.expense_account_name,
          spent: item.total_spent,
          pending: item.total_pending,
          total_committed: item.total_committed
        })
      })

      styleHeaderRow(breakdownSheet)

      // Format currency columns
      breakdownSheet.getColumn('spent').numFmt = '"$"#,##0.00'
      breakdownSheet.getColumn('pending').numFmt = '"$"#,##0.00'
      breakdownSheet.getColumn('total_committed').numFmt = '"$"#,##0.00'
    }

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `Budget_${projectName.replace(/\s+/g, '_')}_${timestamp}.xlsx`

    // Download file
    await downloadExcelFile(workbook, filename)

    return { success: true }
  } catch (error) {
    logger.error('Error exporting budget summary:', error)
    return { success: false, error }
  }
}

/**
 * Export generic data to Excel
 */
export const exportToExcel = async (data, columns, sheetName = 'Data', filename = 'Export') => {
  try {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'PCM Requisition System'
    workbook.created = new Date()

    const worksheet = workbook.addWorksheet(sheetName)

    // Set columns
    worksheet.columns = columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 15
    }))

    // Add data rows
    data.forEach(row => worksheet.addRow(row))

    // Style header
    styleHeaderRow(worksheet)

    // Apply number formatting
    columns.forEach(col => {
      if (col.numFmt) {
        worksheet.getColumn(col.key).numFmt = col.numFmt
      }
    })

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0]
    const fullFilename = `${filename}_${timestamp}.xlsx`

    // Download file
    await downloadExcelFile(workbook, fullFilename)

    return { success: true }
  } catch (error) {
    logger.error('Error exporting to Excel:', error)
    return { success: false, error }
  }
}
