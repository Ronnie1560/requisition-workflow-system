import { useEffect } from 'react'
import PropTypes from 'prop-types'
import { X } from 'lucide-react'

/**
 * Reusable Dialog/Modal Component
 * Provides accessible modal dialog with overlay, close button, and keyboard support
 */
export function Dialog({ isOpen, onClose, title, children, maxWidth = '4xl', showCloseButton = true }) {
  // Handle ESC key to close dialog
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when dialog is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Container */}
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className={`relative bg-white rounded-lg shadow-xl max-w-${maxWidth} w-full max-h-[90vh] overflow-hidden flex flex-col`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Content - Scrollable */}
          <div className="overflow-y-auto flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

Dialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  maxWidth: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl']),
  showCloseButton: PropTypes.bool,
}

export default Dialog
