// Shared notifier utilities for Supabase Edge (Deno)
// - Email via Resend
// - SMS via Twilio
// - Phone normalization for Vietnam numbers

// @ts-ignore
import { Resend } from 'npm:resend'
// @ts-ignore
import twilio from 'npm:twilio'

// Minimal Deno declaration for editor satisfaction
declare const Deno: {
  env: { get: (name: string) => string | undefined }
}

const env = (k: string) => Deno.env.get(k)

// Email via Resend -----------------------------------------------------------
const RESEND_API_KEY = env('RESEND_API_KEY')
const RESEND_FROM_EMAIL = env('RESEND_FROM_EMAIL') || env('RESEND_FROM')

export async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return { ok: false, skipped: 'missing_email_creds' }
  }
  try {
    const resend = new Resend(RESEND_API_KEY)
    const res = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to,
      subject,
      html
    })
    return { ok: true, id: res?.id }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// SMS via Twilio ------------------------------------------------------------
const TWILIO_ACCOUNT_SID = env('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = env('TWILIO_AUTH_TOKEN')
const TWILIO_FROM_NUMBER = env('TWILIO_FROM_NUMBER') || env('TWILIO_FROM')

export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null
  let s = String(raw).replace(/\D+/g, '')
  if (s.startsWith('84')) s = '+' + s
  else if (s.startsWith('0')) s = '+84' + s.slice(1)
  else if (!s.startsWith('+')) s = '+' + s
  return s
}

export async function sendSMS(toRaw: string, body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return { ok: false, skipped: 'missing_sms_creds' }
  }
  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    const to = normalizePhone(toRaw)
    if (!to) return { ok: false, skipped: 'invalid_phone' }
    const msg = await client.messages.create({ from: TWILIO_FROM_NUMBER, to, body })
    return { ok: true, sid: msg?.sid }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
