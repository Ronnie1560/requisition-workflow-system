/**
 * Page Loader Component
 * PCM Requisition System
 * 
 * Loading spinner displayed during lazy loading of page components.
 * Used as a fallback for React.lazy() Suspense boundaries.
 */

import PropTypes from 'prop-types'
import { Loader2 } from 'lucide-react'

function PageLoader({ message, fullScreen }) {
  const containerClasses = fullScreen
    ? 'fixed inset-0 bg-white/80 backdrop-blur-sm z-50'
    : 'w-full min-h-[400px]'

  return (
    <div className={`${containerClasses} flex flex-col items-center justify-center`}>
      <div className="text-center">
        {/* Spinner */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-blue-100" />
          <Loader2 className="absolute inset-0 w-16 h-16 text-blue-600 animate-spin" />
        </div>
        
        {/* Message */}
        {message && (
          <p className="mt-4 text-slate-600 font-medium animate-pulse">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

PageLoader.propTypes = {
  message: PropTypes.string,
  fullScreen: PropTypes.bool
}

PageLoader.defaultProps = {
  message: 'Loading...',
  fullScreen: false
}

export default PageLoader

/**
 * Skeleton loader for content placeholders
 */
export function SkeletonLoader({ lines, className }) {
  // Use deterministic widths to avoid impure Math.random during render
  const widths = [75, 90, 60, 85, 70, 95, 65, 80, 88, 72]
  
  return (
    <div className={`animate-pulse space-y-3 ${className || ''}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 bg-slate-200 rounded"
          style={{ width: `${widths[index % widths.length]}%` }}
        />
      ))}
    </div>
  )
}

SkeletonLoader.propTypes = {
  lines: PropTypes.number,
  className: PropTypes.string
}

SkeletonLoader.defaultProps = {
  lines: 3,
  className: ''
}

/**
 * Card skeleton for dashboard cards
 */
export function CardSkeleton({ count }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-xl shadow-sm p-6 animate-pulse"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-200 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/2" />
              <div className="h-6 bg-slate-200 rounded w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

CardSkeleton.propTypes = {
  count: PropTypes.number
}

CardSkeleton.defaultProps = {
  count: 4
}

/**
 * Table skeleton for data tables
 */
export function TableSkeleton({ rows, columns }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, index) => (
            <div key={index} className="h-4 bg-slate-200 rounded flex-1" />
          ))}
        </div>
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="px-6 py-4 border-b border-slate-100 last:border-0"
        >
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="h-4 bg-slate-100 rounded flex-1"
                style={{ width: `${Math.random() * 30 + 70}%` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

TableSkeleton.propTypes = {
  rows: PropTypes.number,
  columns: PropTypes.number
}

TableSkeleton.defaultProps = {
  rows: 5,
  columns: 4
}
