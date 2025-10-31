/// <reference lib="dom" />
// Edge Function: Process public.email_outbox and public.sms_outbox
// Sends pending messages via Resend (email) and Twilio (SMS), updates status
// Safe, idempotent-ish: rows are first claimed by setting status='processing'

// @ts-ignore - Deno Edge Runtime types
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
// @ts-ignore - Supabase client for Deno
import { createClient } from 'npm:@supabase/supabase-js'
// @ts-ignore - Shared notifiers (Resend/Twilio)
import { sendEmail, sendSMS, normalizePhone } from '../_shared/notifiers.ts'

declare const Deno: {
  env: { get: (name: string) => string | undefined }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

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

if (!SUPABASE_URL) throw new Error('Missing env: set PROJECT_URL (or SUPABASE_URL)')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing env: set SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY)')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function nowIso() { return new Date().toISOString() }

async function claimRow(table: 'email_outbox' | 'sms_outbox', id: string) {
  // Try to atomically mark a row as processing to avoid double send
  const { data, error, count } = await supabase
    .from(table)
    .update({ status: 'processing' })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id', { count: 'exact', head: false })
  if (error) {
    console.error(`[${table}] claim error`, error)
    return false
  }
  return (data && data.length > 0) || (typeof count === 'number' && count > 0)
}

async function markResult(table: 'email_outbox' | 'sms_outbox', id: string, ok: boolean, err?: string | null) {
  const patch: any = ok
    ? { status: 'sent', error: null, sent_at: nowIso() }
    : { status: 'failed', error: err || 'unknown_error' }
  const { error } = await supabase.from(table).update(patch).eq('id', id)
  if (error) console.error(`[${table}] mark result error`, error)
}

function asHtml(text: string) {
  const safe = (text || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
  return `<div style="font-family: Arial, sans-serif; line-height:1.6">${safe}<br/><p style="color:#888">Hệ thống QLDA</p></div>`
}

async function processEmailBatch(limit = 50) {
  const { data: rows, error } = await supabase
    .from('email_outbox')
    .select('id, notification_id, to_email, subject, body, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error

  let sent = 0, failed = 0, skipped = 0
  for (const r of rows || []) {
    const claimed = await claimRow('email_outbox', r.id)
    if (!claimed) { skipped++; continue }
    try {
      const html = asHtml(r.body)
      const res = await sendEmail(r.to_email, r.subject, html, r.body)
      if (res?.ok) { sent++; await markResult('email_outbox', r.id, true) }
      else { failed++; await markResult('email_outbox', r.id, false, res?.error || res?.skipped || 'send_failed') }
    } catch (e: any) {
      failed++
      await markResult('email_outbox', r.id, false, String(e))
    }
  }
  return { scanned: rows?.length || 0, sent, failed, skipped }
}

async function processSmsBatch(limit = 50) {
  const { data: rows, error } = await supabase
    .from('sms_outbox')
    .select('id, notification_id, to_phone, message, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error

  let sent = 0, failed = 0, skipped = 0
  for (const r of rows || []) {
    const claimed = await claimRow('sms_outbox', r.id)
    if (!claimed) { skipped++; continue }
    try {
      const to = normalizePhone(r.to_phone) || r.to_phone
      const res = await sendSMS(to, r.message)
      if (res?.ok) { sent++; await markResult('sms_outbox', r.id, true) }
      else { failed++; await markResult('sms_outbox', r.id, false, res?.error || res?.skipped || 'send_failed') }
    } catch (e: any) {
      failed++
      await markResult('sms_outbox', r.id, false, String(e))
    }
  }
  return { scanned: rows?.length || 0, sent, failed, skipped }
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const doEmail = (url.searchParams.get('emails') || '1') !== '0'
    const doSms = (url.searchParams.get('sms') || '1') !== '0'

    let emailRes = { scanned: 0, sent: 0, failed: 0, skipped: 0 }
    let smsRes = { scanned: 0, sent: 0, failed: 0, skipped: 0 }

    if (doEmail) emailRes = await processEmailBatch(limit)
    if (doSms) smsRes = await processSmsBatch(limit)

    const body = { ok: true, email: emailRes, sms: smsRes }
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    console.error('outbox-processor error', e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
