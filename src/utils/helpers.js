import { format, parseISO, differenceInDays, isAfter, isBefore, addDays } from 'date-fns'
import { vi } from 'date-fns/locale'

// Date formatting utilities
export const formatDate = (date, formatStr = 'dd/MM/yyyy') => {
  if (!date) return ''
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return format(dateObj, formatStr, { locale: vi })
}

export const formatDateTime = (date) => {
  if (!date) return ''
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return format(dateObj, 'dd/MM/yyyy HH:mm', { locale: vi })
}

export const formatRelativeDate = (date) => {
  if (!date) return ''
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  const now = new Date()
  const days = differenceInDays(dateObj, now)
  
  if (days === 0) return 'Hôm nay'
  if (days === 1) return 'Ngày mai'
  if (days === -1) return 'Hôm qua'
  if (days > 0) return `${days} ngày nữa`
  return `${Math.abs(days)} ngày trước`
}

// Task status utilities
export const getTaskStatusColor = (status) => {
  const colors = {
    'pending': 'bg-gray-100 text-gray-800', // Giữ lại để tránh lỗi, nhưng không hiển thị
    'in_progress': 'bg-blue-100 text-blue-800',
    'nearly_due': 'bg-yellow-100 text-yellow-800',
    'overdue': 'bg-red-100 text-red-800',
    'completed': 'bg-green-100 text-green-800'
  }
  return colors[status] || colors.pending
}

export const getTaskStatusText = (status) => {
  const statusText = {
    'pending': 'Chờ xử lý', // Giữ lại để tránh lỗi, nhưng không hiển thị
    'in_progress': 'Đang thực hiện',
    'nearly_due': 'Sắp đến hạn',
    'overdue': 'Quá hạn',
    'completed': 'Hoàn thành'
  }
  return statusText[status] || 'Không xác định'
}

export const getPriorityColor = (priority) => {
  const colors = {
    'low': 'bg-green-100 text-green-800',
    'medium': 'bg-blue-100 text-blue-800',
    'high': 'bg-orange-100 text-orange-800',
    'urgent': 'bg-red-100 text-red-800'
  }
  return colors[priority] || colors.medium
}

export const getPriorityText = (priority) => {
  const priorityText = {
    'low': 'Thấp',
    'medium': 'Trung bình',
    'high': 'Cao',
    'urgent': 'Khẩn cấp'
  }
  return priorityText[priority] || 'Trung bình'
}

// Progress bar utilities
export const getProgressBarColor = (percentage, dueDate) => {
  if (percentage === 100) return 'progress-green'
  
  const now = new Date()
  const due = new Date(dueDate)
  const daysUntilDue = differenceInDays(due, now)
  
  if (daysUntilDue < 0) return 'progress-red' // Overdue
    if (daysUntilDue <= 2) return 'progress-orange' // Nearly due (<= 2 days)
  if (percentage > 0) return 'progress-yellow' // In progress
  return 'progress-yellow' // Not started but not overdue
}

// Role and permission utilities
export const getRoleDisplayName = (role) => {
  const roles = {
    'manager': 'Quản lý',
    'admin': 'Quản trị viên',
    'user': 'Nhân viên'
  }
  return roles[role] || 'Nhân viên'
}

export const canManageProject = (userRole, userProjectRole) => {
  return userRole === 'manager' || (userProjectRole && userProjectRole.includes('admin'))
}

export const canManageUser = (userRole) => {
  return userRole === 'manager'
}

export const canManageTask = (userRole, taskAssignedTo, userId, userProjectRole) => {
  return (
    userRole === 'manager' ||
    taskAssignedTo === userId ||
    (userProjectRole && userProjectRole.includes('admin'))
  )
}

// Project utilities
export const calculateProjectProgress = (tasks) => {
  if (!tasks || tasks.length === 0) return 0
  
  const totalProgress = tasks.reduce((sum, task) => sum + (task.progress_percent || 0), 0)
  return Math.round(totalProgress / tasks.length)
}

export const getProjectStatusColor = (status) => {
  const colors = {
    'planning': 'bg-gray-100 text-gray-800',
    'active': 'bg-blue-100 text-blue-800',
    'completed': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800'
  }
  return colors[status] || colors.planning
}

export const getProjectStatusText = (status) => {
  const statusText = {
    'planning': 'Lên kế hoạch',
    'active': 'Đang thực hiện',
    'completed': 'Hoàn thành',
    'cancelled': 'Đã hủy'
  }
  return statusText[status] || 'Lên kế hoạch'
}

// Data validation utilities
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePhone = (phone) => {
  const phoneRegex = /^[0-9+\-\s()]{10,15}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

export const validateRequired = (value) => {
  return value && value.toString().trim().length > 0
}

// Export utilities
export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    throw new Error('Không có dữ liệu để xuất')
  }

  const headers = Object.keys(data[0]).join(',')
  const rows = data.map(row => 
    Object.values(row).map(value => 
      typeof value === 'string' && value.includes(',') 
        ? `"${value}"` 
        : value
    ).join(',')
  )
  
  const csvContent = [headers, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}.csv`
  link.click()
  
  URL.revokeObjectURL(link.href)
}

// File upload utilities
export const validateFileType = (file, allowedTypes) => {
  return allowedTypes.includes(file.type)
}

export const validateFileSize = (file, maxSizeMB) => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  return file.size <= maxSizeBytes
}

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Search and filter utilities
export const searchInObject = (obj, searchTerm) => {
  if (!searchTerm) return true
  
  const lowerSearchTerm = searchTerm.toLowerCase()
  
  return Object.values(obj).some(value => {
    if (value === null || value === undefined) return false
    
    if (typeof value === 'object') {
      return searchInObject(value, searchTerm)
    }
    
    return value.toString().toLowerCase().includes(lowerSearchTerm)
  })
}

export const sortBy = (array, key, direction = 'asc') => {
  return [...array].sort((a, b) => {
    const aValue = getNestedValue(a, key)
    const bValue = getNestedValue(b, key)
    
    if (aValue === bValue) return 0
    
    const comparison = aValue > bValue ? 1 : -1
    return direction === 'asc' ? comparison : -comparison
  })
}

const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

// Notification utilities
export const showNotification = (title, options = {}) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/favicon.ico',
      ...options
    })
  }
}

export const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    return await Notification.requestPermission()
  }
  return Notification.permission
}

// Local storage utilities
export const saveToLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error('Error saving to localStorage:', error)
  }
}

export const getFromLocalStorage = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch (error) {
    console.error('Error reading from localStorage:', error)
    return defaultValue
  }
}

export const removeFromLocalStorage = (key) => {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.error('Error removing from localStorage:', error)
  }
}
