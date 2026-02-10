import { formatCurrency, formatDate } from './formatters'
import { getOrganizationSettings } from '../services/api/systemSettings'
import { logger } from './logger'

// ============================================================================
// HTML Escaping (prevents stored XSS in print/export output)
// ============================================================================

const escapeHtml = (str) => {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ============================================================================
// Organization Name Helper
// ============================================================================

const DEFAULT_ORG_NAME = 'Your Organization Name'

/**
 * Ensure organization name is loaded (fetches fresh data if using default placeholder)
 * This prevents print/export from showing placeholder text when settings haven't loaded yet
 * 
 * @param {string} organizationName - The organization name from context/props
 * @returns {Promise<string>} - The resolved organization name
 */
const ensureOrganizationName = async (organizationName) => {
  // If we have a real organization name (not the default placeholder), use it
  if (organizationName && organizationName !== DEFAULT_ORG_NAME) {
    return organizationName
  }

  // Otherwise, try to fetch fresh data from the API
  try {
    logger.debug('[requisitionExport] Organization name not loaded, fetching from API...')
    const { data, error } = await getOrganizationSettings()
    
    if (!error && data?.organization_name) {
      logger.debug('[requisitionExport] Successfully fetched organization name:', data.organization_name)
      return data.organization_name
    }
  } catch (e) {
    logger.warn('[requisitionExport] Could not fetch organization settings:', e)
  }

  // Fallback to whatever was passed (or default)
  return organizationName || DEFAULT_ORG_NAME
}

// ============================================================================
// Number to Words Conversion
// ============================================================================

/**
 * Convert number to words
 */
const numberToWords = (num) => {
  if (num === 0) return 'Zero'

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']

  const convertLessThanThousand = (n) => {
    if (n === 0) return ''

    if (n < 10) return ones[n]
    if (n < 20) return teens[n - 10]
    if (n < 100) {
      const ten = Math.floor(n / 10)
      const one = n % 10
      return tens[ten] + (one > 0 ? ' ' + ones[one] : '')
    }

    const hundred = Math.floor(n / 100)
    const rest = n % 100
    return ones[hundred] + ' Hundred' + (rest > 0 ? ' and ' + convertLessThanThousand(rest) : '')
  }

  if (num < 1000) return convertLessThanThousand(num)

  if (num < 1000000) {
    const thousands = Math.floor(num / 1000)
    const rest = num % 1000
    return convertLessThanThousand(thousands) + ' Thousand' + (rest > 0 ? ' ' + convertLessThanThousand(rest) : '')
  }

  if (num < 1000000000) {
    const millions = Math.floor(num / 1000000)
    const rest = num % 1000000
    let result = convertLessThanThousand(millions) + ' Million'
    if (rest >= 1000) {
      const thousands = Math.floor(rest / 1000)
      const remainder = rest % 1000
      result += ' ' + convertLessThanThousand(thousands) + ' Thousand'
      if (remainder > 0) result += ' ' + convertLessThanThousand(remainder)
    } else if (rest > 0) {
      result += ' ' + convertLessThanThousand(rest)
    }
    return result
  }

  return 'Amount too large'
}

/**
 * Convert currency amount to words (Uganda Shillings)
 */
export const amountToWords = (amount) => {
  if (!amount || isNaN(amount)) return 'Zero Uganda Shillings Only'

  const absAmount = Math.abs(amount)
  const shillings = Math.floor(absAmount)
  const cents = Math.round((absAmount - shillings) * 100)

  let result = numberToWords(shillings) + ' Uganda Shilling' + (shillings !== 1 ? 's' : '')

  if (cents > 0) {
    result += ' and ' + numberToWords(cents) + ' Cent' + (cents !== 1 ? 's' : '')
  }

  result += ' Only'

  return result
}

// ============================================================================
// CSV Export
// ============================================================================

/**
 * Export requisition to CSV format
 * @param {Object} requisition - The requisition data
 * @param {string} organizationName - Organization name (will be fetched if not loaded)
 */
export const exportRequisitionToCSV = async (requisition, organizationName = DEFAULT_ORG_NAME) => {
  if (!requisition) return

  // Ensure organization name is loaded before export
  const orgName = await ensureOrganizationName(organizationName)

  // Prepare requisition header info
  const headerInfo = [
    ['Requisition Export'],
    ['Organization', orgName],
    [],
    ['Requisition Number', requisition.requisition_number || 'DRAFT'],
    ['Title', requisition.title],
    ['Status', requisition.status],
    ['Project', `${requisition.project?.name} (${requisition.project?.code})`],
    ['Expense Account', `${requisition.expense_account?.name || 'N/A'} (${requisition.expense_account?.code || ''})`],
    ['Submitted By', requisition.submitted_by_user?.full_name || 'N/A'],
    ['Submitted On', requisition.submitted_at ? formatDate(requisition.submitted_at) : 'Not submitted'],
    ['Required By', requisition.required_by ? formatDate(requisition.required_by) : 'N/A'],
    ['Description', requisition.description || ''],
    ['Justification', requisition.justification || ''],
    [],
    ['Line Items'],
    ['#', 'Item Code', 'Item Name', 'Description', 'Quantity', 'UOM', 'Unit Price', 'Total Price']
  ]

  // Add line items
  const lineItems = (requisition.requisition_items || []).map(item => [
    item.line_number,
    item.item?.code || '',
    item.item?.name || '',
    item.item_description || '',
    item.quantity,
    item.uom?.name || '',
    item.unit_price,
    item.total_price
  ])

  // Add total row
  const totalRow = ['', '', '', '', '', '', 'GRAND TOTAL', requisition.total_amount]

  // Combine all data
  const csvData = [...headerInfo, ...lineItems, [], totalRow]

  // Convert to CSV string
  const csvContent = csvData
    .map(row =>
      row.map(cell => {
        // Handle cells with commas, quotes, or newlines
        const cellStr = String(cell || '')
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`
        }
        return cellStr
      }).join(',')
    )
    .join('\n')

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `requisition_${requisition.requisition_number || 'draft'}_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// ============================================================================
// Printable HTML Generation
// ============================================================================

/**
 * Generate printable HTML for requisition
 * @param {Object} requisition - The requisition data
 * @param {Object|string} organization - Organization object with full details, or just name as string
 */
export const generatePrintableHTML = (requisition, organization = DEFAULT_ORG_NAME) => {
  if (!requisition) return ''

  // Handle both organization object and simple string name (backward compatibility)
  const isOrgObject = typeof organization === 'object' && organization !== null
  const orgName = escapeHtml(isOrgObject ? organization.name : organization)
  const orgEmail = isOrgObject ? escapeHtml(organization.email) : null
  const orgPhone = isOrgObject ? escapeHtml(organization.phone) : null
  const orgWebsite = isOrgObject ? escapeHtml(organization.website) : null
  const orgAddress = isOrgObject && organization.address_line1 ?
    [
      escapeHtml(organization.address_line1),
      escapeHtml(organization.address_line2),
      [escapeHtml(organization.city), escapeHtml(organization.state_province)].filter(Boolean).join(', '),
      [escapeHtml(organization.postal_code), escapeHtml(organization.country)].filter(Boolean).join(', ')
    ].filter(Boolean).join('<br>') : null

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Requisition - ${requisition.requisition_number || 'DRAFT'}</title>
      <style>
        @media print {
          @page {
            margin: 15mm;
            size: A4;
          }
          body {
            margin: 0;
            padding: 0;
          }
          .no-print { display: none; }
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 10px;
          line-height: 1.4;
          color: #222;
          background: white;
          padding: 15px;
        }

        /* Header Section */
        .document-header {
          border-bottom: 3px solid #2563eb;
          padding-bottom: 12px;
          margin-bottom: 15px;
        }

        .org-name {
          font-size: 18px;
          font-weight: bold;
          color: #1e40af;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .doc-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 6px;
        }

        .doc-type {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .doc-number {
          font-size: 12px;
          font-weight: bold;
          color: #1e40af;
          background: #eff6ff;
          padding: 4px 12px;
          border-radius: 4px;
        }

        .status-row {
          text-align: right;
          margin-top: 6px;
        }

        .status-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          background: #e5e7eb;
          color: #374151;
          letter-spacing: 0.5px;
        }

        /* Info Grid */
        .info-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 12px;
          padding: 10px;
          background: #f9fafb;
          border-radius: 4px;
        }

        .info-row {
          display: flex;
          padding: 4px 0;
        }

        .info-label {
          font-weight: 600;
          color: #6b7280;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          min-width: 85px;
          flex-shrink: 0;
        }

        .info-value {
          color: #111827;
          font-size: 10px;
          font-weight: 500;
          flex-grow: 1;
        }

        .info-value-large {
          font-size: 14px;
          font-weight: 700;
          color: #059669;
        }

        .info-value small {
          display: block;
          font-size: 8px;
          color: #6b7280;
          margin-top: 1px;
        }

        /* Description/Justification */
        .text-sections-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }

        .text-section {
          padding: 8px;
          background: #fefce8;
          border-left: 3px solid #eab308;
          border-radius: 2px;
        }

        .text-section-full {
          grid-column: 1 / -1;
        }

        .text-section-title {
          font-size: 9px;
          font-weight: 600;
          color: #713f12;
          text-transform: uppercase;
          margin-bottom: 4px;
          letter-spacing: 0.3px;
        }

        .text-section-content {
          font-size: 9px;
          color: #422006;
          line-height: 1.5;
        }

        /* Table */
        .items-section {
          margin-bottom: 12px;
        }

        .section-header {
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
          padding-bottom: 4px;
          border-bottom: 2px solid #e5e7eb;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9px;
        }

        th {
          background: #f3f4f6;
          padding: 6px 4px;
          text-align: left;
          font-weight: 600;
          color: #4b5563;
          border-bottom: 2px solid #d1d5db;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        td {
          padding: 5px 4px;
          border-bottom: 1px solid #e5e7eb;
          color: #374151;
        }

        tbody tr:hover {
          background: #f9fafb;
        }

        .text-right {
          text-align: right;
        }

        .text-center {
          text-align: center;
        }

        tfoot td {
          font-weight: 700;
          background: #f3f4f6;
          border-top: 2px solid #9ca3af;
          border-bottom: none;
          padding: 8px 4px;
          font-size: 10px;
        }

        .total-value {
          font-size: 12px;
          color: #059669;
        }

        .total-words {
          font-size: 9px;
          color: #059669;
          font-style: italic;
          padding: 4px 4px !important;
        }

        /* Signature Section */
        .signature-section {
          margin-top: 30px;
          margin-bottom: 20px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }

        .signature-box {
          padding: 10px 0;
        }

        .signature-label {
          font-size: 10px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 25px;
        }

        .signature-line {
          border-bottom: 1px dotted #9ca3af;
          min-height: 1px;
          margin-bottom: 5px;
        }

        .signature-sublabel {
          font-size: 8px;
          color: #6b7280;
          text-align: center;
        }

        /* Footer */
        .document-footer {
          margin-top: 20px;
          padding-top: 10px;
          border-top: 1px solid #d1d5db;
          text-align: center;
          font-size: 8px;
          color: #9ca3af;
        }

        .document-footer p {
          margin: 2px 0;
        }

        /* Compact adjustments */
        .compact {
          line-height: 1.3;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="document-header">
        <div class="org-name">${orgName}</div>
        ${orgAddress || orgEmail || orgPhone || orgWebsite ? `
        <div style="font-size: 8px; color: #6b7280; margin-top: 4px; line-height: 1.5;">
          ${orgAddress ? `<div>${orgAddress}</div>` : ''}
          ${orgEmail || orgPhone || orgWebsite ? `
          <div style="margin-top: 2px;">
            ${orgEmail ? `📧 ${orgEmail}` : ''}
            ${orgPhone ? `${orgEmail ? ' &nbsp;•&nbsp; ' : ''}📞 ${orgPhone}` : ''}
            ${orgWebsite ? `${orgEmail || orgPhone ? ' &nbsp;•&nbsp; ' : ''}🌐 ${orgWebsite}` : ''}
          </div>
          ` : ''}
        </div>
        ` : ''}
        <div class="doc-title-row">
          <span class="doc-type">Purchase Requisition</span>
          <span class="doc-number">${escapeHtml(requisition.requisition_number) || 'DRAFT'}</span>
        </div>
        <div class="doc-title-row" style="margin-top: 8px;">
          <span style="font-size: 10px; color: #6b7280;"><strong>DATE:</strong> ${requisition.submitted_at ? formatDate(requisition.submitted_at) : formatDate(new Date().toISOString())}</span>
          <span class="status-badge">${escapeHtml(requisition.status?.replace('_', ' ').toUpperCase()) || 'DRAFT'}</span>
        </div>
      </div>

      <!-- Info Grid -->
      <div class="info-section">
        <div class="info-row">
          <span class="info-label">Title:</span>
          <span class="info-value">${escapeHtml(requisition.title) || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Total Amount:</span>
          <span class="info-value info-value-large">${formatCurrency(requisition.total_amount)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Project:</span>
          <span class="info-value">${escapeHtml(requisition.project?.name) || 'N/A'}<small>${escapeHtml(requisition.project?.code)}</small></span>
        </div>
        <div class="info-row">
          <span class="info-label">Account:</span>
          <span class="info-value">${escapeHtml(requisition.expense_account?.name) || 'N/A'}<small>${escapeHtml(requisition.expense_account?.code)}</small></span>
        </div>
        <div class="info-row">
          <span class="info-label">Submitted By:</span>
          <span class="info-value">${escapeHtml(requisition.submitted_by_user?.full_name) || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Required By:</span>
          <span class="info-value">${requisition.required_by ? formatDate(requisition.required_by) : 'N/A'}</span>
        </div>
      </div>

      ${requisition.description || requisition.justification ? `
      <div class="text-sections-container">
        ${requisition.description ? `
        <div class="text-section ${!requisition.justification ? 'text-section-full' : ''}">
          <div class="text-section-title">Description</div>
          <div class="text-section-content">${escapeHtml(requisition.description)}</div>
        </div>
        ` : ''}
        ${requisition.justification ? `
        <div class="text-section ${!requisition.description ? 'text-section-full' : ''}">
          <div class="text-section-title">Justification</div>
          <div class="text-section-content">${escapeHtml(requisition.justification)}</div>
        </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- Line Items -->
      <div class="items-section">
        <div class="section-header">Line Items</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25px;" class="text-center">#</th>
              <th style="width: 80px;">Code</th>
              <th>Item Description</th>
              <th style="width: 50px; padding-right: 12px;" class="text-right">Qty</th>
              <th style="width: 45px;">UOM</th>
              <th style="width: 70px;" class="text-right">Unit Price</th>
              <th style="width: 75px;" class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(requisition.requisition_items || []).map(item => `
              <tr>
                <td class="text-center">${item.line_number}</td>
                <td>${escapeHtml(item.item?.code)}</td>
                <td>
                  <strong>${escapeHtml(item.item?.name)}</strong>
                  ${item.item_description ? `<br><span style="font-size: 8px; color: #6b7280;">${escapeHtml(item.item_description)}</span>` : ''}
                </td>
                <td class="text-right" style="padding-right: 12px;">${item.quantity}</td>
                <td>${escapeHtml(item.uom?.name)}</td>
                <td class="text-right">${formatCurrency(item.unit_price)}</td>
                <td class="text-right"><strong>${formatCurrency(item.total_price)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="6" class="text-right">GRAND TOTAL:</td>
              <td class="text-right total-value"><span style="white-space: nowrap;">UGX: ${formatCurrency(requisition.total_amount, false)}</span></td>
            </tr>
            <tr>
              <td colspan="7" class="total-words">Amount in Words: <strong>${amountToWords(requisition.total_amount)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Signature Section -->
      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-label">Reviewed By:</div>
          <div class="signature-line"></div>
          <div class="signature-sublabel">Name and Signature</div>
        </div>
        <div class="signature-box">
          <div class="signature-label">Approved By:</div>
          <div class="signature-line"></div>
          <div class="signature-sublabel">Name and Signature</div>
        </div>
      </div>

      <!-- Footer -->
      <div class="document-footer">
        <p>Generated on ${formatDate(new Date().toISOString())} | This is a system-generated document</p>
        <p>${orgName} - Purchase Requisition Management System</p>
      </div>
    </body>
    </html>
  `
}

// ============================================================================
// Print & PDF Functions
// ============================================================================

/**
 * Print requisition (opens print dialog)
 * Ensures organization name is loaded before printing
 * 
 * @param {Object} requisition - The requisition data
 * @param {string} organizationName - Organization name (will be fetched if not loaded)
 */
export const printRequisition = async (requisition, organizationName = DEFAULT_ORG_NAME) => {
  if (!requisition) return

  // Ensure organization name is loaded before printing
  const orgName = await ensureOrganizationName(organizationName)

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Please allow popups to print the requisition')
    return
  }

  const htmlContent = generatePrintableHTML(requisition, orgName)
  printWindow.document.write(htmlContent)
  printWindow.document.close()

  // Wait for content to load before printing
  printWindow.onload = () => {
    printWindow.print()
  }
}

/**
 * Download requisition as PDF (uses browser print to PDF)
 * Ensures organization name is loaded before generating PDF
 * 
 * @param {Object} requisition - The requisition data
 * @param {string} organizationName - Organization name (will be fetched if not loaded)
 */
export const downloadRequisitionAsPDF = async (requisition, organizationName = DEFAULT_ORG_NAME) => {
  if (!requisition) return

  // Ensure organization name is loaded before PDF generation
  const orgName = await ensureOrganizationName(organizationName)

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Please allow popups to download the PDF')
    return
  }

  const htmlContent = generatePrintableHTML(requisition, orgName)
  printWindow.document.write(htmlContent)
  printWindow.document.close()

  // Wait for content to load before printing
  printWindow.onload = () => {
    printWindow.print()
    // Note: User will need to select "Save as PDF" in the print dialog
  }
}