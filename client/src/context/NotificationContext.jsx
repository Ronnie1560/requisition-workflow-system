import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useOrganization } from './OrganizationContext'

const NotificationContext = createContext()

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth()
  const { currentOrg } = useOrganization()
  const [toasts, setToasts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Toast notification function
  const showToast = useCallback(({ title, message, type = 'info', duration = 5000 }) => {
    const id = Date.now() + Math.random()
    const toast = { id, title, message, type, duration }

    setToasts(prev => [...prev, toast])

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }

    return id
  }, [])

  // Remove toast manually
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Shorthand toast methods
  const toast = {
    success: (message, title = 'Success') => showToast({ title, message, type: 'success' }),
    error: (message, title = 'Error') => showToast({ title, message, type: 'error' }),
    warning: (message, title = 'Warning') => showToast({ title, message, type: 'warning' }),
    info: (message, title = 'Info') => showToast({ title, message, type: 'info' }),
    custom: showToast
  }

  // Load user notifications from database (filtered by current organization)
  const loadNotifications = useCallback(async () => {
    if (!user?.id || !currentOrg?.id) return

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('org_id', currentOrg.id) // Filter by current organization
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.is_read).length)
    }
  }, [user, currentOrg])

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (!error) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }, [])

  // Mark all as read (for current organization only)
  const markAllAsRead = useCallback(async () => {
    if (!user?.id || !currentOrg?.id) return

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('org_id', currentOrg.id) // Only mark notifications for current org
      .eq('is_read', false)

    if (!error) {
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      )
      setUnreadCount(0)
    }
  }, [user, currentOrg])

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    }
  }, [])

  // Clear all notifications (for current organization only)
  const clearAll = useCallback(async () => {
    if (!user?.id || !currentOrg?.id) return

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('org_id', currentOrg.id) // Only clear notifications for current org

    if (!error) {
      setNotifications([])
      setUnreadCount(0)
    }
  }, [user, currentOrg])

  // Subscribe to real-time notifications (filtered by current organization)
  useEffect(() => {
    if (!user?.id || !currentOrg?.id) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial data load is intentional
    loadNotifications()

    // Subscribe to new notifications for current organization only
    const channel = supabase
      .channel(`notifications-${currentOrg.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id},org_id=eq.${currentOrg.id}` // Filter by user AND org
        },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev])
          setUnreadCount(prev => prev + 1)

          // Show toast for new notification
          showToast({
            title: payload.new.title,
            message: payload.new.message,
            type: payload.new.type || 'info',
            duration: 6000
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, currentOrg, loadNotifications, showToast])

  const value = {
    // Toast notifications
    toasts,
    toast,
    removeToast,

    // In-app notifications
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    loadNotifications
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired
}
