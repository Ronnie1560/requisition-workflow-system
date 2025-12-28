import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const NotificationContext = createContext()

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth()
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

  // Load user notifications from database
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.is_read).length)
    }
  }, [user])

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

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (!error) {
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      )
      setUnreadCount(0)
    }
  }, [user])

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

  // Clear all notifications
  const clearAll = useCallback(async () => {
    if (!user?.id) return

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)

    if (!error) {
      setNotifications([])
      setUnreadCount(0)
    }
  }, [user])

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user?.id) return

    loadNotifications()

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
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
  }, [user, loadNotifications, showToast])

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
