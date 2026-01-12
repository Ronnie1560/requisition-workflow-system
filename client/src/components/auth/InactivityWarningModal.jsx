import { useEffect } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle } from 'lucide-react'

/**
 * Modal that warns users about impending automatic logout due to inactivity
 */
const InactivityWarningModal = ({ isOpen, remainingSeconds, onStayLoggedIn, onLogout }) => {
  // Format remaining time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      // Enter or Space = Stay logged in
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onStayLoggedIn()
      }
      // Escape = Close (but timer continues)
      if (e.key === 'Escape') {
        e.preventDefault()
        onStayLoggedIn()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onStayLoggedIn])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all">
          {/* Warning Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-yellow-100 rounded-full mb-4">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
            Session About to Expire
          </h3>

          {/* Message */}
          <p className="text-sm text-gray-600 text-center mb-4">
            You've been inactive for a while. For your security, we'll automatically log you out in:
          </p>

          {/* Countdown Timer */}
          <div className="text-center mb-6">
            <div className="text-4xl font-bold text-red-600 mb-2">
              {formatTime(remainingSeconds)}
            </div>
            <p className="text-xs text-gray-500">
              Any unsaved work will be lost
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onStayLoggedIn}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors font-medium"
            >
              Stay Logged In
            </button>
            <button
              onClick={onLogout}
              className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
            >
              Logout Now
            </button>
          </div>

          {/* Hint */}
          <p className="text-xs text-gray-500 text-center mt-4">
            Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Enter</kbd> to stay logged in
          </p>
        </div>
      </div>
    </div>
  )
}

InactivityWarningModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  remainingSeconds: PropTypes.number.isRequired,
  onStayLoggedIn: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired
}

export default InactivityWarningModal
