import { useState, useRef, useEffect } from 'react'
import { useNotifications } from '../../context/NotificationContext'
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  FileText,
  AlertCircle,
  Info,
  CheckCircle,
  Clock
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false)
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  } = useNotifications()
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative print:hidden" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-semibold animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-slide-down">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/50 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Actions */}
            {notifications.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 px-2 py-1 text-blue-600 hover:bg-white/50 rounded transition-colors"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-white/50 rounded transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No notifications</p>
                <p className="text-xs mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 bg-gray-50 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-600">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'} • {notifications.length} total
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const NotificationItem = ({ notification, onMarkAsRead, onDelete }) => {
  const { id, title, message, type, is_read, created_at } = notification

  const typeConfig = {
    requisition_approved: {
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    requisition_rejected: {
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    requisition_submitted: {
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    requisition_reviewed: {
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    requisition_pending_approval: {
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    budget_alert: {
      icon: AlertCircle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    },
    info: {
      icon: Info,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    }
  }

  const config = typeConfig[type] || typeConfig.info
  const Icon = config.icon

  return (
    <div
      className={`p-4 hover:bg-gray-50 transition-colors ${
        !is_read ? 'bg-blue-50/30' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 ${config.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={`text-sm font-semibold text-gray-900 ${!is_read ? 'font-bold' : ''}`}>
              {title}
            </h4>
            {!is_read && (
              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5"></span>
            )}
          </div>

          <p className="text-sm text-gray-700 mb-2 line-clamp-2">
            {message}
          </p>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatDistanceToNow(new Date(created_at), { addSuffix: true })}</span>
            </div>

            <div className="flex items-center gap-2">
              {!is_read && (
                <button
                  onClick={() => onMarkAsRead(id)}
                  className="flex items-center gap-1 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Mark read
                </button>
              )}
              <button
                onClick={() => onDelete(id)}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotificationCenter
