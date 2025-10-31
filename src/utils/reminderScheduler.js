/**
 * Reminder Scheduler Utility
 * Tạo và quản lý nhắc việc tự động dựa trên cài đặt người dùng
 */

import { supabase } from '../lib/supabase'

/**
 * Lấy cấu hình nhắc việc của người dùng
 * @param {string} userId - ID người dùng
 * @returns {Promise<Object|null>} - Cấu hình nhắc việc
 */
export async function getUserReminderPreferences(userId) {
  try {
    const { data, error } = await supabase
      .from('user_reminder_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data || null
  } catch (error) {
    // Quietly return null if table missing or RLS denies (UI will fallback)
    return null
  }
}

/**
 * Xác định trạng thái công việc để áp dụng cài đặt nhắc việc
 * @param {Object} task - Công việc
 * @returns {string} - 'in_progress' | 'nearly_due' | 'overdue' | null
 */
export function getTaskReminderStatus(task) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  if (!task.due_date) {
    return null
  }

  const dueDate = new Date(task.due_date)
  dueDate.setHours(0, 0, 0, 0)
  
  const daysDiff = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24))

  // Quá hạn
  if (daysDiff < 0) {
    return 'overdue'
  }
  
  // Sắp đến hạn (trong vòng 3 ngày)
  if (daysDiff <= 3) {
    return 'nearly_due'
  }
  
  // Đang thực hiện
  if (task.status === 'in_progress' || task.status === 'pending') {
    return 'in_progress'
  }

  return 'in_progress'
}

/**
 * Tạo lịch nhắc việc từ cấu hình
 * @param {Object} task - Công việc
 * @param {Object} config - Cấu hình nhắc việc cho trạng thái cụ thể
 * @param {string} taskType - 'one_time' hoặc 'recurring'
 * @returns {Array<Object>} - Danh sách nhắc việc cần tạo
 */
export function generateReminderSchedule(task, config, taskType) {
  if (!config || !config.enabled) {
    return []
  }

  const reminders = []
  const today = new Date()
  const quietHours = config.quiet_hours || { start: '22:00', end: '07:00' }
  
  // Kiểm tra xem hôm nay có trong days_of_week không
  const todayDayOfWeek = today.getDay() === 0 ? 7 : today.getDay() // Convert Sunday from 0 to 7
  const daysOfWeek = config.days_of_week || [1,2,3,4,5]
  
  if (!daysOfWeek.includes(todayDayOfWeek)) {
    return [] // Không tạo nhắc việc vào ngày này
  }

  // 1. Tạo nhắc việc từ specific_times
  if (config.specific_times && config.specific_times.length > 0) {
    config.specific_times.forEach(time => {
      if (!isInQuietHours(time, quietHours)) {
        const reminderDate = new Date(today)
        const [hours, minutes] = time.split(':')
        reminderDate.setHours(parseInt(hours), parseInt(minutes), 0, 0)
        
        // Chỉ tạo nhắc việc trong tương lai
        if (reminderDate > new Date()) {
          reminders.push({
            task_id: task.id,
            user_id: task.assigned_to,
            scheduled_at: reminderDate.toISOString(),
            message: `Nhắc việc: ${task.title}`,
            type: 'scheduled_time',
            sent: false
          })
        }
      }
    })
  }

  // 2. Tạo nhắc việc lặp lại theo giờ
  if (config.repeat_every_hours > 0) {
    const maxPerDay = config.max_per_day || 3
    const interval = config.repeat_every_hours
    let currentTime = new Date(today)
    currentTime.setHours(8, 0, 0, 0) // Bắt đầu từ 8:00

    let count = 0
    while (count < maxPerDay && currentTime.getHours() < 20) { // Đến 20:00
      const timeStr = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`
      
      if (!isInQuietHours(timeStr, quietHours) && currentTime > new Date()) {
        reminders.push({
          task_id: task.id,
          user_id: task.assigned_to,
          scheduled_at: currentTime.toISOString(),
          message: `Nhắc việc: ${task.title}`,
          type: 'repeat_interval',
          sent: false
        })
        count++
      }
      
      currentTime.setHours(currentTime.getHours() + interval)
    }
  }

  // 3. Áp dụng max_per_day limit
  const maxPerDay = config.max_per_day || 3
  return reminders
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, maxPerDay)
}

/**
 * Kiểm tra xem thời gian có trong giờ im lặng không
 * @param {string} time - HH:MM
 * @param {Object} quietHours - {start: HH:MM, end: HH:MM}
 * @returns {boolean}
 */
function isInQuietHours(time, quietHours) {
  if (!quietHours || !quietHours.start || !quietHours.end) {
    return false
  }

  const [hour, minute] = time.split(':').map(Number)
  const [startHour, startMinute] = quietHours.start.split(':').map(Number)
  const [endHour, endMinute] = quietHours.end.split(':').map(Number)

  const timeMinutes = hour * 60 + minute
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute

  // Handle case where quiet hours span midnight
  if (startMinutes > endMinutes) {
    return timeMinutes >= startMinutes || timeMinutes <= endMinutes
  }

  return timeMinutes >= startMinutes && timeMinutes <= endMinutes
}

// Compute the next safe send time respecting quiet hours; if currently in quiet hours
// schedules at quiet end, else schedule a few seconds in the future.
function nextSendDateRespectingQuiet(quietHours) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const nowStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  const inQuiet = isInQuietHours(nowStr, quietHours)
  if (inQuiet) {
    try {
      const [h, m] = (quietHours?.end || '07:00').split(':').map(Number)
      const d = new Date(now)
      // If already past end today (shouldn't happen), move to tomorrow
      if (now.getHours() > h || (now.getHours() === h && now.getMinutes() > m)) {
        d.setDate(d.getDate() + 1)
      }
      d.setHours(h, m, 0, 0)
      return d
    } catch {
      // fallback now + 60s
      return new Date(now.getTime() + 60 * 1000)
    }
  }
  // Not in quiet hours -> schedule soon (60s)
  return new Date(now.getTime() + 60 * 1000)
}

/**
 * Tạo nhắc việc tự động cho công việc
 * @param {Object} task - Công việc
 * @param {string} userId - ID người dùng được nhắc việc
 * @returns {Promise<void>}
 */
export async function createTaskReminders(task, userId = null) {
  try {
    const targetUserId = userId || task.assigned_to
    
    // 1. Lấy cấu hình nhắc việc của người dùng
    const preferences = await getUserReminderPreferences(targetUserId)
    
    if (!preferences) {
      console.log('No reminder preferences found for user:', targetUserId)
      return
    }

    // 2. Xác định loại công việc (ưu tiên 1)
    const taskType = task.task_type || 'one_time'
    const configKey = taskType === 'recurring' ? 'recurring_config' : 'one_time_config'
    const taskConfig = preferences[configKey]

    if (!taskConfig || !taskConfig.active) {
      console.log('Reminder config not active for task type:', taskType)
      return
    }

    // 3. Xác định trạng thái công việc (ưu tiên 2)
    const reminderStatus = getTaskReminderStatus(task)
    
    if (!reminderStatus) {
      console.log('Cannot determine reminder status for task:', task.id)
      return
    }

    // 4. Lấy cấu hình cho trạng thái cụ thể
    const statusConfig = taskConfig.by_status?.[reminderStatus]

    if (!statusConfig || !statusConfig.enabled) {
      console.log('Reminder not enabled for status:', reminderStatus)
      return
    }

    // 5. Tạo lịch nhắc việc
    let reminders = generateReminderSchedule(task, statusConfig, taskType)

    // Fallback: if today has no future time slots (e.g., after 15:00) or weekends excluded,
    // schedule one immediate reminder respecting quiet hours so the user sees something.
    if (reminders.length === 0) {
      const when = nextSendDateRespectingQuiet(statusConfig.quiet_hours || taskConfig.quiet_hours)
      reminders = [{
        task_id: task.id,
        user_id: targetUserId,
        scheduled_at: when.toISOString(),
        message: `Nhắc việc: ${task.title}`,
        type: 'scheduled_time',
        sent: false
      }]
    }

    // 6. Lưu nhắc việc vào database
    const { error } = await supabase
      .from('task_reminders')
      .insert(reminders)

    if (error) {
      console.error('Error creating task reminders:', error)
      throw error
    }

    console.log(`Created ${reminders.length} reminders for task ${task.id}`)
  } catch (error) {
    console.error('Error in createTaskReminders:', error)
  }
}

/**
 * Cập nhật nhắc việc khi công việc thay đổi trạng thái
 * @param {Object} task - Công việc
 * @param {string} oldStatus - Trạng thái cũ
 * @param {string} userId - ID người dùng
 * @returns {Promise<void>}
 */
export async function updateTaskReminders(task, oldStatus, userId = null) {
  try {
    const targetUserId = userId || task.assigned_to
    const newReminderStatus = getTaskReminderStatus(task)
    const oldReminderStatus = getTaskReminderStatus({ ...task, status: oldStatus })

    // Nếu trạng thái nhắc việc thay đổi, xóa nhắc việc cũ và tạo mới
    if (newReminderStatus !== oldReminderStatus) {
      // Xóa các nhắc việc chưa gửi
      await supabase
        .from('task_reminders')
        .delete()
        .eq('task_id', task.id)
        .eq('user_id', targetUserId)
        .eq('sent', false)

      // Tạo nhắc việc mới với cấu hình trạng thái mới
      await createTaskReminders(task, targetUserId)
    }
  } catch (error) {
    console.error('Error updating task reminders:', error)
  }
}

/**
 * Xóa tất cả nhắc việc của công việc
 * @param {string} taskId - ID công việc
 * @returns {Promise<void>}
 */
export async function deleteTaskReminders(taskId) {
  try {
    await supabase
      .from('task_reminders')
      .delete()
      .eq('task_id', taskId)
      .eq('sent', false)

    console.log('Deleted reminders for task:', taskId)
  } catch (error) {
    console.error('Error deleting task reminders:', error)
  }
}

/**
 * Tạo nhắc việc tự động cho nhiều người dùng với lịch giống nhau
 * @param {Object} task - Công việc
 * @param {Array<string>} userIds - Danh sách ID người dùng
 * @returns {Promise<void>}
 */
export async function createTaskRemindersForUsersSameSchedule(task, userIds = []) {
  try {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
    if (!uniqueUserIds.length) return

    // Build base schedule from the main assignee's preferences
    const ownerId = task.assigned_to
    const preferences = await getUserReminderPreferences(ownerId)
    if (!preferences) {
      console.log('No reminder preferences found for base user:', ownerId)
      return
    }

    const taskType = task.task_type || 'one_time'
    const configKey = taskType === 'recurring' ? 'recurring_config' : 'one_time_config'
    const taskConfig = preferences[configKey]
    if (!taskConfig || !taskConfig.active) return

    const reminderStatus = getTaskReminderStatus(task)
    if (!reminderStatus) return

    const statusConfig = taskConfig.by_status?.[reminderStatus]
    if (!statusConfig || !statusConfig.enabled) return

    // Generate times once
    let baseReminders = generateReminderSchedule(task, statusConfig, taskType)
    if (!baseReminders.length) {
      const when = nextSendDateRespectingQuiet(statusConfig.quiet_hours || taskConfig.quiet_hours)
      baseReminders = [{
        task_id: task.id,
        scheduled_at: when.toISOString(),
        message: `Nhắc việc: ${task.title}`,
        type: 'scheduled_time',
        sent: false
      }]
    }

    // Remove any existing unsent reminders for these users for this task
    await supabase
      .from('task_reminders')
      .delete()
      .eq('task_id', task.id)
      .in('user_id', uniqueUserIds)
      .eq('sent', false)

    // Replicate to all target users
    const rows = []
    for (const uid of uniqueUserIds) {
      for (const r of baseReminders) {
        rows.push({
          task_id: task.id,
          user_id: uid,
          scheduled_at: r.scheduled_at,
          message: r.message,
          type: r.type,
          sent: false
        })
      }
    }

    if (rows.length) {
      const { error } = await supabase.from('task_reminders').insert(rows)
      if (error) throw error
      console.log(`Created ${rows.length} reminders for ${uniqueUserIds.length} users on task ${task.id}`)
    }
  } catch (err) {
    console.error('Error in createTaskRemindersForUsersSameSchedule:', err)
  }
}
