import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import supabaseLib from '../lib/supabase'

const { supabase } = supabaseLib
import toast from 'react-hot-toast'
import { 
  BellIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/LoadingSpinner'

const ReminderSettingsPage = () => {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingSetting, setEditingSetting] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: '',
    status: '',
    task_type: '',
    before_due_hours: '24',
    overdue_hours: '24',
    recurring_before_hours: '24',
    is_active: true
  })

  useEffect(() => {
    if (profile?.role === 'manager') {
      loadSettings()
    }
  }, [profile])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('reminder_settings')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSettings(data || [])
    } catch (error) {
      console.error('Error loading reminder settings:', error)
      toast.error('Không thể tải cài đặt nhắc việc')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name) {
      toast.error('Vui lòng nhập tên cài đặt')
      return
    }

    try {
      setSaving(true)

      // Build reminder_config JSON
      const reminderConfig = {
        before_due_hours: formData.before_due_hours.split(',').map(h => parseInt(h.trim())).filter(h => h > 0),
        overdue_hours: formData.overdue_hours.split(',').map(h => parseInt(h.trim())).filter(h => h > 0)
      }

      if (formData.task_type === 'recurring' && formData.recurring_before_hours) {
        reminderConfig.recurring_before_hours = formData.recurring_before_hours.split(',').map(h => parseInt(h.trim())).filter(h => h > 0)
      }

      const settingData = {
        name: formData.name,
        description: formData.description || null,
        priority: formData.priority || null,
        status: formData.status || null,
        task_type: formData.task_type || null,
        reminder_config: reminderConfig,
        is_active: formData.is_active
      }

      if (editingSetting) {
        const { error } = await supabase
          .from('reminder_settings')
          .update(settingData)
          .eq('id', editingSetting.id)

        if (error) throw error
        toast.success('Cập nhật cài đặt thành công!')
      } else {
        const { error } = await supabase
          .from('reminder_settings')
          .insert(settingData)

        if (error) throw error
        toast.success('Tạo cài đặt mới thành công!')
      }

      handleCloseModal()
      loadSettings()
    } catch (error) {
      console.error('Error saving reminder setting:', error)
      toast.error('Lỗi lưu cài đặt: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (setting) => {
    setEditingSetting(setting)
    setFormData({
      name: setting.name,
      description: setting.description || '',
      priority: setting.priority || '',
      status: setting.status || '',
      task_type: setting.task_type || '',
      before_due_hours: setting.reminder_config?.before_due_hours?.join(', ') || '24',
      overdue_hours: setting.reminder_config?.overdue_hours?.join(', ') || '24',
      recurring_before_hours: setting.reminder_config?.recurring_before_hours?.join(', ') || '24',
      is_active: setting.is_active
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa cài đặt này?')) return

    try {
      const { error } = await supabase
        .from('reminder_settings')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Xóa cài đặt thành công!')
      loadSettings()
    } catch (error) {
      console.error('Error deleting reminder setting:', error)
      toast.error('Lỗi xóa cài đặt: ' + error.message)
    }
  }

  const handleToggleActive = async (setting) => {
    try {
      const { error } = await supabase
        .from('reminder_settings')
        .update({ is_active: !setting.is_active })
        .eq('id', setting.id)

      if (error) throw error
      toast.success(setting.is_active ? 'Đã tắt cài đặt' : 'Đã bật cài đặt')
      loadSettings()
    } catch (error) {
      console.error('Error toggling active:', error)
      toast.error('Lỗi: ' + error.message)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingSetting(null)
    setFormData({
      name: '',
      description: '',
      priority: '',
      status: '',
      task_type: '',
      before_due_hours: '24',
      overdue_hours: '24',
      recurring_before_hours: '24',
      is_active: true
    })
  }

  if (profile?.role !== 'manager') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Không có quyền truy cập</h2>
          <p className="text-gray-600">Chỉ Quản lý mới có thể cấu hình nhắc việc</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cài đặt nhắc việc</h1>
          <p className="text-gray-600">Quản lý tần suất và thời gian nhắc việc theo loại, cấp độ và trạng thái</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Thêm cài đặt mới
        </button>
      </div>

      {/* Settings List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {settings.map(setting => (
          <div
            key={setting.id}
            className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
              setting.is_active ? 'border-green-500' : 'border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${setting.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <BellIcon className={`h-6 w-6 ${setting.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{setting.name}</h3>
                  {setting.description && (
                    <p className="text-sm text-gray-600">{setting.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(setting)}
                  className={`text-sm px-3 py-1 rounded ${
                    setting.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {setting.is_active ? 'Bật' : 'Tắt'}
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {setting.priority && (
                <div className="text-sm">
                  <span className="font-medium">Ưu tiên:</span>{' '}
                  <span className="text-gray-700">
                    {setting.priority === 'high' ? 'Cao' :
                     setting.priority === 'medium' ? 'Trung bình' :
                     setting.priority === 'low' ? 'Thấp' : setting.priority}
                  </span>
                </div>
              )}
              {setting.task_type && (
                <div className="text-sm">
                  <span className="font-medium">Loại:</span>{' '}
                  <span className="text-gray-700">
                    {setting.task_type === 'recurring' ? 'Định kỳ' : 'Đột xuất'}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="text-xs text-gray-600 space-y-1">
                <div>
                  <ClockIcon className="inline w-4 h-4 mr-1" />
                  <strong>Trước deadline:</strong>{' '}
                  {setting.reminder_config?.before_due_hours?.join(', ') || 'N/A'} giờ
                </div>
                <div>
                  <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                  <strong>Quá hạn:</strong>{' '}
                  {setting.reminder_config?.overdue_hours?.join(', ') || 'N/A'} giờ
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => handleEdit(setting)}
                className="text-blue-600 hover:text-blue-800 p-2"
                title="Sửa"
              >
                <PencilIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleDelete(setting.id)}
                className="text-red-600 hover:text-red-800 p-2"
                title="Xóa"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}

        {settings.length === 0 && (
          <div className="col-span-2 text-center py-12 bg-gray-50 rounded-lg">
            <BellIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Chưa có cài đặt nhắc việc nào</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 btn-primary"
            >
              Tạo cài đặt đầu tiên
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {editingSetting ? 'Sửa cài đặt nhắc việc' : 'Thêm cài đặt nhắc việc'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Tên cài đặt *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    placeholder="Ví dụ: Nhắc việc ưu tiên cao"
                    required
                  />
                </div>

                <div>
                  <label className="label">Mô tả</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    rows="2"
                    placeholder="Mô tả mục đích sử dụng cài đặt này"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Ưu tiên</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="input"
                    >
                      <option value="">Tất cả</option>
                      <option value="high">Cao</option>
                      <option value="medium">Trung bình</option>
                      <option value="low">Thấp</option>
                      <option value="urgent">Khẩn cấp</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Trạng thái</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="input"
                    >
                      <option value="">Tất cả</option>
                      <option value="not_started">Chưa bắt đầu</option>
                      <option value="in_progress">Đang thực hiện</option>
                      <option value="pending">Chờ xử lý</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Loại công việc</label>
                    <select
                      value={formData.task_type}
                      onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
                      className="input"
                    >
                      <option value="">Tất cả</option>
                      <option value="one_time">Đột xuất</option>
                      <option value="recurring">Định kỳ</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Nhắc trước deadline (giờ) *</label>
                  <input
                    type="text"
                    value={formData.before_due_hours}
                    onChange={(e) => setFormData({ ...formData, before_due_hours: e.target.value })}
                    className="input"
                    placeholder="Ví dụ: 24, 48, 72"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Nhập các số giờ cách nhau bởi dấu phẩy. Ví dụ: 24, 48 sẽ nhắc trước 24h và 48h
                  </p>
                </div>

                <div>
                  <label className="label">Nhắc khi quá hạn (giờ) *</label>
                  <input
                    type="text"
                    value={formData.overdue_hours}
                    onChange={(e) => setFormData({ ...formData, overdue_hours: e.target.value })}
                    className="input"
                    placeholder="Ví dụ: 1, 24, 72"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Nhắc lại sau khi đã quá hạn. Ví dụ: 1, 24 sẽ nhắc sau 1h và 24h
                  </p>
                </div>

                {formData.task_type === 'recurring' && (
                  <div>
                    <label className="label">Nhắc công việc định kỳ (giờ trước)</label>
                    <input
                      type="text"
                      value={formData.recurring_before_hours}
                      onChange={(e) => setFormData({ ...formData, recurring_before_hours: e.target.value })}
                      className="input"
                      placeholder="Ví dụ: 24"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Nhắc trước khi tạo công việc định kỳ mới
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">
                    Kích hoạt cài đặt này
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="btn-secondary"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary"
                  >
                    {saving ? 'Đang lưu...' : (editingSetting ? 'Cập nhật' : 'Tạo mới')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReminderSettingsPage
