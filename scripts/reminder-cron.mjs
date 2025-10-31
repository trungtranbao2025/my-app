// Node cron script: timezone-accurate reminder scheduler
// Computes next_fire_at in each user's timezone and sends notifications
// Requirements: @supabase/supabase-js, date-fns-tz
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600 * 1000)
}

function parseQuietHours(json) {
  try { return typeof json === 'string' ? JSON.parse(json) : (json || {}) } catch { return {} }
}

function computeStatus(task, nowUtc) {
  if (task?.completed_at) return 'done'
  if (!task?.due_at) return (task?.status === 'in_progress') ? 'in_progress' : 'pending'
  const due = new Date(task.due_at)
  if (nowUtc > due) return 'overdue'
  const hoursLeft = (due - nowUtc) / 36e5
  if (hoursLeft <= 24) return 'upcoming'
  return task?.status === 'in_progress' ? 'in_progress' : 'pending'
}

function inQuietHoursLocal(localTime, quiet) {
  const startStr = quiet?.start || '22:00'
  const endStr   = quiet?.end   || '07:00'
  const [qsH, qsM] = startStr.split(':').map(Number)
  const [qeH, qeM] = endStr.split(':').map(Number)
  const start = new Date(localTime); start.setHours(qsH, qsM, 0, 0)
  const end   = new Date(localTime); end.setHours(qeH, qeM, 0, 0)
  if (qsH <= qeH) return localTime >= start && localTime <= end
  // Quiet overnight (e.g. 22:00->07:00)
  return localTime >= start || localTime <= end
}

function quietEndLocalFrom(localTime, quiet) {
  const endStr = quiet?.end || '07:00'
  const [qeH, qeM] = endStr.split(':').map(Number)
  const next = new Date(localTime)
  // If localTime already past end today, move to next day
  const minutesNow = localTime.getHours()*60 + localTime.getMinutes()
  const minutesEnd = qeH*60 + qeM
  if (minutesEnd <= minutesNow) next.setDate(next.getDate() + 1)
  next.setHours(qeH, qeM, 0, 0)
  return next
}

function adjustForQuiet(localCandidate, quiet) {
  if (inQuietHoursLocal(localCandidate, quiet)) {
    return quietEndLocalFrom(localCandidate, quiet)
  }
  return localCandidate
}

async function pushNotification(userId, title, message) {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type: 'task_reminder'
  })
  if (error) console.error('insert notifications error:', error)
}

async function countOverdueSends(taskId, userId) {
  const { data, error, count } = await supabase
    .from('reminder_logs')
    .select('id', { count: 'exact', head: true })
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .eq('severity', 'overdue')
  if (error) { console.warn('countOverdueSends error:', error); return 0 }
  return count || 0
}

async function runOnce() {
  const nowUtc = new Date()
  const { data: settings, error } = await supabase
    .from('task_reminder_settings')
    .select('*, task:task_id(*)')
    .eq('active', true)

  if (error) throw error

  for (const s of settings || []) {
    const tz = s.timezone || 'Asia/Ho_Chi_Minh'
    const quiet = parseQuietHours(s.quiet_hours)

    const task = s.task
    const status = computeStatus(task, nowUtc)
    if (status === 'done' || s.muted_by) continue

    // Start condition if never sent
    if (!s.last_sent_at) {
      if (s.start_mode === 'on_upcoming' && status !== 'upcoming') continue
      if (s.start_mode === 'on_overdue'  && status !== 'overdue') continue
      // on_create -> allowed to send immediately
    }

    // Due for send?
    const dueForSend = !s.last_sent_at || nowUtc >= addHours(new Date(s.last_sent_at), s.repeat_hours)

    // Prepare local times for quiet adjustment
    const localNow = utcToZonedTime(nowUtc, tz)

    if (!dueForSend) {
      // Ensure next_fire_at is populated for future and respects quiet hours
      if (!s.next_fire_at) {
        const nextLocal = adjustForQuiet(addHours(localNow, s.repeat_hours), quiet)
        const nextUtc = zonedTimeToUtc(nextLocal, tz)
        await supabase.from('task_reminder_settings')
          .update({ next_fire_at: nextUtc.toISOString() })
          .eq('task_id', s.task_id).eq('user_id', s.user_id)
      }
      continue
    }

    // If we are inside quiet hours, schedule and skip
    if (inQuietHoursLocal(localNow, quiet)) {
      const nextLocal = quietEndLocalFrom(localNow, quiet)
      const nextUtc = zonedTimeToUtc(nextLocal, tz)
      await supabase.from('task_reminder_settings')
        .update({ next_fire_at: nextUtc.toISOString() })
        .eq('task_id', s.task_id).eq('user_id', s.user_id)
      continue
    }

    // Compose message per status
    const map = {
      pending:   { icon: '⏳', lead: 'Chờ xử lý' },
      in_progress:{ icon: '⚡', lead: 'Đang thực hiện' },
      upcoming:  { icon: '⚠️', lead: 'Sắp đến hạn' },
      overdue:   { icon: '🔥', lead: 'Quá hạn' }
    }
    const m = map[status] || map.pending
    const title = `${m.icon} ${m.lead}: ${task?.title || 'Công việc'}`
    const body  = task?.due_at ? `Hạn: ${new Date(task.due_at).toLocaleString('vi-VN')}` : 'Không có hạn chót'

    // Optional escalate: if overdue many times
    if (status === 'overdue' && s.escalate_after > 0) {
      const sentCount = await countOverdueSends(s.task_id, s.user_id)
      if (sentCount + 1 >= s.escalate_after) {
        // You can add manager CC logic here: e.g., insert another notification for manager
        // For now, append a note
        await pushNotification(s.user_id, `${title} (nhắc cấp cao)`, body)
      }
    }

    await pushNotification(s.user_id, title, body)

    await supabase.from('reminder_logs').insert({
      task_id: s.task_id,
      user_id: s.user_id,
      channel: 'push',
      status: 'success',
      severity: status,
      message: body,
      snapshot: { task, setting: s }
    })

    // Compute the next run strictly in user's timezone, adjust quiet
    const nextLocalCandidate = addHours(localNow, s.repeat_hours)
    const nextLocal = adjustForQuiet(nextLocalCandidate, quiet)
    const nextUtc = zonedTimeToUtc(nextLocal, tz)

    await supabase.from('task_reminder_settings')
      .update({ last_sent_at: nowUtc.toISOString(), next_fire_at: nextUtc.toISOString() })
      .eq('task_id', s.task_id).eq('user_id', s.user_id)
  }
}

if (process.argv.includes('--once')) {
  runOnce().then(() => { console.log('Done.'); process.exit(0) }).catch(e => { console.error(e); process.exit(1) })
} else {
  // default: run once
  runOnce().then(() => { console.log('Done.'); process.exit(0) }).catch(e => { console.error(e); process.exit(1) })
}
