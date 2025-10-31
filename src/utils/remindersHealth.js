// Lightweight helpers to inspect and trigger the reminders pipeline from the UI
import { supabase } from '../lib/supabase'

// Count pending reminders for current user (safe under RLS)
export async function getMyPendingRemindersCount(userId) {
  try {
    if (!userId) return 0
    const nowIso = new Date().toISOString()
    const { count, error } = await supabase
      .from('task_reminders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('sent', false)
      .lte('scheduled_at', nowIso)

    if (error) throw error
    return count || 0
  } catch (e) {
    // Fall back to 0 on any error; UI will show a subtle note
    return 0
  }
}

// Trigger reminder sender: prefer Edge Function, fallback to legacy SQL function if available
export async function runReminderSchedulerNow() {
  // 1) Try Edge Function (recommended)
  try {
    if (typeof supabase.functions?.invoke === 'function') {
      const { data, error } = await supabase.functions.invoke('reminder-scheduler', {
        body: { reason: 'manual-test' },
      })
      if (!error) {
        return { ok: true, via: 'edge', data }
      }
      // keep going to fallback
    }
  } catch (_) {}

  // 2) Fallback to legacy SQL function if present
  try {
    if (typeof supabase.rpc === 'function') {
      const { data, error } = await supabase.rpc('send_task_reminders')
      if (!error) {
        return { ok: true, via: 'sql', data }
      }
    }
  } catch (e) {
    return { ok: false, error: String(e) }
  }

  return { ok: false, error: 'No reminder runner available (Edge Function not deployed and SQL function missing)' }
}
