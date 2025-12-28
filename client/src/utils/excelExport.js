import * as XLSX from 'xlsx'
import { formatDate, formatCurrency } from './formatters'
import { STATUS_LABELS } from './constants'
import { logger } from './logger'

/**
 * Excel Export Utilities
 * Functions to export data to Excel files
 */

/**
 * Export requisitions to Excel
 */
export const exportRequisitionsToExcel = (requisitions, filename = 'Requisitions') => {
  try {
    // Prepare data for export
    const data = requisitions.map(req => ({
      'Requisition Number': req.requisition_number || 'DRAFT',
      'Title': req.title,
      'Project': req.project?.name || '',
      'Expense Account': req.expense_account?.name || '',
      'Status': STATUS_LABELS[req.status] || req.status,
      'Submitted By': req.submitted_by_user?.full_name || '',
      'Submitted Date': req.submitted_at ? formatDate(req.submitted_at) : '',
      'Required By': req.required_by ? formatDate(req.required_by) : '',
      'Total Amount': req.total_amount || 0,
      'Description': req.description || '',
      'Justification': req.justification || '',
      'Delivery Location': req.delivery_location || '',
      'Supplier Preference': req.supplier_preference || '',
      'Created Date': formatDate(req.created_at),
      'Updated Date': formatDate(req.updated_at)
    }))

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(data)

    // Set column widths
    const colWidths = [
      { wch: 18 }, // Requisition Number
      { wch: 30 }, // Title
      { wch: 25 }, // Project
      { wch: 20 }, // Expense Account
      { wch: 15 }, // Status
      { wch: 20 }, // Submitted By
      { wch: 15 }, // Submitted Date
      { wch: 15 }, // Required By
      { wch: 15 }, // Total Amount
      { wch: 40 }, // Description
      { wch: 40 }, // Justification
      { wch: 25 }, // Delivery Location
      { wch: 25 }, // Supplier Preference
      { wch: 15 }, // Created Date
      { wch: 15 }  // Updated Date
    ]
    ws['!cols'] = colWidths

    // Format currency column
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 8 }) // Total Amount column
      if (ws[cellAddress]) {
        ws[cellAddress].z = '"$"#,##0.00'
      }
    }

    // Create workbook
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Requisitions')

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0]
    const fullFilename = `${filename}_${timestamp}.xlsx`

    // Save file
    XLSX.writeFile(wb, fullFilename)

    return { success: true }
  } catch (error) {
    logger.error('Error exporting to Excel:', error)
    return { success: false, error }
  }
}

/**
 * Export requisition details (including line items) to Excel
 */
export const exportRequisitionDetailsToExcel = (requisition) => {
  try {
    const wb = XLSX.utils.book_new()

    // Sheet 1: Requisition Header
    const headerData = [
      ['Requisition Number', requisition.requisition_number || 'DRAFT'],
      ['Title', requisition.title],
      ['Project', requisition.project?.name || ''],
      ['Expense Account', requisition.expense_account?.name || ''],
      ['Status', STATUS_LABELS[requisition.status] || requisition.status],
      ['Submitted By', requisition.submitted_by_user?.full_name || ''],
      ['Submitted Date', requisition.submitted_at ? formatDate(requisition.submitted_at) : ''],
      ['Required By', requisition.required_by ? formatDate(requisition.required_by) : ''],
      ['Total Amount', formatCurrency(requisition.total_amount)],
      ['Description', requisition.description || ''],
      ['Justification', requisition.justification || ''],
      ['Delivery Location', requisition.delivery_location || ''],
      ['Supplier Preference', requisition.supplier_preference || '']
    ]

    const wsHeader = XLSX.utils.aoa_to_sheet(headerData)
    wsHeader['!cols'] = [{ wch: 20 }, { wch: 50 }]
    XLSX.utils.book_append_sheet(wb, wsHeader, 'Requisition Details')

    // Sheet 2: Line Items
    if (requisition.requisition_items && requisition.requisition_items.length > 0) {
      const itemsData = requisition.requisition_items.map(item => ({
        'Line #': item.line_number,
        'Item Code': item.item?.code || '',
        'Item Name': item.item?.name || item.item_description,
        'Description': item.item_description || '',
        'Quantity': item.quantity,
        'UOM': item.uom?.name || '',
        'Unit Price': item.unit_price,
        'Total Price': item.total_price,
        'Notes': item.notes || ''
      }))

      const wsItems = XLSX.utils.json_to_sheet(itemsData)
      wsItems['!cols'] = [
        { wch: 8 },  // Line #
        { wch: 15 }, // Item Code
        { wch: 30 }, // Item Name
        { wch: 40 }, // Description
        { wch: 10 }, // Quantity
        { wch: 10 }, // UOM
        { wch: 12 }, // Unit Price
        { wch: 12 }, // Total Price
        { wch: 30 }  // Notes
      ]

      // Format currency columns
      const range = XLSX.utils.decode_range(wsItems['!ref'])
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const unitPriceCell = XLSX.utils.encode_cell({ r: row, c: 6 })
        const totalPriceCell = XLSX.utils.encode_cell({ r: row, c: 7 })
        if (wsItems[unitPriceCell]) wsItems[unitPriceCell].z = '"$"#,##0.00'
        if (wsItems[totalPriceCell]) wsItems[totalPriceCell].z = '"$"#,##0.00'
      }

      XLSX.utils.book_append_sheet(wb, wsItems, 'Line Items')
    }

    // Generate filename
    const reqNumber = requisition.requisition_number || 'DRAFT'
    const filename = `Requisition_${reqNumber}.xlsx`

    // Save file
    XLSX.writeFile(wb, filename)

    return { success: true }
  } catch (error) {
    logger.error('Error exporting requisition details:', error)
    return { success: false, error }
  }
}

/**
 * Export budget summary to Excel
 */
export const exportBudgetSummaryToExcel = (projectName, budgetSummary, expenseBreakdown) => {
  try {
    const wb = XLSX.utils.book_new()

    // Sheet 1: Budget Summary
    const summaryData = [
      ['Project', projectName],
      [''],
      ['Total Budget', budgetSummary.total_budget],
      ['Spent Amount', budgetSummary.spent_amount],
      ['Pending Amount', budgetSummary.pending_amount],
      ['Under Review Amount', budgetSummary.under_review_amount],
      ['Available Budget', budgetSummary.available_budget],
      ['Utilization %', budgetSummary.utilization_percentage]
    ]

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }]

    // Format currency cells
    const currencyRows = [2, 3, 4, 5, 6] // rows with currency values (0-indexed)
    currencyRows.forEach(row => {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 1 })
      if (wsSummary[cellAddress]) {
        wsSummary[cellAddress].z = '"$"#,##0.00'
      }
    })

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Budget Summary')

    // Sheet 2: Expense Breakdown
    if (expenseBreakdown && expenseBreakdown.length > 0) {
      const breakdownData = expenseBreakdown.map(item => ({
        'Expense Account': item.expense_account_name,
        'Spent': item.total_spent,
        'Pending': item.total_pending,
        'Total Committed': item.total_committed
      }))

      const wsBreakdown = XLSX.utils.json_to_sheet(breakdownData)
      wsBreakdown['!cols'] = [
        { wch: 30 }, // Expense Account
        { wch: 15 }, // Spent
        { wch: 15 }, // Pending
        { wch: 18 }  // Total Committed
      ]

      // Format currency columns
      const range = XLSX.utils.decode_range(wsBreakdown['!ref'])
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        for (let col = 1; col <= 3; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
          if (wsBreakdown[cellAddress]) {
            wsBreakdown[cellAddress].z = '"$"#,##0.00'
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, wsBreakdown, 'Expense Breakdown')
    }

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `Budget_${projectName.replace(/\s+/g, '_')}_${timestamp}.xlsx`

    // Save file
    XLSX.writeFile(wb, filename)

    return { success: true }
  } catch (error) {
    logger.error('Error exporting budget summary:', error)
    return { success: false, error }
  }
}
