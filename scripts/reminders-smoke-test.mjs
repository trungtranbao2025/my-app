/*
  Reminder Smoke Test
  - Seeds user preferences for a given user
  - Creates a test task due in ~3h (status: upcoming -> mapped to nearly_due prefs)
  - Calls Edge Function /reminder-scheduler to schedule next reminder into queue
  - Verifies a task_reminders row exists
  - Forces queue send by setting scheduled_at <= now, calls function again
  - Verifies a notification row is inserted

  Requirements (env):
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    TEST_USER_ID   (UUID from auth.users/profiles)

  Usage (PowerShell):
    $env:SUPABASE_URL="https://<project>.supabase.co"
    $env:SUPABASE_SERVICE_ROLE_KEY="<service-role>"
    $env:TEST_USER_ID="<uuid>"
    node scripts/reminders-smoke-test.mjs
*/

import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const TEST_USER_ID = process.env.TEST_USER_ID

if (!SUPABASE_URL || !SERVICE_ROLE || !TEST_USER_ID) {
  console.error('Missing env. Please set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_USER_ID')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

function pad(n) { return String(n).padStart(2,'0') }
function hhmm(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

async function ensurePreferences(userId) {
  // Prepare a specific time a few minutes ahead to observe scheduling quickly
  const now = new Date()
  const next = new Date(now.getTime() + 5 * 60 * 1000)
  const t = hhmm(next)

  const oneTime = {
    active: true,
    by_status: {
      in_progress: { enabled: false },
      nearly_due: {
        enabled: true,
        specific_times: [t],
        repeat_every_hours: 0,
        repeat_every_days: 1,
        max_per_day: 2,
        days_of_week: [1,2,3,4,5,6,7]
      },
      overdue: { enabled: false }
    },
    quiet_hours: { start: '00:00', end: '00:01' }
  }
  const recurring = { ...oneTime }

  const { error } = await supabase
    .from('user_reminder_preferences')
    .upsert({
      user_id: userId,
      one_time_config: oneTime,
      recurring_config: recurring
    }, { onConflict: 'user_id' })
  if (error) throw error
  return t
}

async function createTestTask(userId) {
  const now = new Date()
  const due = new Date(now.getTime() + 3 * 60 * 60 * 1000) // +3h -> upcoming
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: 'Smoke Reminder Test',
      status: 'pending',
      priority: 'medium',
      assigned_to: userId,
      due_date: due.toISOString()
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function upsertSettingsViaRules(taskId) {
  // Try to reuse your helper to generate settings from status rules
  try {
    const { error } = await supabase.rpc('sync_task_reminder_for_task', { p_task_id: taskId })
    if (error) console.warn('sync_task_reminder_for_task failed, will insert minimal settings fallback:', error.message)
  } catch (e) {
    console.warn('rpc sync failed (function may not exist). Fallback to direct insert.')
  }

  // Ensure there is at least one settings row for the assignee
  const { data: task, error: tErr } = await supabase.from('tasks').select('assigned_to').eq('id', taskId).single()
  if (tErr) throw tErr
  const { error: sErr } = await supabase.from('task_reminder_settings').upsert({
    task_id: taskId,
    user_id: task.assigned_to,
    active: true,
    start_mode: 'on_upcoming',
    repeat_interval_unit: 'hours',
    repeat_interval_value: 6,
    timezone: 'Asia/Ho_Chi_Minh'
  }, { onConflict: 'task_id, user_id' })
  if (sErr) throw sErr
}

async function callScheduler() {
  const url = `${SUPABASE_URL}/functions/v1/reminder-scheduler`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE,
      'Authorization': `Bearer ${SERVICE_ROLE}`
    }
  })
  const body = await res.text()
  let json
  try { json = JSON.parse(body) } catch { json = { raw: body } }
  return { status: res.status, json }
}

async function findQueue(taskId, userId) {
  const { data, error } = await supabase
    .from('task_reminders')
    .select('id, scheduled_at, sent')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .eq('sent', false)
    .order('scheduled_at', { ascending: true })
    .limit(5)
  if (error) throw error
  return data
}

async function forceSendFirst(queueRowId) {
  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('task_reminders')
    .update({ scheduled_at: nowIso, sent: false })
    .eq('id', queueRowId)
  if (error) throw error
}

async function getRecentNotification(userId) {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, message, created_at')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0] || null
}

;(async () => {
  console.log('1) Ensuring user preferences...')
  const nextTime = await ensurePreferences(TEST_USER_ID)
  console.log('   next specific time:', nextTime)

  console.log('2) Creating test task...')
  const taskId = await createTestTask(TEST_USER_ID)
  console.log('   task id:', taskId)

  console.log('3) Ensuring settings via rules...')
  await upsertSettingsViaRules(taskId)

  console.log('4) Calling scheduler to generate queue...')
  const run1 = await callScheduler()
  console.log('   scheduler result:', run1)

  console.log('5) Checking queue...')
  const q = await findQueue(taskId, TEST_USER_ID)
  if (!q || !q.length) {
    console.error('FAIL: no queued reminders were created')
    process.exit(2)
  }
  console.log('   queued reminders:', q.map(r => ({ id: r.id, at: r.scheduled_at })))

  console.log('6) Forcing first queued reminder to now and re-run scheduler...')
  await forceSendFirst(q[0].id)
  const run2 = await callScheduler()
  console.log('   scheduler result:', run2)

  console.log('7) Checking notifications...')
  const n = await getRecentNotification(TEST_USER_ID)
  if (!n) {
    console.error('FAIL: no notification inserted')
    process.exit(3)
  }
  console.log('PASS: notification inserted ->', n)
  process.exit(0)
})().catch(e => { console.error(e); process.exit(1) })
