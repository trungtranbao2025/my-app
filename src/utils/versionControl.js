/**
 * Version Control và Auto Update System
 * Kiểm tra phiên bản và tự động cập nhật ứng dụng
 */

import { supabase } from '../lib/supabase'
import { isSupabaseReachable } from './network'

// Phiên bản hiện tại của ứng dụng (cập nhật mỗi khi release)
export const CURRENT_VERSION = '1.0.0'
export const BUILD_DATE = new Date('2025-10-07').getTime()

/**
 * Lấy thông tin phiên bản mới nhất từ database
 */
export async function getLatestVersion() {
  try {
    const reachable = await isSupabaseReachable('rest', 1200)
    if (!reachable) return null
    // Use RPC to avoid direct table access & recursion issues
    const { data, error } = await supabase.rpc('get_system_settings', { keys: ['app_version'] })
    if (error) {
      if (error.code === '42P17') {
        console.warn('RLS recursion (profiles) while reading app_version via RPC – returning null fallback')
        return null
      }
      throw error
    }
    const setting = Array.isArray(data) ? data.find(r => r.key === 'app_version') : null
    return setting?.value || null
  } catch (error) {
    console.error('Error getting latest version:', error)
    return null
  }
}

/**
 * So sánh 2 phiên bản (format: major.minor.patch)
 * @returns 1 nếu v1 > v2, -1 nếu v1 < v2, 0 nếu bằng nhau
 */
export function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1
    if (parts1[i] < parts2[i]) return -1
  }
  return 0
}

/**
 * Kiểm tra xem có phiên bản mới không
 */
export async function checkForUpdates() {
  try {
    const latest = await getLatestVersion()
    if (!latest) return null

    const hasUpdate = compareVersions(latest.version, CURRENT_VERSION) > 0
    
    return {
      hasUpdate,
      currentVersion: CURRENT_VERSION,
      latestVersion: latest.version,
      releaseNotes: latest.releaseNotes || '',
      forceUpdate: latest.forceUpdate || false,
      buildDate: latest.buildDate
    }
  } catch (error) {
    if (error.code === '42P17') {
      console.warn('Bỏ qua lỗi recursion RLS khi kiểm tra cập nhật')
      return null
    }
    console.error('Error checking for updates:', error)
    return null
  }
}

/**
 * Reload ứng dụng để cập nhật
 */
export function reloadApp() {
  // Clear cache và reload
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister()
      })
      window.location.reload(true)
    })
  } else {
    window.location.reload(true)
  }
}

/**
 * Lưu log lỗi vào database để debug
 */
export async function logError(error, context = {}) {
  try {
    const reachable = await isSupabaseReachable('rest', 1200)
    if (!reachable) return // skip logging when offline to avoid timeouts
    const errorLog = {
      error_message: error.message || String(error),
      error_stack: error.stack || '',
      error_type: error.name || 'Error',
      context: {
        ...context,
        version: CURRENT_VERSION,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      }
    }

    const { error: insertError } = await supabase
      .from('error_logs')
      .insert(errorLog)

    if (insertError) {
      console.error('Error saving error log:', insertError)
    }
  } catch (logError) {
    console.error('Failed to log error:', logError)
  }
}

/**
 * Kiểm tra và xử lý cache cũ
 */
export function clearOldCache() {
  try {
    // Clear localStorage items cũ
    const keysToCheck = Object.keys(localStorage)
    const now = Date.now()
    const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 ngày

    keysToCheck.forEach(key => {
      if (key.startsWith('cache_')) {
        try {
          const item = JSON.parse(localStorage.getItem(key))
          if (item.timestamp && (now - item.timestamp > maxAge)) {
            localStorage.removeItem(key)
          }
        } catch (e) {
          // Nếu parse lỗi, xóa luôn
          localStorage.removeItem(key)
        }
      }
    })

    // Clear service worker cache cũ
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          if (!name.includes(CURRENT_VERSION)) {
            caches.delete(name)
          }
        })
      })
    }
  } catch (error) {
    console.error('Error clearing old cache:', error)
  }
}

/**
 * Cập nhật phiên bản trong database (chỉ Manager)
 */
export async function updateAppVersion(versionData) {
  try {
    const reachable = await isSupabaseReachable('rest', 1200)
    if (!reachable) throw new Error('Máy chủ không khả dụng, vui lòng thử lại khi trực tuyến')
    // Direct upsert kept (admin action) - could also become its own RPC if needed
    const { error } = await supabase.from('system_settings').upsert({
      key: 'app_version',
      value: {
        version: versionData.version,
        buildDate: Date.now(),
        releaseNotes: versionData.releaseNotes,
        forceUpdate: versionData.forceUpdate || false
      },
      description: 'Phiên bản ứng dụng'
    }, { onConflict: 'key' })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error updating app version:', error)
    throw error
  }
}

/**
 * Lấy danh sách lỗi từ database
 */
export async function getErrorLogs(limit = 50) {
  try {
    const reachable = await isSupabaseReachable('rest', 1200)
    if (!reachable) return []
    const { data, error } = await supabase
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting error logs:', error)
    return []
  }
}
