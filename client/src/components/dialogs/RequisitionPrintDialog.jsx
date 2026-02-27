import { useState, useRef } from 'react'
import PropTypes from 'prop-types'
import { Printer, Download, FileSpreadsheet, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import Dialog from '../ui/Dialog'
import { generatePrintableHTML, exportRequisitionToCSV } from '../../utils/requisitionExport'
import { logger } from '../../utils/logger'

/**
 * Requisition Print Preview Dialog
 * Shows live preview of printable requisition with options to print, download PDF, or export CSV
 */
export function RequisitionPrintDialog({ isOpen, onClose, requisition, organization }) {
  const [zoom, setZoom] = useState(100)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const printPreviewRef = useRef(null)

  if (!requisition) return null

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow popups to print the requisition')
      return
    }

    const htmlContent = generatePrintableHTML(requisition, organization)
    printWindow.document.write(htmlContent)
    printWindow.document.close()

    // Wait for content to load before printing
    printWindow.onload = () => {
      printWindow.print()
    }
  }

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPDF(true)
      logger.info('[PrintDialog] Generating PDF...')

      // html2canvas cannot capture iframe contents, so render the
      // printable HTML into a temporary off-screen div instead.
      const tempContainer = document.createElement('div')
      tempContainer.style.position = 'absolute'
      tempContainer.style.left = '-9999px'
      tempContainer.style.top = '0'
      tempContainer.style.width = '794px' // A4 at 96 DPI
      tempContainer.innerHTML = generatePrintableHTML(requisition, organization)
        // Strip the full HTML wrapper — extract just the body content
        .replace(/^.*<body[^>]*>/is, '')
        .replace(/<\/body>.*$/is, '')
      document.body.appendChild(tempContainer)

      // Copy <style> from the generated HTML into the container
      const fullHTML = generatePrintableHTML(requisition, organization)
      const styleMatch = fullHTML.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
      if (styleMatch) {
        const styleEl = document.createElement('style')
        styleEl.textContent = styleMatch[1]
        tempContainer.prepend(styleEl)
      }

      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 100))

      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794
      })

      // Clean up temp element
      document.body.removeChild(tempContainer)

      const imgData = canvas.toDataURL('image/png')
      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Handle multi-page PDFs if content exceeds one page
      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position -= pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const filename = `requisition_${requisition.requisition_number || 'draft'}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(filename)

      logger.info('[PrintDialog] PDF generated successfully:', filename)
    } catch (error) {
      logger.error('[PrintDialog] Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const handleExportCSV = () => {
    exportRequisitionToCSV(requisition, organization)
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50))
  }

  const handleResetZoom = () => {
    setZoom(100)
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Requisition Preview & Export" maxWidth="7xl">
      {/* Action Bar */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
        {/* Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isGeneratingPDF ? 'Generating PDF...' : 'Download PDF'}
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 50}
            className="p-2 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-200 rounded min-w-[60px]"
          >
            {zoom}%
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 200}
            className="p-2 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-gray-300 mx-2" />
          <button
            onClick={handleResetZoom}
            className="p-2 text-gray-600 hover:bg-gray-200 rounded"
            title="Fit to Width"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="p-6 bg-gray-100 min-h-[500px] flex items-start justify-center overflow-auto">
        <div
          className="bg-white shadow-2xl overflow-hidden"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.2s ease',
            width: '210mm', // A4 width
            minHeight: '297mm', // A4 height
          }}
        >
          <iframe
            ref={printPreviewRef}
            title="Print Preview"
            srcDoc={generatePrintableHTML(requisition, organization)}
            className="w-full h-full border-0"
            style={{
              width: '210mm',
              minHeight: '297mm',
              border: 'none'
            }}
          />
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <p>
          <strong>Tip:</strong> Use Print to send directly to printer, or Download PDF to save a copy.
          The preview shows how the document will look when printed.
        </p>
      </div>
    </Dialog>
  )
}

RequisitionPrintDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  requisition: PropTypes.object,
  organization: PropTypes.oneOfType([PropTypes.object, PropTypes.string])
}

export default RequisitionPrintDialog
