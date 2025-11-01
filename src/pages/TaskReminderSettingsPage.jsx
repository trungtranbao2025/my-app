import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import supabaseLib from '../lib/supabase'

const { supabase } = supabaseLib
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { BellIcon, ClockIcon, CalendarIcon, CheckCircleIcon, PlusIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

const TASK_STATUSES = [
  { value: 'in_progress', label: 'Đang thực hiện', icon: '⏳', color: 'blue' },
  { value: 'nearly_due', label: 'Sắp đến hạn', icon: '⚠️', color: 'orange' },
  { value: 'overdue', label: 'Quá hạn', icon: '🔴', color: 'red' }
]

const DAYS_OF_WEEK = [
  { value: 1, label: 'T2', short: '2' },
  { value: 2, label: 'T3', short: '3' },
  { value: 3, label: 'T4', short: '4' },
  { value: 4, label: 'T5', short: '5' },
  { value: 5, label: 'T6', short: '6' },
  { value: 6, label: 'T7', short: '7' },
  { value: 7, label: 'CN', short: 'CN' }
]

const TASK_TYPES = [
  { value: 'one_time', label: 'Công việc đột xuất', icon: '⚡', description: 'Công việc một lần, không lặp lại' },
  { value: 'recurring', label: 'Công việc định kỳ', icon: '🔄', description: 'Công việc lặp lại theo chu kỳ' }
]

function StatusReminderConfig({ status, config, onChange, isRecurring }) {
  const statusInfo = TASK_STATUSES.find(s => s.value === status)
  const [newTime, setNewTime] = useState('09:00')
  const [expanded, setExpanded] = useState(false)
  
  const addSpecificTime = () => {
    if (!config.specific_times.includes(newTime)) {
      onChange({
        ...config,
        specific_times: [...config.specific_times, newTime].sort()
      })
      setNewTime('09:00')
    }
  }

  const removeSpecificTime = (time) => {
    onChange({
      ...config,
      specific_times: config.specific_times.filter(t => t !== time)
    })
  }

  const toggleDayOfWeek = (day) => {
    const days = config.days_of_week || []
    const newDays = days.includes(day)
      ? days.filter(d => d !== day)
      : [...days, day].sort()
    onChange({ ...config, days_of_week: newDays })
  }

  const toggleDayOfMonth = (day) => {
    const days = config.days_of_month || []
    const newDays = days.includes(day)
      ? days.filter(d => d !== day)
      : [...days, day].sort()
    onChange({ ...config, days_of_month: newDays })
  }

  const toggleMonth = (month, type) => {
    const key = type === 'quarter' ? 'months_of_quarter' : 'months_of_year'
    const months = config[key] || []
    const newMonths = months.includes(month)
      ? months.filter(m => m !== month)
      : [...months, month].sort()
    onChange({ ...config, [key]: newMonths })
  }

  // Summary text
  const getSummary = () => {
    if (!config.enabled) return 'Tắt'
    const parts = []
    if (config.specific_times?.length > 0) {
      parts.push(`${config.specific_times.length} giờ cụ thể`)
    }
    if (config.repeat_every_hours > 0) {
      parts.push(`Lặp ${config.repeat_every_hours}h`)
    }
    if (config.repeat_every_days > 1) {
      parts.push(`Mỗi ${config.repeat_every_days} ngày`)
    }
    parts.push(`Max ${config.max_per_day}/ngày`)
    return parts.join(' • ')
  }

  return (
    <div className={`border-2 rounded-lg overflow-hidden transition-all ${
      config.enabled ? `border-${statusInfo.color}-300 bg-${statusInfo.color}-50` : 'border-gray-200 bg-gray-50'
    }`}>
      {/* Header - Always visible */}
      <div 
        className="p-4 cursor-pointer hover:bg-white/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-2xl">{statusInfo.icon}</span>
            <div className="flex-1">
              <h4 className="font-bold text-gray-800">{statusInfo.label}</h4>
              <p className="text-xs text-gray-600">{getSummary()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label 
              className="relative inline-flex items-center cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
            </label>
            {expanded ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && config.enabled && (
        <div className="px-4 pb-4 space-y-4 border-t-2 border-gray-200 pt-4 bg-white">
          {/* Specific Times - Compact */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">⏰ Giờ nhắc</label>
            <div className="flex gap-2 mb-2">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                onClick={addSpecificTime}
                className="px-3 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {config.specific_times?.map(time => (
                <span key={time} className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-100 border border-cyan-300 rounded text-xs font-medium">
                  {time}
                  <button onClick={() => removeSpecificTime(time)} className="text-red-500 hover:text-red-700">
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Compact 3-column grid */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">🔁 Lặp mỗi (giờ)</label>
              <input
                type="number"
                min="0"
                max="24"
                value={config.repeat_every_hours || 0}
                onChange={(e) => onChange({ ...config, repeat_every_hours: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">📊 Max/ngày</label>
              <input
                type="number"
                min="1"
                max="20"
                value={config.max_per_day || 3}
                onChange={(e) => onChange({ ...config, max_per_day: parseInt(e.target.value) || 3 })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">📆 Số ngày lặp lại</label>
              <input
                type="number"
                min="1"
                max="365"
                value={config.repeat_every_days || 1}
                onChange={(e) => onChange({ ...config, repeat_every_days: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Days of Week - Compact */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">📅 Các ngày</label>
            <div className="flex gap-1">
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day.value}
                  onClick={() => toggleDayOfWeek(day.value)}
                  className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                    (config.days_of_week || []).includes(day.value)
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {day.short}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced options - Only for recurring tasks */}
          {isRecurring && (
            <details className="border border-gray-300 rounded-lg">
              <summary className="px-3 py-2 bg-gray-100 cursor-pointer text-sm font-semibold text-gray-700 hover:bg-gray-200">
                ⚙️ Tùy chọn nâng cao (tháng, ngày cụ thể)
              </summary>
              <div className="p-3 space-y-3">
                {/* Days of Month */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">📆 Ngày trong tháng</label>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <button
                        key={day}
                        onClick={() => toggleDayOfMonth(day)}
                        className={`px-1 py-1 rounded text-xs font-medium transition-all ${
                          (config.days_of_month || []).includes(day)
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Months of Quarter */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">📊 Tháng trong quý</label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(month => (
                      <button
                        key={month}
                        onClick={() => toggleMonth(month, 'quarter')}
                        className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                          (config.months_of_quarter || []).includes(month)
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        T{month}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Months of Year */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">🗓️ Tháng trong năm</label>
                  <div className="grid grid-cols-6 gap-1">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <button
                        key={month}
                        onClick={() => toggleMonth(month, 'year')}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                          (config.months_of_year || []).includes(month)
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {month}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function ReminderConfigCard({ taskType, config, onChange }) {
  const taskTypeInfo = TASK_TYPES.find(t => t.value === taskType)
  const isRecurring = taskType === 'recurring'
  const [expandedSection, setExpandedSection] = useState('status') // 'status' | 'quiet' | null
  
  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{taskTypeInfo?.icon}</div>
            <div>
              <h2 className="text-lg font-bold text-white">{taskTypeInfo?.label}</h2>
              <p className="text-xs text-cyan-50">{taskTypeInfo?.description}</p>
            </div>
          </div>
          {/* Master toggle */}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.active}
              onChange={(e) => onChange({ ...config, active: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-white/30 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-white/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
          </label>
        </div>
      </div>

      {config.active && (
        <div className="p-4 space-y-3">
          {/* Status-based configurations - Collapsible */}
          <details open={expandedSection === 'status'} className="border-2 border-gray-200 rounded-lg overflow-hidden">
            <summary className="px-4 py-3 bg-gray-50 cursor-pointer font-semibold text-gray-800 hover:bg-gray-100 transition-colors flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-cyan-600" />
                Cài đặt theo trạng thái
              </span>
              <span className="text-xs text-gray-500">Click để mở/đóng</span>
            </summary>
            <div className="p-3 space-y-3 bg-gray-50">
              {TASK_STATUSES.map(status => (
                <StatusReminderConfig
                  key={status.value}
                  status={status.value}
                  config={config.by_status?.[status.value] || {
                    enabled: false,
                    specific_times: [],
                    repeat_every_hours: 0,
                    repeat_every_days: 1,
                    max_per_day: 3,
                    days_of_week: [1,2,3,4,5],
                    ...(isRecurring && {
                      days_of_month: [],
                      months_of_quarter: [],
                      months_of_year: []
                    })
                  }}
                  onChange={(newStatusConfig) => onChange({
                    ...config,
                    by_status: {
                      ...config.by_status,
                      [status.value]: newStatusConfig
                    }
                  })}
                  isRecurring={isRecurring}
                />
              ))}
            </div>
          </details>

          {/* Quiet Hours - Collapsible */}
          <details className="border-2 border-gray-200 rounded-lg overflow-hidden">
            <summary className="px-4 py-3 bg-gray-50 cursor-pointer font-semibold text-gray-800 hover:bg-gray-100 transition-colors flex items-center justify-between">
              <span className="flex items-center gap-2">
                🌙 Giờ im lặng
              </span>
              <span className="text-xs text-gray-500">
                {config.quiet_hours?.start || '22:00'} - {config.quiet_hours?.end || '07:00'}
              </span>
            </summary>
            <div className="p-4 bg-white">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Từ giờ</label>
                  <input
                    type="time"
                    value={config.quiet_hours?.start || '22:00'}
                    onChange={(e) => onChange({ 
                      ...config, 
                      quiet_hours: { ...config.quiet_hours, start: e.target.value } 
                    })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Đến giờ</label>
                  <input
                    type="time"
                    value={config.quiet_hours?.end || '07:00'}
                    onChange={(e) => onChange({ 
                      ...config, 
                      quiet_hours: { ...config.quiet_hours, end: e.target.value } 
                    })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">💤 Không gửi thông báo trong khoảng thời gian này</p>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

export default function TaskReminderSettingsPage() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const defaultOneTimeConfig = {
    active: true,
    by_status: {
      in_progress: {
        enabled: true,
        specific_times: ['09:00', '15:00'],
        repeat_every_hours: 4,
        max_per_day: 3,
        days_of_week: [1,2,3,4,5]
      },
      nearly_due: {
        enabled: true,
        specific_times: ['08:00', '12:00', '17:00'],
        repeat_every_hours: 2,
        max_per_day: 5,
        days_of_week: [1,2,3,4,5,6,7]
      },
      overdue: {
        enabled: true,
        specific_times: ['08:00', '10:00', '14:00', '16:00'],
        repeat_every_hours: 2,
        max_per_day: 6,
        days_of_week: [1,2,3,4,5,6,7]
      }
    },
    quiet_hours: { start: '22:00', end: '07:00' }
  }
  
  const defaultRecurringConfig = {
    active: true,
    by_status: {
      in_progress: {
        enabled: true,
        specific_times: ['09:00'],
        repeat_every_hours: 0,
        max_per_day: 1,
        days_of_week: [1,2,3,4,5],
        days_of_month: [],
        months_of_quarter: [],
        months_of_year: []
      },
      nearly_due: {
        enabled: true,
        specific_times: ['08:00', '16:00'],
        repeat_every_hours: 0,
        max_per_day: 2,
        days_of_week: [1,2,3,4,5,6,7],
        days_of_month: [],
        months_of_quarter: [],
        months_of_year: []
      },
      overdue: {
        enabled: true,
        specific_times: ['08:00', '12:00', '17:00'],
        repeat_every_hours: 0,
        max_per_day: 3,
        days_of_week: [1,2,3,4,5,6,7],
        days_of_month: [],
        months_of_quarter: [],
        months_of_year: []
      }
    },
    quiet_hours: { start: '22:00', end: '07:00' }
  }
  
  const [oneTimeConfig, setOneTimeConfig] = useState(defaultOneTimeConfig)
  const [recurringConfig, setRecurringConfig] = useState(defaultRecurringConfig)

  const loadSettings = useCallback(async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_reminder_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error
      }

      if (data) {
        if (data.one_time_config) {
          setOneTimeConfig({ ...defaultOneTimeConfig, ...data.one_time_config })
        }
        if (data.recurring_config) {
          setRecurringConfig({ ...defaultRecurringConfig, ...data.recurring_config })
        }
      }
    } catch (error) {
      console.error('Error loading reminder settings:', error)
      toast.error('Không thể tải cài đặt nhắc việc')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        one_time_config: oneTimeConfig,
        recurring_config: recurringConfig,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('user_reminder_preferences')
        .upsert(payload, { onConflict: 'user_id' })

      if (error) throw error

      toast.success('✅ Đã lưu cài đặt nhắc việc thành công!')
    } catch (error) {
      console.error('Error saving reminder settings:', error)
      toast.error('Lỗi khi lưu cài đặt: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  // Chặn truy cập: chỉ Quản lý (manager) được vào trang này
  if (profile && profile.role !== 'manager') {
    return <Navigate to="/dashboard" replace />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải cài đặt...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BellIcon className="w-8 h-8 text-cyan-600" />
            <h1 className="text-3xl font-bold text-gray-800">Cài đặt nhắc việc tự động</h1>
          </div>
          <p className="text-gray-600">
            Tùy chỉnh cách thức và tần suất nhận thông báo nhắc việc cho công việc đột xuất và công việc định kỳ của bạn
          </p>
        </div>

        {/* Configuration Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <ReminderConfigCard
            taskType="one_time"
            config={oneTimeConfig}
            onChange={setOneTimeConfig}
          />
          
          <ReminderConfigCard
            taskType="recurring"
            config={recurringConfig}
            onChange={setRecurringConfig}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <button
            onClick={loadSettings}
            disabled={loading || saving}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Đặt lại
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Đang lưu...
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-5 h-5" />
                Lưu cài đặt
              </>
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
          <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
            💡 Hướng dẫn sử dụng
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span><strong>Giờ nhắc cụ thể:</strong> Thêm các mốc thời gian bạn muốn nhận thông báo (ví dụ: 9:00, 15:00)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span><strong>Lặp lại mỗi X giờ:</strong> Nếu &gt; 0, hệ thống sẽ nhắc định kỳ sau mỗi X giờ trong ngày</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span><strong>Số lần tối đa/ngày:</strong> Giới hạn số lần nhắc để không làm phiền quá nhiều</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span><strong>Các thứ trong tuần:</strong> Chọn những ngày nào trong tuần sẽ nhận thông báo</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span><strong>Công việc định kỳ:</strong> Có thêm tùy chọn lọc theo ngày trong tháng, tháng trong quý/năm</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span><strong>Giờ im lặng:</strong> Không gửi thông báo trong khoảng thời gian này (mặc định 22:00-07:00)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>Cài đặt sẽ áp dụng tự động cho các công việc phù hợp theo trạng thái</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}