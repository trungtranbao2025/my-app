import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
// Namespace import to avoid named-export mismatch in mobile bundle
import versionControl from '../utils/versionControl'
import toast from 'react-hot-toast'
import { 
  ArrowPathIcon, 
  BugAntIcon, 
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/LoadingSpinner'
import { getMyPendingRemindersCount, runReminderSchedulerNow } from '../utils/remindersHealth'
import { BellIcon, PlayIcon } from '@heroicons/react/24/outline'

const SystemSettingsPage = () => {
  const { profile, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorLogs, setErrorLogs] = useState([])
  const [showLogs, setShowLogs] = useState(false)
  const [versionData, setVersionData] = useState({
    version: '',
    releaseNotes: '',
    forceUpdate: false
  })
  const [pendingReminders, setPendingReminders] = useState(0)
  const [runningScheduler, setRunningScheduler] = useState(false)

  useEffect(() => {
    if (authLoading) {
      return // Wait for authentication to complete
    }
    if (profile?.role !== 'manager') {
      if (!loading) toast.error('Bạn không có quyền truy cập trang này')
      setLoading(false) // Stop loading as user is not authorized
      return
    }
    loadErrorLogs()
    // Best-effort pending reminders count
    try {
      getMyPendingRemindersCount(profile?.id).then(setPendingReminders).catch(() => {})
    } catch {}
  }, [profile, authLoading])

  const loadErrorLogs = async () => {
    try {
      // No need to set loading here, authLoading handles initial load
  const logs = await versionControl.getErrorLogs(100)
      setErrorLogs(logs)
    } catch (error) {
      console.error('Error loading error logs:', error)
      toast.error('Không thể tải danh sách lỗi')
    } finally {
      setLoading(false) // Stop loading here after logs are fetched
    }
  }

  const handleUpdateVersion = async () => {
    if (!versionData.version) {
      toast.error('Vui lòng nhập số phiên bản')
      return
    }

    // Validate version format (x.y.z)
    const versionRegex = /^\d+\.\d+\.\d+$/
    if (!versionRegex.test(versionData.version)) {
      toast.error('Định dạng phiên bản không hợp lệ. Sử dụng format: x.y.z (ví dụ: 1.0.1)')
      return
    }

    try {
      setSaving(true)
  await versionControl.updateAppVersion(versionData)
      toast.success('Cập nhật phiên bản thành công! Người dùng sẽ được thông báo.')
      setVersionData({ version: '', releaseNotes: '', forceUpdate: false })
    } catch (error) {
      console.error('Error updating version:', error)
      toast.error('Lỗi cập nhật phiên bản: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClearCache = () => {
    if (window.confirm('Xóa cache sẽ làm mới lại ứng dụng. Bạn có chắc chắn?')) {
      clearOldCache()
      toast.success('Đã xóa cache cũ')
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('vi-VN')
  }

  if (authLoading || loading) {
    return <LoadingSpinner message="Đang kiểm tra quyền và tải dữ liệu..." />
  }

  if (profile?.role !== 'manager') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Không có quyền truy cập</h2>
          <p className="text-gray-600">Chỉ Quản lý mới có thể truy cập trang này</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Cài đặt hệ thống</h1>
        <p className="text-gray-600">Quản lý phiên bản và theo dõi lỗi hệ thống</p>
      </div>

  <div className="grid gap-6 grid-autofit-240">
        {/* Reminders health and manual trigger */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <BellIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Nhắc việc</h2>
              <p className="text-sm text-gray-600">Kiểm tra và kích hoạt bộ gửi nhắc việc</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-sm text-gray-700">
                Nhắc việc chờ gửi (tài khoản của bạn):
                <span className="ml-2 font-semibold text-yellow-800">{pendingReminders}</span>
              </div>
              <button
                onClick={async () => {
                  try {
                    const count = await getMyPendingRemindersCount(profile?.id)
                    setPendingReminders(count)
                    toast.success('Đã tải số nhắc việc chờ gửi')
                  } catch {
                    toast.error('Không thể tải số nhắc việc')
                  }
                }}
                className="text-xs px-3 py-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                Làm mới
              </button>
            </div>

            <button
              onClick={async () => {
                setRunningScheduler(true)
                try {
                  const res = await runReminderSchedulerNow()
                  if (res.ok) {
                    toast.success(`Đã chạy bộ gửi (${res.via === 'edge' ? 'Edge Function' : 'SQL'})`)
                    // refresh pending
                    const count = await getMyPendingRemindersCount(profile?.id)
                    setPendingReminders(count)
                  } else {
                    toast.error(res.error || 'Không thể chạy bộ gửi')
                  }
                } catch (e) {
                  toast.error(String(e?.message || e))
                } finally {
                  setRunningScheduler(false)
                }
              }}
              className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={runningScheduler}
            >
              {runningScheduler ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Đang chạy bộ gửi nhắc việc...
                </>
              ) : (
                <>
                  <PlayIcon className="h-5 w-5" />
                  Chạy bộ gửi nhắc việc ngay
                </>
              )}
            </button>

            <p className="text-xs text-gray-500">
              Lưu ý: Hệ thống ưu tiên dùng Edge Function <code>reminder-scheduler</code> nếu đã triển khai và đặt lịch. Nếu chưa, sẽ thử dùng function SQL cũ <code>send_task_reminders()</code> nếu có.
            </p>
          </div>
        </div>

        {/* Cập nhật phiên bản */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ArrowPathIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Cập nhật phiên bản</h2>
              <p className="text-sm text-gray-600">Phiên bản hiện tại: {versionControl.CURRENT_VERSION}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phiên bản mới *
              </label>
              <input
                type="text"
                placeholder="Ví dụ: 1.0.1"
                value={versionData.version}
                onChange={(e) => setVersionData({ ...versionData, version: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Format: major.minor.patch (ví dụ: 1.0.1)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ghi chú cập nhật
              </label>
              <textarea
                placeholder="Mô tả những thay đổi trong phiên bản này..."
                value={versionData.releaseNotes}
                onChange={(e) => setVersionData({ ...versionData, releaseNotes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="forceUpdate"
                checked={versionData.forceUpdate}
                onChange={(e) => setVersionData({ ...versionData, forceUpdate: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="forceUpdate" className="text-sm text-gray-700">
                Bắt buộc cập nhật (người dùng phải cập nhật để tiếp tục)
              </label>
            </div>

            <button
              onClick={handleUpdateVersion}
              disabled={saving || !versionData.version}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Đang cập nhật...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-5 w-5" />
                  Phát hành phiên bản mới
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quản lý Cache */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrashIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Quản lý Cache</h2>
              <p className="text-sm text-gray-600">Xóa dữ liệu tạm để cải thiện hiệu suất</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Lưu ý:</strong> Xóa cache sẽ:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                <li>Xóa dữ liệu tạm thời cũ (&gt; 7 ngày)</li>
                <li>Xóa service worker cache không dùng</li>
                <li>Reload lại ứng dụng</li>
              </ul>
            </div>

            <button
              onClick={handleClearCache}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            >
              <TrashIcon className="h-5 w-5" />
              Xóa cache và làm mới
            </button>
          </div>
        </div>

        {/* Error Logs */}
        <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <BugAntIcon className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Nhật ký lỗi</h2>
                <p className="text-sm text-gray-600">
                  {errorLogs.length} lỗi được ghi nhận
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {showLogs ? 'Ẩn' : 'Hiển thị'}
            </button>
          </div>

          {showLogs && (
            <div className="mt-4">
              {loading ? (
                <LoadingSpinner />
              ) : errorLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircleIcon className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>Không có lỗi nào được ghi nhận</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {errorLogs.map((log, index) => (
                    <div
                      key={log.id || index}
                      className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-semibold text-red-900">
                          {log.error_type}: {log.error_message}
                        </span>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      {log.context && (
                        <div className="text-xs text-gray-600 mt-1">
                          <strong>URL:</strong> {log.context.url || 'N/A'}
                        </div>
                      )}
                      {log.error_stack && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                            Chi tiết lỗi
                          </summary>
                          <pre className="mt-2 text-xs bg-white p-2 rounded border border-red-200 overflow-x-auto">
                            {log.error_stack}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SystemSettingsPage
