/* @refresh reset */
import React, { createContext, useContext, useEffect, useState } from 'react'
import supabaseLib from '../lib/supabase'

const { supabase } = supabaseLib
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'
import { BellIcon, CheckCircleIcon, ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/outline'

console.log('📦 NotificationContext.jsx loaded')

const NotificationContext = createContext()

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    // Return default values instead of throwing error
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      markAsRead: () => {},
      markAllAsRead: () => {},
      deleteNotification: () => {},
      clearAll: () => {},
      refresh: () => {}
    }
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  console.log('🔥 NotificationProvider invoked (pre-hooks)')
  const { user, profile } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const POLL_MS = 10000

  console.log('🔥 NotificationProvider RENDERING - user:', user?.id, 'profile:', profile?.id)

  const loadNotifications = async () => {
    if (!user) {
      console.log('⚠️ loadNotifications: No user')
      return
    }

    console.log('🔔 Loading notifications for user:', user.id)
    console.log('🔑 User object:', user)
    
    try {
      // 1) Load system notifications
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('❌ Error loading notifications:', error)
        console.error('❌ Error details:', JSON.stringify(error, null, 2))
        throw error
      }

      const notificationsData = data || []

      // Only use system notifications; remove reminder synthesis
      const unread = notificationsData.filter(n => !n.is_read).length

      console.log('✅ Notifications loaded:', notificationsData.length)
      console.log('📊 Unread count:', unread)
      
      setNotifications(notificationsData)
      setUnreadCount(unread)
    } catch (error) {
      console.error('❌ Exception loading notifications:', error)
      console.error('❌ Exception details:', error.message, error.stack)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    if (!user) return

    // Subscribe to notifications table changes only
    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new
          
          // Add to notifications list
          setNotifications(prev => [newNotification, ...prev])
          setUnreadCount(prev => prev + 1)

          // Show toast notification
          showToastNotification(newNotification)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedNotification = payload.new
          
          // Update notification in list
          setNotifications(prev =>
            prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
          )

          // Recalculate unread count
          setUnreadCount(prev => {
            const wasRead = payload.old.is_read
            const isRead = updatedNotification.is_read
            if (!wasRead && isRead) return Math.max(0, prev - 1)
            if (wasRead && !isRead) return prev + 1
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  useEffect(() => {
    console.log('👤 NotificationContext useEffect - user:', user?.id, user?.email)
    console.log('📋 User object type:', typeof user, 'Is null?', user === null, 'Is undefined?', user === undefined)
    
    if (!user) {
      console.log('⚠️ No user, clearing notifications')
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    console.log('✅ User found, loading notifications...')
    console.log('🔑 Full user object:', JSON.stringify(user, null, 2))
    
    // Add a small delay to ensure auth is fully ready
    const timer = setTimeout(() => {
      console.log('⏰ Delayed load starting...')
      loadNotifications()
    }, 100)
    
    const cleanup = setupRealtimeSubscription()

    setLoading(false) // Don't block UI for notifications

    return () => {
      console.log('🧹 Cleaning up NotificationContext')
      clearTimeout(timer)
      if (cleanup) cleanup()
    }
  }, [user])

  const showToastNotification = (notification) => {
    const icons = {
      task_assigned: <BellIcon className="w-5 h-5" />,
      task_completed: <CheckCircleIcon className="w-5 h-5" />,
      task_reminder: <ClockIcon className="w-5 h-5" />,
      task_overdue: <ExclamationTriangleIcon className="w-5 h-5" />,
      birthday: <BellIcon className="w-5 h-5" />,
      anniversary: <BellIcon className="w-5 h-5" />,
      proposal: <BellIcon className="w-5 h-5" />,
      success: <CheckCircleIcon className="w-5 h-5" />,
      error: <ExclamationTriangleIcon className="w-5 h-5" />,
      task: <BellIcon className="w-5 h-5" />
    }

    const styles = {
      task_assigned: { iconColor: 'text-blue-600', bgColor: 'bg-blue-50' },
      task_completed: { iconColor: 'text-green-600', bgColor: 'bg-green-50' },
      task_reminder: { iconColor: 'text-yellow-600', bgColor: 'bg-yellow-50' },
      task_overdue: { iconColor: 'text-red-600', bgColor: 'bg-red-50' },
      birthday: { iconColor: 'text-purple-600', bgColor: 'bg-purple-50' },
      anniversary: { iconColor: 'text-pink-600', bgColor: 'bg-pink-50' },
      proposal: { iconColor: 'text-yellow-600', bgColor: 'bg-yellow-50' },
      success: { iconColor: 'text-green-600', bgColor: 'bg-green-50' },
      error: { iconColor: 'text-red-600', bgColor: 'bg-red-50' },
      task: { iconColor: 'text-blue-600', bgColor: 'bg-blue-50' }
    }

    const style = styles[notification.type] || styles.task_assigned
    const icon = icons[notification.type] || icons.task_assigned

    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full ${style.bgColor} shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className={`flex-shrink-0 ${style.iconColor}`}>
                {icon}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {notification.title}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-200">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
            >
              Đóng
            </button>
          </div>
        </div>
      ),
      {
        duration: 5000,
        position: 'top-right'
      }
    )

    // Play notification sound (optional)
    if (typeof Audio !== 'undefined') {
      try {
        const audio = new Audio('/notification.mp3')
        audio.volume = 0.3
        audio.play().catch(() => {}) // Ignore if audio fails
      } catch (e) {
        // Ignore audio errors
      }
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      if (typeof notificationId === 'string' && notificationId.startsWith('taskreminder:')) {
        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
        return
      }
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      if (error) throw error

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast.error('Không thể đánh dấu đã đọc')
    }
  }

  const markAllAsRead = async () => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) throw error

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      )
      setUnreadCount(0)
      toast.success('Đã đánh dấu tất cả là đã đọc')
    } catch (error) {
      console.error('Error marking all as read:', error)
      toast.error('Không thể đánh dấu tất cả đã đọc')
    }
  }

  const deleteNotification = async (notificationId) => {
    try {
      if (typeof notificationId === 'string' && notificationId.startsWith('taskreminder:')) {
        const notification = notifications.find(n => n.id === notificationId)
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        if (notification && !notification.is_read) setUnreadCount(prev => Math.max(0, prev - 1))
        toast.success('Đã xóa thông báo')
        return
      }
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (error) throw error

      const notification = notifications.find(n => n.id === notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      if (notification && !notification.is_read) setUnreadCount(prev => Math.max(0, prev - 1))

      toast.success('Đã xóa thông báo')
    } catch (error) {
      console.error('Error deleting notification:', error)
      toast.error('Không thể xóa thông báo')
    }
  }

  const clearAll = async () => {
    if (!user) return
    if (!window.confirm('Bạn có chắc muốn xóa tất cả thông báo?')) return

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)

      if (error) throw error

      setNotifications([])
      setUnreadCount(0)
      toast.success('Đã xóa tất cả thông báo')
    } catch (error) {
      console.error('Error clearing notifications:', error)
      toast.error('Không thể xóa thông báo')
    }
  }

  // Reminder polling removed

  const value = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refresh: loadNotifications
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
