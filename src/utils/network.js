import supabaseLib from '../lib/supabase'

const { SUPABASE_URL, SUPABASE_ANON_KEY } = supabaseLib

/**
 * Lightweight connectivity checks to Supabase endpoints to avoid long timeouts
 * kind: 'rest' | 'auth' | 'any'
 */
export async function isSupabaseReachable(kind = 'any', timeoutMs = 1500) {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false

    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)

    const target = (() => {
      // REST check is the most reliable as it requires a valid API key response
      if (kind === 'rest') return `${SUPABASE_URL}/rest/v1/`
      if (kind === 'auth') return `${SUPABASE_URL}/auth/v1/health`
      // Default to a generic check
      return `${SUPABASE_URL}/auth/v1/health`
    })()

    const headers = {
      // The anon key is required for the REST endpoint to respond correctly
      apikey: SUPABASE_ANON_KEY,
    }

    // Use HEAD request for a lightweight check. Unlike 'no-cors', this ensures
    // we get a valid response from the server, not just an opaque one.
    const response = await fetch(target, { method: 'HEAD', headers, signal: ctrl.signal })
    clearTimeout(t)

    // A successful response (2xx-4xx) means the service is reachable.
    // We are not concerned with the specific status code, just that we got a response.
    return response.status < 500
  } catch (e) {
    // Any exception (including AbortError) means it's not reachable
    return false
  }
}

/**
 * Run callback once when browser regains connectivity
 */
export function onNextOnline(cb) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => {
    try { cb?.() } finally { window.removeEventListener('online', handler) }
  }
  window.addEventListener('online', handler)
  return () => window.removeEventListener('online', handler)
}
