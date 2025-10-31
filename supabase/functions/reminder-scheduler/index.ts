// Supabase Edge Function (Deno): reminder-scheduler
// Triggers by Supabase Scheduler (cron) every N minutes
// - Reads public.task_reminder_settings (active)
// - Computes status from tasks and time
// - Respects repeat_hours, quiet hours, timezone
// - Inserts notifications and reminder_logs, updates last_sent_at/next_fire_at
/// <reference lib="dom" />
// Note: VS Code in Node mode doesn't know Deno/jsr/npm import specifiers.
// We suppress editor-only type errors while keeping correct runtime for Supabase Edge.
// @ts-ignore
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js'
// @ts-ignore
// In Supabase Dashboard's Edge Function editor, parent folders aren't bundled.
// Use a sibling module instead of ../_shared. See notifiers.ts in this folder.
import { sendEmail, sendSMS, normalizePhone } from './notifiers.ts'

// Minimal Deno declaration for editor type satisfaction (runtime provided by Edge)
declare const Deno: {
  env: { get: (name: string) => string | undefined }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

// In Supabase Edge, secrets must NOT start with the SUPABASE_ prefix.
// Support multiple names so users can configure safely via the Dashboard.
const env = (k: string) => Deno.env.get(k)
const SUPABASE_URL = env('SUPABASE_URL')
  ?? env('PROJECT_URL')
  ?? env('NEXT_PUBLIC_SUPABASE_URL')
  ?? undefined
const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
  ?? env('SERVICE_ROLE_KEY')
  ?? env('SUPABASE_SERVICE_ROLE')
  ?? env('SERVICE_ROLE')
  ?? undefined

if (!SUPABASE_URL) {
  throw new Error('Missing env: set PROJECT_URL (or SUPABASE_URL) in Edge Function Secrets')
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env: set SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Edge Function Secrets')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 3600 * 1000)
}

// Flexible interval adder based on unit/value
function addIntervalByUnit(date: Date, unit?: string | null, value?: number | null): Date {
  const base = new Date(date.getTime())
  if (!unit || !value || value <= 0) {
    // Fallback 24h if not configured
    return addHours(base, 24)
  }
  switch (unit) {
    case 'hours':
      return addHours(base, value)
    case 'days':
      base.setDate(base.getDate() + value)
      return base
    case 'weeks':
      base.setDate(base.getDate() + 7 * value)
      return base
    case 'months':
      base.setMonth(base.getMonth() + value)
      return base
    case 'quarters':
      base.setMonth(base.getMonth() + 3 * value)
      return base
    case 'years':
      base.setFullYear(base.getFullYear() + value)
      return base
    default:
      return addHours(base, 24)
  }
}

// Safely parse a date-like value. Returns null if invalid.
function parseDateSafe(v: any): Date | null {
  if (!v) return null
  try {
    const d = v instanceof Date ? v : new Date(v as any)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

function computeStatus(task: any, now: Date) {
  if (task?.completed_at) return 'done'
  const dueParsed = parseDateSafe(task?.due_at || task?.due_date)
  if (!dueParsed) return (task?.status === 'in_progress') ? 'in_progress' : 'pending'
  const due = dueParsed
  if (now > due) return 'overdue'
  const hoursLeft = (due.getTime() - now.getTime()) / 36e5
  if (hoursLeft <= 24) return 'upcoming'
  return task?.status === 'in_progress' ? 'in_progress' : 'pending'
}

function parseQuietHours(json: any) {
  try { return typeof json === 'string' ? JSON.parse(json) : (json || {}) } catch { return {} }
}

// Parse HH:mm safely; fallback when invalid
function parseTimePair(v: any, fallback: string): [number, number] {
  const fb = fallback.split(':').map((n) => Number(n))
  if (typeof v !== 'string') return [fb[0] ?? 0, fb[1] ?? 0]
  const m = v.trim().match(/^([0-2]?\d):([0-5]?\d)$/)
  if (!m) return [fb[0] ?? 0, fb[1] ?? 0]
  const h = Math.min(23, Math.max(0, Number(m[1])))
  const mm = Math.min(59, Math.max(0, Number(m[2])))
  return [h, mm]
}

function inQuietHours(localNow: Date, quiet: any): boolean {
  const startStr = quiet?.start || '22:00'
  const endStr   = quiet?.end   || '07:00'
  const [qsH, qsM] = parseTimePair(startStr, '22:00')
  const [qeH, qeM] = parseTimePair(endStr,   '07:00')

  const start = new Date(localNow); start.setHours(qsH, qsM, 0, 0)
  const end   = new Date(localNow); end.setHours(qeH, qeM, 0, 0)

  if (qsH <= qeH) return localNow >= start && localNow <= end
  // qua ngày: 22:00 -> 07:00
  return localNow >= start || localNow <= end
}

function nextAfterQuiet(localNow: Date, quiet: any): Date {
  const endStr = quiet?.end || '07:00'
  const [qeH, qeM] = parseTimePair(endStr, '07:00')
  const next = new Date(localNow)
  // nếu đang trong quiet -> chọn giờ end (có thể ngày sau)
  const inQ = inQuietHours(localNow, quiet)
  if (inQ) {
    const minutesNow = localNow.getHours()*60 + localNow.getMinutes()
    const minutesEnd = qeH*60 + qeM
    if (minutesEnd <= minutesNow) next.setDate(next.getDate() + 1)
  }
  next.setHours(qeH, qeM, 0, 0)
  return next
}

function toISOStringSafe(d: Date | null | undefined): string | null {
  if (!d || !(d instanceof Date)) return null
  const t = d.getTime()
  if (!Number.isFinite(t)) return null
  return d.toISOString()
}

async function pushToUser(userId: string, title: string, body: string) {
  // Tối giản: ghi vào bảng notifications cho client realtime
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message: body,
    type: 'task_reminder'
  })
  if (error) console.error('insert notifications error', error)
}

function computeReminderSeverity(task: any, now: Date): 'in_progress' | 'nearly_due' | 'overdue' {
  const d = parseDateSafe(task?.due_date || task?.due_at)
  if (d) {
    const diffDays = Math.floor((d.getTime() - now.getTime()) / 86400000)
    if (now > d) return 'overdue'
    if (diffDays <= 2) return 'nearly_due'
  }
  return 'in_progress'
}

async function processReminderQueue(nowUtc: Date) {
  const nowIso = nowUtc.toISOString()
  // Pull up to 100 pending reminders
  const { data: reminders, error } = await supabase
    .from('task_reminders')
    .select(`
      id,
      task_id,
      user_id,
      message,
      scheduled_at,
      tasks:task_id(id, title, due_date, due_at, priority, assigned_by, assigned_to)
    `)
    .eq('sent', false)
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(100)

  if (error) throw error

  let processed = 0
  // Batch-load user profiles
  // Collect primary reminder targets and also task assigners for overdue escalation
  const userIds = Array.from(new Set([
    ...((reminders || []).map((r: any) => r.user_id).filter(Boolean)),
    ...((reminders || []).map((r: any) => r.tasks?.assigned_by).filter(Boolean))
  ]))
  let profilesMap = new Map<string, any>()
  if (userIds.length) {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .in('id', userIds)
    if (!pErr) {
      for (const p of profiles || []) profilesMap.set(p.id, p)
    }
  }

  for (const r of reminders || []) {
    const task = r.tasks
    const user = profilesMap.get(r.user_id) || null
    const severity = computeReminderSeverity(task, nowUtc)
    const title = `🔔 Nhắc việc: ${task?.title || 'Công việc'}`

  // Always in-app for the primary user
    await pushToUser(r.user_id, title, r.message)

  // Email for nearly_due/overdue if email exists (primary user)
    let emailResult: any = { ok: false, skipped: 'no_email' }
    if (user?.email && (severity === 'nearly_due' || severity === 'overdue')) {
      const subject = `${severity === 'overdue' ? '🔥 Quá hạn' : '⚠️ Sắp đến hạn'}: ${task?.title || 'Công việc'}`
      const dueDate = parseDateSafe(task?.due_date || task?.due_at)
      const dueStr = dueDate ? dueDate.toLocaleString('vi-VN') : null
      const html = `
        <div style="font-family: Arial, sans-serif; line-height:1.6">
          <h3>${subject}</h3>
          <p>${r.message}</p>
          ${dueStr ? `<p><strong>Hạn:</strong> ${dueStr}</p>` : ''}
          <p style="color:#888">Hệ thống QLDA</p>
        </div>
      `
      emailResult = await sendEmail(user.email, subject, html)
    }

    // SMS only for overdue if phone exists (primary user)
    let smsResult: any = { ok: false, skipped: 'no_phone' }
    const phone = normalizePhone(user?.phone)
    if (phone && severity === 'overdue') {
      const dueDate = parseDateSafe(task?.due_date || task?.due_at)
      const dueStr = dueDate ? dueDate.toLocaleDateString('vi-VN') : ''
      const body = `[QLDA] Qua han: ${task?.title || 'Cong viec'}${dueStr ? ` - Han: ${dueStr}` : ''}`
      smsResult = await sendSMS(phone, body)
    }

    // If overdue, also notify the assigner (người giao việc) via email and SMS when possible
    let assignerEmailResult: any = undefined
    let assignerSmsResult: any = undefined
    const assignerId = task?.assigned_by
    if (severity === 'overdue' && assignerId && assignerId !== r.user_id) {
      const assigner = profilesMap.get(assignerId) || null
      if (assigner?.email) {
        const subject = `🔥 Quá hạn (người giao việc): ${task?.title || 'Công việc'}`
        const dueDate = parseDateSafe(task?.due_date || task?.due_at)
        const dueStr = dueDate ? dueDate.toLocaleString('vi-VN') : null
        const html = `
          <div style="font-family: Arial, sans-serif; line-height:1.6">
            <h3>${subject}</h3>
            <p>${r.message}</p>
            ${dueStr ? `<p><strong>Hạn:</strong> ${dueStr}</p>` : ''}
            <p style="color:#888">Bạn là người giao việc. Vui lòng hỗ trợ đôn đốc.</p>
            <p style="color:#888">Hệ thống QLDA</p>
          </div>
        `
        assignerEmailResult = await sendEmail(assigner.email, subject, html)
      } else {
        assignerEmailResult = { ok: false, skipped: 'no_email' }
      }
      const assignerPhone = normalizePhone(assigner?.phone)
      if (assignerPhone) {
        const dueDate = parseDateSafe(task?.due_date || task?.due_at)
        const dueStr = dueDate ? dueDate.toLocaleDateString('vi-VN') : ''
        const body = `[QLDA] Qua han (nguoi giao): ${task?.title || 'Cong viec'}${dueStr ? ` - Han: ${dueStr}` : ''}`
        assignerSmsResult = await sendSMS(assignerPhone, body)
      } else {
        assignerSmsResult = { ok: false, skipped: 'no_phone' }
      }
    }

    // Mark sent and log
    await supabase
      .from('task_reminders')
      .update({ sent: true, sent_at: nowIso, updated_at: nowIso })
      .eq('id', r.id)

    // Log channels
    await supabase.from('reminder_logs').insert([
      { task_id: r.task_id, user_id: r.user_id, channel: 'push', status: 'success', severity, message: r.message, snapshot: { reminder: r } },
      emailResult?.ok !== undefined ? {
        task_id: r.task_id, user_id: r.user_id, channel: 'email', status: emailResult.ok ? 'success' : (emailResult.skipped ? 'skipped' : 'failed'), severity, message: r.message, error: emailResult.error || emailResult.skipped || null, snapshot: { reminder: r }
      } : null,
      smsResult?.ok !== undefined ? {
        task_id: r.task_id, user_id: r.user_id, channel: 'sms', status: smsResult.ok ? 'success' : (smsResult.skipped ? 'skipped' : 'failed'), severity, message: r.message, error: smsResult.error || smsResult.skipped || null, snapshot: { reminder: r }
      } : null,
      // Logs for assigner (only when processed above)
      assignerEmailResult?.ok !== undefined ? {
        task_id: r.task_id, user_id: task?.assigned_by, channel: 'email', status: assignerEmailResult.ok ? 'success' : (assignerEmailResult.skipped ? 'skipped' : 'failed'), severity, message: r.message, error: assignerEmailResult.error || assignerEmailResult.skipped || null, snapshot: { reminder: r }
      } : null,
      assignerSmsResult?.ok !== undefined ? {
        task_id: r.task_id, user_id: task?.assigned_by, channel: 'sms', status: assignerSmsResult.ok ? 'success' : (assignerSmsResult.skipped ? 'skipped' : 'failed'), severity, message: r.message, error: assignerSmsResult.error || assignerSmsResult.skipped || null, snapshot: { reminder: r }
      } : null
    ].filter(Boolean) as any)

    processed++
  }
  return processed
}

// Batch load user reminder preferences for a set of users
async function getUserPrefsMap(userIds: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>()
  if (!userIds?.length) return map
  const { data, error } = await supabase
    .from('user_reminder_preferences')
    .select('user_id, one_time_config, recurring_config')
    .in('user_id', userIds)
  if (error) return map
  for (const row of data || []) map.set(row.user_id, row)
  return map
}

function parseJson(obj: any) {
  try { return typeof obj === 'string' ? JSON.parse(obj) : (obj || null) } catch { return null }
}

function getNextFromSpecificTimes(now: Date, specificTimes: string[], daysOfWeek?: number[], quiet?: any): Date | null {
  const dow = now.getDay() === 0 ? 7 : now.getDay()
  const allowed = (daysOfWeek && daysOfWeek.length) ? daysOfWeek : [1,2,3,4,5,6,7]
  // Try today first if allowed
  const candidates: Date[] = []
  const tryDays = allowed.includes(dow) ? [0,1] : [1] // today or tomorrow
  for (const addDay of tryDays) {
    for (const t of specificTimes || []) {
      const [h, m] = String(t).split(':').map(Number)
      if (Number.isFinite(h) && Number.isFinite(m)) {
        const d = new Date(now)
        d.setDate(d.getDate() + addDay)
        d.setHours(h, m, 0, 0)
        if (d > now) candidates.push(d)
      }
    }
  }
  candidates.sort((a,b) => a.getTime() - b.getTime())
  let next = candidates[0] || null
  if (next && quiet && inQuietHours(next, quiet)) {
    next = nextAfterQuiet(next, quiet)
  }
  return next
}

function getNextFromRepeatHours(now: Date, repeatEveryHours?: number | null, maxPerDay?: number | null, quiet?: any): Date | null {
  if (!repeatEveryHours || repeatEveryHours <= 0) return null
  // Choose next slot starting one interval from now
  const next = addHours(now, repeatEveryHours)
  if (quiet && inQuietHours(next, quiet)) return nextAfterQuiet(next, quiet)
  return next
}

// Basic CORS headers for browser calls
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const nowUtc = new Date()

    // 1) Fetch active settings with task joined
    const { data: settings, error } = await supabase
      .from('task_reminder_settings')
      .select('*, tasks:task_id(*)')
      .eq('active', true)

    if (error) throw error

    // Batch-load user preferences to honor specific times/days
    const settingsList = settings || []
    const userIds: string[] = Array.from(
      new Set(
        (settingsList as any[])
          .map((s: any) => s?.user_id)
          .filter((v: any) => typeof v === 'string' && v.length > 0)
      )
    ) as string[]
    const prefsMap = await getUserPrefsMap(userIds)

    for (const s of settingsList) {
      try {
      const task = s.tasks
      const status = computeStatus(task, nowUtc)
      if (status === 'done' || s.muted_by) continue

      // Start condition
      if (!s.last_sent_at) {
        if (s.start_mode === 'on_upcoming' && status !== 'upcoming') continue
        if (s.start_mode === 'on_overdue'  && status !== 'overdue') continue
      }

      // User preferences-aware scheduling: if user has specific times configured for this status,
      // schedule the next reminder into the queue instead of sending immediately.
      const prefs = prefsMap.get(s.user_id)
      let handledByPrefs = false
      if (prefs) {
        const taskType = (task?.task_type === 'recurring') ? 'recurring' : 'one_time'
        const prefConfigKey = taskType === 'recurring' ? 'recurring_config' : 'one_time_config'
        const prefCfg = parseJson(prefs?.[prefConfigKey]) || {}
        const prefActive = prefCfg?.active !== false
        // Map our status to preference keys: upcoming -> nearly_due
        const prefStatus = status === 'upcoming' ? 'nearly_due' : (status === 'overdue' ? 'overdue' : 'in_progress')
        const statusCfg = prefCfg?.by_status?.[prefStatus]
        if (prefActive && statusCfg?.enabled) {
          const quiet = statusCfg?.quiet_hours || prefCfg?.quiet_hours || parseQuietHours(s.quiet_hours)
          const nextBySpecific = getNextFromSpecificTimes(nowUtc, statusCfg?.specific_times || [], statusCfg?.days_of_week, quiet)
          const nextByRepeat = !nextBySpecific ? getNextFromRepeatHours(nowUtc, statusCfg?.repeat_every_hours, statusCfg?.max_per_day, quiet) : null
          const nextPrefTime = nextBySpecific || nextByRepeat
          if (nextPrefTime && Number.isFinite(nextPrefTime.getTime())) {
            // Check if an upcoming unsent reminder already exists
            const { data: existing, error: exErr } = await supabase
              .from('task_reminders')
              .select('id')
              .eq('task_id', s.task_id)
              .eq('user_id', s.user_id)
              .eq('sent', false)
              .gt('scheduled_at', nowUtc.toISOString())
              .limit(1)
            if (!exErr && (!existing || !existing.length)) {
              const message = `Nhắc việc: ${task?.title || 'Công việc'}`
              await supabase.from('task_reminders').insert({
                task_id: s.task_id,
                user_id: s.user_id,
                scheduled_at: toISOStringSafe(nextPrefTime) || addHours(nowUtc, 1).toISOString(),
                message,
                sent: false
              })
            }
            // Set next_fire_at for visibility and skip immediate push
            await supabase.from('task_reminder_settings')
              .update({ next_fire_at: toISOStringSafe(nextPrefTime) || addHours(nowUtc, 1).toISOString() })
              .eq('task_id', s.task_id).eq('user_id', s.user_id)
            handledByPrefs = true
          }
        }
      }

      if (handledByPrefs) continue

      // Repeat window (schema-aligned): prefer repeat_interval_{unit,value}, fallback to legacy repeat_hours
      const lastSent = parseDateSafe(s.last_sent_at)
      const nextDueByUnit = lastSent ? addIntervalByUnit(lastSent, (s as any).repeat_interval_unit, (s as any).repeat_interval_value) : null
      let dueForSend = false
      if (!lastSent) dueForSend = true
      else if (nextDueByUnit && nowUtc >= nextDueByUnit) dueForSend = true
      else if ((s as any).repeat_hours) dueForSend = nowUtc >= addHours(lastSent, (s as any).repeat_hours)
      if (!dueForSend) continue

      // Quiet hours (local)
      const tz = s.timezone || 'Asia/Ho_Chi_Minh'
      // Deno không có date-fns-tz; dùng offset client-side không đáng tin ->
      // giải pháp tối giản: chỉ áp dụng giờ yên lặng theo giờ hệ thống server (UTC) hoặc lưu next_fire_at trước.
      // Ở đây: chỉ xét chuỗi time trực tiếp (đơn giản hoá)
  const quiet = parseQuietHours(s.quiet_hours)

      // Nếu muốn chính xác timezone, nên tính next_fire_at ở client app/server Node.
      // Tạm dùng UTC để kiểm tra cửa sổ [start,end] theo HH:mm UTC.
      const utcNow = new Date(nowUtc)
      const inQuiet = inQuietHours(utcNow, quiet)
      if (inQuiet) {
        const localNext = nextAfterQuiet(utcNow, quiet)
        const iso = toISOStringSafe(localNext) || addHours(utcNow, 1).toISOString()
        await supabase.from('task_reminder_settings')
          .update({ next_fire_at: iso })
          .eq('task_id', s.task_id).eq('user_id', s.user_id)
        continue
      }

      const statusMap: Record<string, {icon: string, lead: string}> = {
        pending: { icon: '⏳', lead: 'Chờ xử lý' },
        in_progress: { icon: '⚡', lead: 'Đang thực hiện' },
        upcoming: { icon: '⚠️', lead: 'Sắp đến hạn' },
        overdue: { icon: '🔥', lead: 'Quá hạn' }
      }

  const m = statusMap[status] || statusMap.pending
  const title = `${m.icon} ${m.lead}: ${task?.title || 'Công việc'}`
  const dueAt = parseDateSafe(task?.due_at || task?.due_date)
  const body = dueAt ? `Hạn: ${dueAt.toLocaleString('vi-VN')}` : 'Không có hạn chót'

      await pushToUser(s.user_id, title, body)

      await supabase.from('reminder_logs').insert({
        task_id: s.task_id,
        user_id: s.user_id,
        channel: 'push',
        status: 'success',
        severity: status,
        message: body,
        snapshot: { task, setting: s }
      })

      // If overdue and not handled by preferences, escalate via email/SMS to both assignee (s.user_id) and assigner
      if (status === 'overdue') {
        try {
          const assignerId = task?.assigned_by
          const idsToFetch = [s.user_id, assignerId].filter(Boolean)
          if (idsToFetch.length) {
            const { data: recips, error: rErr } = await supabase
              .from('profiles')
              .select('id, email, phone')
              .in('id', idsToFetch as string[])
            if (!rErr && recips) {
              const recMap = new Map<string, any>((recips as any[]).map((r: any) => [r.id, r]))
              const sendFor = async (uid: string, roleLabel?: string) => {
                const prof = recMap.get(uid)
                // Email
                let emailRes: any = { ok: false, skipped: 'no_email' }
                if (prof?.email) {
                  const subject = `🔥 Quá hạn${roleLabel ? ` (${roleLabel})` : ''}: ${task?.title || 'Công việc'}`
                  const dueDate = parseDateSafe(task?.due_date || task?.due_at)
                  const dueStr = dueDate ? dueDate.toLocaleString('vi-VN') : null
                  const html = `
                    <div style="font-family: Arial, sans-serif; line-height:1.6">
                      <h3>${subject}</h3>
                      <p>${body}</p>
                      ${dueStr ? `<p><strong>Hạn:</strong> ${dueStr}</p>` : ''}
                      ${roleLabel === 'người giao việc' ? '<p style="color:#888">Bạn là người giao việc. Vui lòng hỗ trợ đôn đốc.</p>' : ''}
                      <p style="color:#888">Hệ thống QLDA</p>
                    </div>
                  `
                  emailRes = await sendEmail(prof.email, subject, html)
                }
                await supabase.from('reminder_logs').insert({
                  task_id: s.task_id, user_id: uid, channel: 'email', status: emailRes.ok ? 'success' : (emailRes.skipped ? 'skipped' : 'failed'), severity: status, message: body, error: emailRes.error || emailRes.skipped || null, snapshot: { task, setting: s }
                })

                // SMS
                let smsRes: any = { ok: false, skipped: 'no_phone' }
                const phone = normalizePhone(prof?.phone)
                if (phone) {
                  const dueDate = parseDateSafe(task?.due_date || task?.due_at)
                  const dueStr = dueDate ? dueDate.toLocaleDateString('vi-VN') : ''
                  const smsBody = `[QLDA] Qua han${roleLabel ? ' (' + roleLabel + ')' : ''}: ${task?.title || 'Cong viec'}${dueStr ? ` - Han: ${dueStr}` : ''}`
                  smsRes = await sendSMS(phone, smsBody)
                }
                await supabase.from('reminder_logs').insert({
                  task_id: s.task_id, user_id: uid, channel: 'sms', status: smsRes.ok ? 'success' : (smsRes.skipped ? 'skipped' : 'failed'), severity: status, message: body, error: smsRes.error || smsRes.skipped || null, snapshot: { task, setting: s }
                })
              }
              // Assignee
              await sendFor(s.user_id)
              // Assigner (if any)
              if (assignerId && assignerId !== s.user_id) await sendFor(assignerId, 'người giao việc')
            }
          }
        } catch (e) {
          console.error('escalation send failed', e)
        }
      }

      // Compute next fire time using flexible interval (fallback to hours if absent)
      const next = addIntervalByUnit(nowUtc, (s as any).repeat_interval_unit, (s as any).repeat_interval_value)
      await supabase.from('task_reminder_settings')
        .update({ last_sent_at: nowUtc.toISOString(), next_fire_at: next.toISOString() })
        .eq('task_id', s.task_id).eq('user_id', s.user_id)
      } catch (err) {
        console.error('⚠️ Skipping setting due to error:', err, 'Setting:', s)
        // Best-effort log to help diagnose bad data without failing the run
        try {
          await supabase.from('reminder_logs').insert({
            task_id: s.task_id,
            user_id: s.user_id,
            channel: 'settings',
            status: 'failed',
            severity: 'in_progress',
            message: 'Error processing reminder setting',
            error: String(err),
            snapshot: { setting: s }
          })
        } catch (_) {}
        continue
      }
    }

    // 2) Process due reminders from queue (task_reminders)
    const queueProcessed = await processReminderQueue(nowUtc)

    return new Response(JSON.stringify({ ok: true, processed_settings: settings?.length || 0, processed_queue: queueProcessed }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' }
    })
  } catch (e) {
    console.error('reminder-scheduler error', e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})
