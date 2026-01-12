import { memo } from 'react'
import PropTypes from 'prop-types'
import { useNotifications } from '../../context/NotificationContext'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

const ToastContainer = () => {
  const { toasts, removeToast } = useNotifications()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

const Toast = ({ toast, onClose }) => {
  const { type, title, message } = toast

  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      titleColor: 'text-green-900',
      textColor: 'text-green-800'
    },
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      textColor: 'text-red-800'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-900',
      textColor: 'text-amber-800'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      textColor: 'text-blue-800'
    }
  }

  const styles = config[type] || config.info
  const Icon = styles.icon

  return (
    <div
      className={`${styles.bgColor} ${styles.borderColor} border-l-4 rounded-r-lg shadow-lg overflow-hidden animate-slide-in-right print:hidden`}
      role="alert"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 ${styles.iconColor} flex-shrink-0 mt-0.5`} />

          <div className="flex-1 min-w-0">
            <h4 className={`text-sm font-semibold ${styles.titleColor} mb-1`}>
              {title}
            </h4>
            {message && (
              <p className={`text-sm ${styles.textColor} leading-relaxed`}>
                {message}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className={`${styles.iconColor} hover:opacity-70 transition-opacity flex-shrink-0`}
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {toast.duration > 0 && (
        <div className="h-1 bg-black/10">
          <div
            className="h-full bg-black/20 animate-shrink-width"
            style={{ animationDuration: `${toast.duration}ms` }}
          />
        </div>
      )}
    </div>
  )
}

Toast.propTypes = {
  toast: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
    title: PropTypes.string.isRequired,
    message: PropTypes.string,
    duration: PropTypes.number
  }).isRequired,
  onClose: PropTypes.func.isRequired
}

// Memoize individual Toast for performance
const MemoizedToast = memo(Toast)

export default memo(ToastContainer)
