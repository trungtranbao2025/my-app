import React, { useEffect, useState, useRef } from 'react'
// Use namespace import to avoid named-export bundling issues on mobile (Capacitor)
import * as versionControl from '../utils/versionControl'
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

/**
 * Component kiểm tra và thông báo cập nhật phiên bản
 */
const UpdateChecker = () => {
  const [updateInfo, setUpdateInfo] = useState(null)
  const [showBanner, setShowBanner] = useState(false)
  const [checking, setChecking] = useState(false)
  const forceToastShownRef = useRef(false)

  // Local bypass for force update (per-version)
  const BYPASS_KEY = 'force_update_bypass_version'
  const isBypassed = (version) => {
    try { return localStorage.getItem(BYPASS_KEY) === version } catch { return false }
  }
  const enableBypass = (version) => {
    try { localStorage.setItem(BYPASS_KEY, version) } catch {}
  }
  const clearBypass = () => {
    try { localStorage.removeItem(BYPASS_KEY) } catch {}
  }

  useEffect(() => {
    // Kiểm tra ngay khi mount
  checkUpdate()

    // Kiểm tra định kỳ mỗi 30 phút
    const interval = setInterval(() => {
      checkUpdate()
    }, 30 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const checkUpdate = async () => {
    try {
      setChecking(true)
  const info = await versionControl.checkForUpdates()

      if (info?.hasUpdate) {
        // Respect local bypass for this version (turn mandatory into optional)
        const bypassed = isBypassed(info.latestVersion)
        const effectiveInfo = bypassed ? { ...info, forceUpdate: false } : info
        setUpdateInfo(effectiveInfo)
        setShowBanner(true)
        
        // Nếu bắt buộc cập nhật, hiện thông báo không thể đóng
        if (effectiveInfo.forceUpdate && !forceToastShownRef.current) {
          // Chặn hiển thị trùng lặp (ví dụ check lại theo chu kỳ)
          forceToastShownRef.current = true
          toast((t) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <ArrowPathIcon className="h-5 w-5 text-blue-600" />
                <span className="font-semibold">Cập nhật bắt buộc!</span>
              </div>
              <p className="text-sm text-gray-600">
                Phiên bản {effectiveInfo.latestVersion} có sẵn. Vui lòng cập nhật để tiếp tục sử dụng.
              </p>
              <button
                onClick={() => {
                  toast.dismiss(t.id)
                  handleUpdate()
                }}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Cập nhật ngay
              </button>
              <button
                onClick={() => {
                  enableBypass(effectiveInfo.latestVersion)
                  setUpdateInfo((prev) => prev ? { ...prev, forceUpdate: false } : prev)
                  toast.dismiss(t.id)
                  toast.success('Đã tắt yêu cầu cập nhật cho phiên bản này. Bạn vẫn có thể cập nhật thủ công.')
                }}
                className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-100 transition-colors"
              >
                Tắt yêu cầu cập nhật
              </button>
            </div>
          ), {
            duration: Infinity,
            position: 'top-center'
          })
        }
      }
    } catch (error) {
      console.error('Error checking for updates:', error)
    } finally {
      setChecking(false)
    }
  }

  const handleUpdate = () => {
    toast.loading('Đang cập nhật...', { duration: 2000 })
    setTimeout(() => {
      // Khi người dùng chọn cập nhật, tự động bỏ bypass nếu trước đó đã tắt bắt buộc
      clearBypass()
  versionControl.reloadApp()
    }, 2000)
  }

  const handleDismiss = () => {
    if (!updateInfo?.forceUpdate) {
      setShowBanner(false)
      // Nhắc lại sau 1 giờ
      setTimeout(() => {
        setShowBanner(true)
      }, 60 * 60 * 1000)
    }
  }

  if (!showBanner || !updateInfo?.hasUpdate) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <ArrowPathIcon className="h-6 w-6 flex-shrink-0 animate-spin" />
            <div className="flex-1">
              <p className="font-semibold">
                Phiên bản mới {updateInfo.latestVersion} có sẵn!
                {updateInfo.forceUpdate && <span className="ml-2 text-yellow-300">(Bắt buộc)</span>}
              </p>
              <p className="text-sm text-blue-100 mt-1">
                Phiên bản hiện tại: {versionControl.CURRENT_VERSION}
              </p>
              {updateInfo.releaseNotes && (
                <p className="text-sm text-blue-100 mt-1">
                  {updateInfo.releaseNotes}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleUpdate}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Cập nhật ngay
            </button>
            {updateInfo.forceUpdate && (
              <button
                onClick={() => {
                  enableBypass(updateInfo.latestVersion)
                  setUpdateInfo((prev) => prev ? { ...prev, forceUpdate: false } : prev)
                  toast.success('Đã tắt yêu cầu cập nhật cho phiên bản này. Bạn vẫn có thể cập nhật thủ công.')
                }}
                className="px-3 py-2 bg-blue-600/10 text-white/90 border border-white/20 rounded-lg font-medium hover:bg-blue-600/20 transition-colors"
                title="Tắt bắt buộc cập nhật cho phiên bản này"
              >
                Tắt yêu cầu cập nhật
              </button>
            )}
            
            {!updateInfo.forceUpdate && (
              <button
                onClick={handleDismiss}
                className="p-2 hover:bg-blue-600 rounded-lg transition-colors"
                title="Nhắc lại sau"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UpdateChecker
