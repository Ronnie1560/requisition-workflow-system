import React, { useState, useMemo, memo } from 'react'
import PropTypes from 'prop-types'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { AlertCircle, ExternalLink } from 'lucide-react'
import { logger } from '../../utils/logger'

const SpendingByProjectEnhanced = ({
  data = [],
  onSort,
  sortConfig,
  onDrillDown
}) => {
  // ============================================================================
  // ERROR HANDLING & DATA VALIDATION
  // ============================================================================

  // Validate data prop exists and is an array
  const safeData = useMemo(() => {
    try {
      if (!data) {
        logger.warn('SpendingByProjectEnhanced: data prop is null or undefined')
        return []
      }

      if (!Array.isArray(data)) {
        logger.warn('SpendingByProjectEnhanced: data prop is not an array', typeof data)
        return []
      }

      if (data.length === 0) {
        return []
      }

      // Validate and sanitize each row
      return data.map((row, index) => {
        try {
          if (!row || typeof row !== 'object') {
            logger.warn(`SpendingByProjectEnhanced: Row ${index} is invalid`, row)
            return null
          }

          // Ensure required fields exist with default values
          return {
            id: row.id || row.projectId || `project-${index}`,
            projectId: row.projectId || row.id || `project-${index}`,
            projectCode: row.projectCode || 'N/A',
            projectName: row.projectName || 'Unknown Project',
            totalRequisitions: Number(row.totalRequisitions) || 0,
            totalAmount: Number(row.totalAmount) || 0,
            projectBudget: Number(row.projectBudget) || 0,
            approvedAmount: Number(row.approvedAmount) || 0,
            budgetUtilization: Number(row.budgetUtilization) || 0,
            // Preserve the requisitions array for drill-down
            requisitions: row.requisitions || [],
            // Include original row for drill-down functionality
            _original: row
          }
        } catch (rowError) {
          logger.error(`SpendingByProjectEnhanced: Error processing row ${index}:`, rowError)
          return null
        }
      }).filter(row => row !== null) // Remove failed rows
    } catch (error) {
      logger.error('SpendingByProjectEnhanced: Error validating data:', error)
      return []
    }
  }, [data])

  // Local state for component
  const [localSortConfig, setLocalSortConfig] = useState(sortConfig || { key: null, direction: 'asc' })
  const [selectedProject, setSelectedProject] = useState(null)

  // ============================================================================
  // SORTING LOGIC
  // ============================================================================

  const handleSort = (key) => {
    try {
      let direction = 'asc'
      if (localSortConfig?.key === key && localSortConfig?.direction === 'asc') {
        direction = 'desc'
      }

      const newSortConfig = { key, direction }
      setLocalSortConfig(newSortConfig)

      // Call parent handler if provided
      if (typeof onSort === 'function') {
        onSort(newSortConfig)
      }
    } catch (error) {
      logger.error('SpendingByProjectEnhanced: Error in handleSort:', error)
    }
  }

  // Apply sorting to data
  const sortedData = useMemo(() => {
    try {
      if (!Array.isArray(safeData) || safeData.length === 0) {
        return safeData
      }

      const sorted = [...safeData]

      if (localSortConfig?.key) {
        sorted.sort((a, b) => {
          const aValue = a[localSortConfig.key] ?? ''
          const bValue = b[localSortConfig.key] ?? ''

          // Handle numeric comparison
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            return localSortConfig.direction === 'asc'
              ? aValue - bValue
              : bValue - aValue
          }

          // Handle string comparison
          const aStr = String(aValue).toLowerCase()
          const bStr = String(bValue).toLowerCase()

          return localSortConfig.direction === 'asc'
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr)
        })
      }

      return sorted
    } catch (error) {
      logger.error('SpendingByProjectEnhanced: Error in sorting:', error)
      return safeData
    }
  }, [safeData, localSortConfig])

  // ============================================================================
  // CALCULATIONS & SUMMARIES
  // ============================================================================

  const totals = useMemo(() => {
    try {
      if (!Array.isArray(safeData) || safeData.length === 0) {
        return {
          totalRequisitions: 0,
          totalBudget: 0,
          totalSpent: 0,
          totalApproved: 0,
          averageUtilization: 0
        }
      }

      return {
        totalRequisitions: safeData.reduce((sum, row) => sum + (Number(row.totalRequisitions) || 0), 0),
        totalBudget: safeData.reduce((sum, row) => sum + (Number(row.projectBudget) || 0), 0),
        totalSpent: safeData.reduce((sum, row) => sum + (Number(row.totalAmount) || 0), 0),
        totalApproved: safeData.reduce((sum, row) => sum + (Number(row.approvedAmount) || 0), 0),
        averageUtilization: (safeData.reduce((sum, row) => sum + (Number(row.budgetUtilization) || 0), 0) / safeData.length).toFixed(2)
      }
    } catch (error) {
      logger.error('SpendingByProjectEnhanced: Error calculating totals:', error)
      return {
        totalRequisitions: 0,
        totalBudget: 0,
        totalSpent: 0,
        totalApproved: 0,
        averageUtilization: 0
      }
    }
  }, [safeData])

  // Prepare chart data
  const chartData = useMemo(() => {
    try {
      if (!Array.isArray(safeData) || safeData.length === 0) {
        return []
      }

      // Limit to top 10 projects for chart readability
      return safeData.slice(0, 10).map(project => ({
        name: project.projectName?.substring(0, 15) || 'Unknown',
        budget: Number(project.projectBudget) || 0,
        spent: Number(project.totalAmount) || 0,
        approved: Number(project.approvedAmount) || 0
      }))
    } catch (error) {
      logger.error('SpendingByProjectEnhanced: Error preparing chart data:', error)
      return []
    }
  }, [safeData])

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Handle project row click - triggers drill-down modal
   * Passes (title, requisitions) to parent's onDrillDown handler
   */
  const handleProjectClick = (project) => {
    try {
      setSelectedProject(project)

      if (typeof onDrillDown === 'function') {
        // Get the original data which contains the requisitions array
        const originalData = project._original || project

        // Build a descriptive title for the drill-down modal
        const title = `${originalData.projectName || project.projectName} (${originalData.projectCode || project.projectCode})`

        // Get the requisitions array from the original data
        const requisitions = originalData.requisitions || project.requisitions || []

        // Call drill-down with proper parameters: (title, requisitions)
        // This matches the expected signature in ReportsEnhanced.jsx handleDrillDown
        onDrillDown(title, requisitions)
      }
    } catch (error) {
      logger.error('SpendingByProjectEnhanced: Error in handleProjectClick:', error)
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  // Show empty state
  if (!safeData || safeData.length === 0) {
    return (
      <div className="w-full p-8 bg-white rounded-lg border border-slate-200">
        <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">No project spending data available for the selected period</span>
        </div>
      </div>
    )
  }

  // Show error boundary message if data fails validation
  if (safeData.length === 0 && data && data.length > 0) {
    return (
      <div className="w-full p-8 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800">Error Loading Report</h3>
            <p className="text-sm text-red-600 mt-1">
              There was an error processing the project spending data. Please try again or contact support if the problem persists.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-600 uppercase">Total Projects</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{safeData.length}</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-600 uppercase">Total Budget</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {(totals.totalBudget / 1000000).toFixed(1)}M
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-600 uppercase">Total Spent</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {(totals.totalSpent / 1000000).toFixed(1)}M
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-600 uppercase">Total Approved</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {(totals.totalApproved / 1000000).toFixed(1)}M
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-600 uppercase">Avg Utilization</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totals.averageUtilization}%</p>
        </div>
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Budget vs Spending Chart */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Budget vs Spending</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="budget" fill="#3b82f6" name="Budget" />
                <Bar dataKey="spent" fill="#ef4444" name="Spent" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Spending Trends Chart */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Spending by Project</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="spent" stroke="#ef4444" name="Spent" />
                <Line type="monotone" dataKey="approved" stroke="#10b981" name="Approved" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Clickable Hint */}
      <div className="flex items-center gap-2 text-sm text-slate-500 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
        <ExternalLink className="w-4 h-4 text-blue-500" />
        <span>Click on any project row to view its requisitions</span>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('projectCode')}
              >
                Project Code {localSortConfig?.key === 'projectCode' && (localSortConfig?.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('projectName')}
              >
                Project Name {localSortConfig?.key === 'projectName' && (localSortConfig?.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('totalRequisitions')}
              >
                Requisitions {localSortConfig?.key === 'totalRequisitions' && (localSortConfig?.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('projectBudget')}
              >
                Budget {localSortConfig?.key === 'projectBudget' && (localSortConfig?.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('totalAmount')}
              >
                Total Spending {localSortConfig?.key === 'totalAmount' && (localSortConfig?.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('approvedAmount')}
              >
                Approved Amount {localSortConfig?.key === 'approvedAmount' && (localSortConfig?.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('budgetUtilization')}
              >
                Budget Util. % {localSortConfig?.key === 'budgetUtilization' && (localSortConfig?.direction === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => {
              try {
                const utilizationClass = row.budgetUtilization > 90 ? 'text-red-600' : row.budgetUtilization > 75 ? 'text-yellow-600' : 'text-green-600'
                const hasRequisitions = (row.requisitions?.length || 0) > 0 || (row._original?.requisitions?.length || 0) > 0

                return (
                  <tr
                    key={row.id || index}
                    className={`border-b border-slate-200 transition-colors group ${
                      hasRequisitions 
                        ? 'hover:bg-blue-50 cursor-pointer' 
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => handleProjectClick(row)}
                    title={hasRequisitions ? `Click to view ${row.totalRequisitions} requisition(s)` : 'No requisitions to view'}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      <span className="group-hover:text-blue-600 transition-colors flex items-center gap-2">
                        {row.projectCode}
                        {hasRequisitions && (
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                      {row.projectName}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-slate-700">
                      <span className={hasRequisitions ? 'font-medium text-blue-600' : ''}>
                        {row.totalRequisitions}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-slate-700">{(row.projectBudget / 1000000).toFixed(2)}M</td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-slate-900">{(row.totalAmount / 1000000).toFixed(2)}M</td>
                    <td className="px-6 py-4 text-sm text-right text-slate-700">{(row.approvedAmount / 1000000).toFixed(2)}M</td>
                    <td className={`px-6 py-4 text-sm text-right font-medium ${utilizationClass}`}>
                      {row.budgetUtilization.toFixed(2)}%
                    </td>
                  </tr>
                )
              } catch (rowError) {
                logger.error(`SpendingByProjectEnhanced: Error rendering row ${index}:`, rowError)
                return null
              }
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

SpendingByProjectEnhanced.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    projectCode: PropTypes.string,
    projectName: PropTypes.string,
    totalRequisitions: PropTypes.number,
    totalAmount: PropTypes.number,
    projectBudget: PropTypes.number,
    approvedAmount: PropTypes.number,
    budgetUtilization: PropTypes.number,
    requisitions: PropTypes.array
  })),
  onSort: PropTypes.func,
  sortConfig: PropTypes.shape({
    key: PropTypes.string,
    direction: PropTypes.oneOf(['asc', 'desc'])
  }),
  onDrillDown: PropTypes.func
}

SpendingByProjectEnhanced.defaultProps = {
  data: [],
  onSort: null,
  sortConfig: null,
  onDrillDown: null
}

export default memo(SpendingByProjectEnhanced)