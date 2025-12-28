import { useState, useEffect } from 'react'
import { Calendar, Download, Mail, Clock, CheckCircle, AlertCircle, Play } from 'lucide-react'
import { logger } from '../../utils/logger'
import { exportToCSV } from '../../services/api/reports'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

const ExportSchedulerSettings = () => {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [exporting, setExporting] = useState(false)

  const [preferences, setPreferences] = useState({
    enabled: false,
    frequency: 'weekly',
    dayOfWeek: '1', // Monday
    dayOfMonth: '1',
    time: '09:00',
    reportTypes: {
      spending_trends: true,
      project_spending: true,
      expense_accounts: true,
      submitter_analysis: false,
      status_overview: false
    },
    exportFormat: 'csv', // csv or pdf
    emailDelivery: false,
    emailAddress: ''
  })

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = () => {
    try {
      const saved = localStorage.getItem('export_scheduler_preferences')
      if (saved) {
        setPreferences(JSON.parse(saved))
      }
    } catch (error) {
      logger.error('Error loading export preferences:', error)
      setMessage({ type: 'error', text: 'Failed to load preferences' })
    }
  }

  const savePreferences = () => {
    setSaving(true)
    setMessage(null)

    try {
      localStorage.setItem('export_scheduler_preferences', JSON.stringify(preferences))
      setMessage({ type: 'success', text: 'Export schedule preferences saved successfully' })

      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      logger.error('Error saving export preferences:', error)
      setMessage({ type: 'error', text: 'Failed to save preferences' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (field) => {
    setPreferences(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const handleReportTypeToggle = (reportType) => {
    setPreferences(prev => ({
      ...prev,
      reportTypes: {
        ...prev.reportTypes,
        [reportType]: !prev.reportTypes[reportType]
      }
    }))
  }

  const handleRunNow = async () => {
    setExporting(true)
    setMessage(null)

    try {
      // Get selected report types
      const selectedReports = Object.entries(preferences.reportTypes)
        .filter(([_, enabled]) => enabled)
        .map(([type]) => type)

      if (selectedReports.length === 0) {
        setMessage({ type: 'error', text: 'Please select at least one report type' })
        return
      }

      // For demonstration, create a simple export
      // In a real implementation, this would fetch actual report data
      const timestamp = new Date().toISOString().split('T')[0]

      if (preferences.exportFormat === 'csv') {
        // Create a sample CSV export
        const sampleData = selectedReports.map(report => ({
          reportType: report.replace(/_/g, ' ').toUpperCase(),
          scheduled: 'Manual Export',
          timestamp: new Date().toLocaleString()
        }))

        exportToCSV(
          sampleData,
          `scheduled_reports_${timestamp}`,
          [
            { label: 'Report Type', accessor: (row) => row.reportType },
            { label: 'Schedule', accessor: (row) => row.scheduled },
            { label: 'Timestamp', accessor: (row) => row.timestamp }
          ]
        )
      } else {
        // Create a sample PDF export
        const doc = new jsPDF()

        doc.setFontSize(18)
        doc.text('Scheduled Reports Export', 14, 20)

        doc.setFontSize(11)
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30)
        doc.text(`Schedule: ${preferences.frequency}`, 14, 37)

        const tableData = selectedReports.map(report => [
          report.replace(/_/g, ' ').toUpperCase(),
          'Manual Export',
          new Date().toLocaleString()
        ])

        doc.autoTable({
          startY: 45,
          head: [['Report Type', 'Schedule', 'Timestamp']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229] }
        })

        doc.save(`scheduled_reports_${timestamp}.pdf`)
      }

      setMessage({
        type: 'success',
        text: `Successfully exported ${selectedReports.length} report(s) as ${preferences.exportFormat.toUpperCase()}`
      })
    } catch (error) {
      logger.error('Error exporting reports:', error)
      setMessage({ type: 'error', text: 'Failed to export reports' })
    } finally {
      setExporting(false)
    }
  }

  const reportOptions = [
    {
      id: 'spending_trends',
      label: 'Spending Trends',
      description: 'Monthly spending trends with forecasts',
      enabled: preferences.reportTypes.spending_trends
    },
    {
      id: 'project_spending',
      label: 'Project Spending',
      description: 'Spending breakdown by project with budget utilization',
      enabled: preferences.reportTypes.project_spending
    },
    {
      id: 'expense_accounts',
      label: 'Expense Accounts',
      description: 'Spending analysis by expense account',
      enabled: preferences.reportTypes.expense_accounts
    },
    {
      id: 'submitter_analysis',
      label: 'Submitter Analysis',
      description: 'Requisition activity by submitter',
      enabled: preferences.reportTypes.submitter_analysis
    },
    {
      id: 'status_overview',
      label: 'Status Overview',
      description: 'Requisition counts by status',
      enabled: preferences.reportTypes.status_overview
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Calendar className="w-6 h-6 text-indigo-600" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Export Scheduler</h2>
          <p className="text-sm text-gray-600">
            Configure automated report exports and delivery
          </p>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' :
          message.type === 'error' ? 'bg-red-50 text-red-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
           <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Master Toggle */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="font-semibold text-gray-900">Enable Scheduled Exports</h3>
              <p className="text-sm text-gray-600">
                Automatically export reports on a regular schedule
              </p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('enabled')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              preferences.enabled ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                preferences.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Schedule Configuration */}
      <div className={`bg-white border border-gray-200 rounded-lg p-6 space-y-6 ${!preferences.enabled ? 'opacity-50' : ''}`}>
        <h3 className="font-semibold text-gray-900">Schedule Configuration</h3>

        {/* Frequency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Frequency
          </label>
          <select
            value={preferences.frequency}
            onChange={(e) => setPreferences(prev => ({ ...prev, frequency: e.target.value }))}
            disabled={!preferences.enabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>

        {/* Day Selection */}
        {preferences.frequency === 'weekly' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Day of Week
            </label>
            <select
              value={preferences.dayOfWeek}
              onChange={(e) => setPreferences(prev => ({ ...prev, dayOfWeek: e.target.value }))}
              disabled={!preferences.enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
              <option value="6">Saturday</option>
              <option value="0">Sunday</option>
            </select>
          </div>
        )}

        {preferences.frequency === 'monthly' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Day of Month
            </label>
            <select
              value={preferences.dayOfMonth}
              onChange={(e) => setPreferences(prev => ({ ...prev, dayOfMonth: e.target.value }))}
              disabled={!preferences.enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
        )}

        {/* Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time
          </label>
          <input
            type="time"
            value={preferences.time}
            onChange={(e) => setPreferences(prev => ({ ...prev, time: e.target.value }))}
            disabled={!preferences.enabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        {/* Export Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Export Format
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="csv"
                checked={preferences.exportFormat === 'csv'}
                onChange={(e) => setPreferences(prev => ({ ...prev, exportFormat: e.target.value }))}
                disabled={!preferences.enabled}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">CSV</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="pdf"
                checked={preferences.exportFormat === 'pdf'}
                onChange={(e) => setPreferences(prev => ({ ...prev, exportFormat: e.target.value }))}
                disabled={!preferences.enabled}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">PDF</span>
            </label>
          </div>
        </div>

        {/* Email Delivery */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium text-gray-900">Email Delivery</h4>
              <p className="text-sm text-gray-600">Send exports to your email automatically</p>
            </div>
            <button
              onClick={() => handleToggle('emailDelivery')}
              disabled={!preferences.enabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed ${
                preferences.emailDelivery && preferences.enabled ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.emailDelivery ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {preferences.emailDelivery && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={preferences.emailAddress}
                onChange={(e) => setPreferences(prev => ({ ...prev, emailAddress: e.target.value }))}
                disabled={!preferences.enabled}
                placeholder="you@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          )}
        </div>
      </div>

      {/* Report Selection */}
      <div className={`bg-white border border-gray-200 rounded-lg divide-y divide-gray-200 ${!preferences.enabled ? 'opacity-50' : ''}`}>
        <div className="p-6">
          <h3 className="font-semibold text-gray-900">Reports to Include</h3>
          <p className="text-sm text-gray-600 mt-1">Select which reports to include in the export</p>
        </div>

        {reportOptions.map((option) => (
          <div key={option.id} className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{option.label}</h4>
                <p className="text-sm text-gray-600 mt-1">{option.description}</p>
              </div>
              <button
                onClick={() => handleReportTypeToggle(option.id)}
                disabled={!preferences.enabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed ${
                  option.enabled && preferences.enabled ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    option.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">Backend Integration Required</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
              <li>Automated scheduling requires backend server integration</li>
              <li>Use the "Run Now" button to manually export reports immediately</li>
              <li>Email delivery requires SMTP server configuration</li>
              <li>Preferences are saved locally in your browser</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center gap-3">
        <button
          onClick={handleRunNow}
          disabled={exporting || Object.values(preferences.reportTypes).every(v => !v)}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {exporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Now
            </>
          )}
        </button>

        <div className="flex gap-3">
          <button
            onClick={loadPreferences}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
          <button
            onClick={savePreferences}
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Save Schedule
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExportSchedulerSettings
