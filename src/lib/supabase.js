import { createClient } from '@supabase/supabase-js'

// BẮT BUỘC dùng biến môi trường; không dùng giá trị mặc định để tránh kết nối nhầm dự án
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const msg = 'Thiếu cấu hình Supabase (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Vui lòng tạo file .env.local và khởi động lại.'
  // Thông báo rõ ràng trong console và UI dev
  // eslint-disable-next-line no-alert
  if (typeof window !== 'undefined') try { alert(msg) } catch {}
  throw new Error(msg)
}

console.log('✅ Supabase connected:', supabaseUrl)

// Xóa session Supabase đã hết hạn để tránh client auto refresh ngay khi khởi động
const clearExpiredSupabaseSessions = () => {
  try {
    const nowSec = Math.floor(Date.now() / 1000)
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('sb-') && k.includes('auth-token')) {
        try {
          const raw = localStorage.getItem(k)
          const obj = raw ? JSON.parse(raw) : null
          const exp = obj?.expires_at || obj?.expires_in
          if (typeof exp === 'number' && exp > 0 && exp < nowSec) {
            localStorage.removeItem(k)
          }
        } catch {}
      }
    }
  } catch {}
}

clearExpiredSupabaseSessions()

// Custom fetch with timeout + clearer error cho mạng chập chờn
const withTimeout = (ms = 8000) => async (input, init = {}) => {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  try {
    // Rút ngắn/Chặn riêng cho đường refresh_token để tránh chờ lâu 8s
    const urlStr = typeof input === 'string' ? input : (input?.url || '')
    if (urlStr.includes('/auth/v1/token?grant_type=refresh_token')) {
      clearTimeout(id)
      // Chặn hẳn để không tạo spam; trả về lỗi nhanh
      return new Response(null, { status: 499, statusText: 'refresh_blocked' })
    }

    const res = await fetch(input, { ...init, signal: ctrl.signal })
    return res
  } catch (err) {
    if (err?.name === 'AbortError') {
      const url = typeof input === 'string' ? input : (input?.url || '')
      // Giảm ồn: không log cảnh báo cho refresh_token bị chặn/abort
      if (!url.includes('/auth/v1/token?grant_type=refresh_token')) {
        console.warn(`⏳ Supabase fetch timeout after ${ms}ms:`, url)
      }
    }
    throw err
  } finally {
    clearTimeout(id)
  }
}

// Dynamic timeout: dài hơn cho upload/download Storage để tránh abort khi file lớn
const timeoutFetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input?.url || '')
  const method = String(init?.method || 'GET').toUpperCase()
  const isStorage = /\/storage\/v1\//.test(url)
  const isUpload = isStorage && (method === 'POST' || method === 'PUT')
  // 120s cho upload/storage, 20s mặc định cho các API khác
  const ms = isUpload ? 120_000 : 20_000
  return withTimeout(ms)(input, init)
}

// Chế độ khởi tạo thân thiện offline: tránh gọi refresh-token khi đang mất mạng
const OFFLINE_INIT = (
  typeof navigator !== 'undefined' && navigator.onLine === false
) || (import.meta?.env?.VITE_SUPABASE_OFFLINE_INIT === '1')

const authOptionsOnline = {
  // Tắt auto refresh để tránh vòng lặp timeout khi mạng bị chặn
  autoRefreshToken: false,
  persistSession: true,
  detectSessionInUrl: true,
  storage: window.localStorage,
  storageKey: 'qlda-auth-token',
  flowType: 'pkce'
}
const authOptionsOffline = {
  autoRefreshToken: false,
  persistSession: false,
  detectSessionInUrl: false,
  storage: window.localStorage,
  storageKey: 'qlda-auth-token',
  flowType: 'pkce'
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: OFFLINE_INIT ? authOptionsOffline : authOptionsOnline,
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'x-client-info': 'qlda-web-app'
    },
    fetch: timeoutFetch
  }
})

// Khi có mạng trở lại, cố gắng khởi tạo lại session (nếu có)

// Khi có mạng trở lại, cố gắng khởi tạo lại session (nếu có)
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    try {
      // Khi mạng trở lại: thử refresh token thủ công nếu còn session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase.auth.refreshSession()
      }
    } catch (e) {
      console.warn('🔁 Retry getSession on online failed:', e?.message || e)
    }
  })
}

// Expose supabase to window for debugging
if (typeof window !== 'undefined') {
  window.supabase = supabase
  console.log('✅ Supabase client exposed to window.supabase for debugging')
}

// Export everything as default to fix Android WebView bundling
export default {
  supabase,
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabaseAnonKey
}
