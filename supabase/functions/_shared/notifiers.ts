// Shared notifier helpers for Supabase Edge Functions (Deno)
// Provides sendEmail (Resend) and sendSMS (Twilio) with graceful fallbacks
// @ts-ignore - Deno provides fetch/env at runtime
declare const Deno: { env: { get: (name: string) => string | undefined } }

const env = (k: string) => Deno.env.get(k)

// Email via Resend (https://resend.com)
export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  const apiKey = env('RESEND_API_KEY') || env('RESEND_KEY')
  const from = env('RESEND_FROM_EMAIL') || env('EMAIL_FROM') || 'QLDA <no-reply@example.com>'
  if (!apiKey) {
    return { ok: false, skipped: 'missing_resend_api_key' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to, subject, html, text })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: data?.message || res.statusText }
    }
    return { ok: true, id: data?.id }
  } catch (e: any) {
    return { ok: false, error: String(e) }
  }
}

// SMS via Twilio (https://www.twilio.com)
export async function sendSMS(to: string, body: string) {
  const sid = env('TWILIO_ACCOUNT_SID')
  const token = env('TWILIO_AUTH_TOKEN')
  const from = env('TWILIO_FROM_NUMBER')
  if (!sid || !token || !from) {
    return { ok: false, skipped: 'missing_twilio_config' }
  }

  // Basic normalization for Vietnam numbers like 0xxxxxxxxx -> +84xxxxxxxxx
  const normalizedTo = normalizePhone(to)
  if (!normalizedTo) return { ok: false, error: 'invalid_phone' }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`
  const params = new URLSearchParams()
  params.set('From', from)
  params.set('To', normalizedTo)
  params.set('Body', body)

  try {
    const auth = btoa(`${sid}:${token}`)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: data?.message || res.statusText }
    }
    return { ok: true, sid: data?.sid }
  } catch (e: any) {
    return { ok: false, error: String(e) }
  }
}

export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null
  let p = String(phone).trim()
  // Remove spaces/dashes
  p = p.replace(/[\s-]+/g, '')
  if (p.startsWith('+')) return p
  if (p.startsWith('00')) return '+' + p.slice(2)
  // VN local -> +84
  if (p.startsWith('0')) return '+84' + p.slice(1)
  // Fallback: assume already E.164 without plus
  if (/^\d{8,15}$/.test(p)) return '+' + p
  return null
}
