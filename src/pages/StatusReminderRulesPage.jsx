import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'

const STATUS_OPTIONS = ['pending', 'in_progress', 'upcoming', 'overdue']
const PRIORITY_OPTIONS = ['low', 'medium', 'high']
const START_MODE_OPTIONS = ['on_create', 'on_upcoming', 'on_overdue']
const INTERVAL_UNIT_OPTIONS = ['hours', 'days', 'weeks', 'months', 'quarters', 'years']

function RuleModal({ rule, onClose, onSave }) {
  const [formData, setFormData] = useState({
    status: 'pending',
    priority: null,
    start_mode: 'on_create',
    repeat_interval_unit: 'days',
    repeat_interval_value: 1,
    active: true,
    ...rule,
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const saveData = {
        ...formData,
        priority: formData.priority === 'all' ? null : formData.priority,
        repeat_interval_value: parseInt(formData.repeat_interval_value, 10)
    }
    onSave(saveData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{rule?.id ? 'Chỉnh sửa luật' : 'Tạo luật mới'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Trạng thái</label>
              <select name="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mức độ ưu tiên (để trống cho tất cả)</label>
              <select name="priority" value={formData.priority || 'all'} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                <option value="all">Tất cả</option>
                {PRIORITY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bắt đầu nhắc</label>
              <select name="start_mode" value={formData.start_mode} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                {START_MODE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Lặp lại mỗi</label>
                    <input type="number" name="repeat_interval_value" value={formData.repeat_interval_value} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" min="1"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Đơn vị</label>
                     <select name="repeat_interval_unit" value={formData.repeat_interval_unit} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                        {INTERVAL_UNIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
            </div>
             <div>
                <label className="flex items-center">
                    <input type="checkbox" name="active" checked={formData.active} onChange={handleChange} className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500" />
                    <span className="ml-2 text-sm text-gray-900">Hoạt động</span>
                </label>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Lưu</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function StatusReminderRulesPage() {
  const { user, profile } = useAuth()
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedRule, setSelectedRule] = useState(null)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('status_reminder_rules').select('*').order('status').order('priority')
    if (error) {
      toast.error('Lỗi khi tải luật nhắc việc: ' + error.message)
    } else {
      setRules(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const handleSave = async (ruleData) => {
    const { id, ...updateData } = ruleData
    let error

    if (id) {
      // Update
      ({ error } = await supabase.from('status_reminder_rules').update(updateData).eq('id', id))
    } else {
      // Create
      ({ error } = await supabase.from('status_reminder_rules').insert(updateData))
    }

    if (error) {
      toast.error('Lỗi khi lưu: ' + error.message)
    } else {
      toast.success('Đã lưu luật thành công!')
      fetchRules()
      setIsModalOpen(false)
      setSelectedRule(null)
    }
  }

  const handleDelete = async (ruleId) => {
    if (window.confirm('Bạn có chắc muốn xóa luật này?')) {
      const { error } = await supabase.from('status_reminder_rules').delete().eq('id', ruleId)
      if (error) {
        toast.error('Lỗi khi xóa: ' + error.message)
      } else {
        toast.success('Đã xóa luật.')
        fetchRules()
      }
    }
  }

  const openModal = (rule = null) => {
    setSelectedRule(rule)
    setIsModalOpen(true)
  }

  if (profile?.role !== 'manager' && profile?.role !== 'admin') {
    return <div className="p-4">Bạn không có quyền truy cập trang này.</div>
  }

  if (loading) {
    return <div className="p-4">Đang tải...</div>
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý luật nhắc việc tự động</h1>
        <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          <PlusIcon className="w-5 h-5" />
          Tạo luật mới
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 [&>thead>tr>th]:text-center [&>thead>tr>th]:align-middle [&>tbody>tr>td]:align-middle [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ưu tiên</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Bắt đầu</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tần suất lặp lại</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rules.map(rule => (
                <tr key={rule.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{rule.status}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rule.priority || 'Tất cả'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rule.start_mode}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{`Mỗi ${rule.repeat_interval_value} ${rule.repeat_interval_unit}`}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${rule.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {rule.active ? 'Hoạt động' : 'Tắt'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openModal(rule)} className="text-indigo-600 hover:text-indigo-900 mr-4"><PencilIcon className="w-5 h-5"/></button>
                    <button onClick={() => handleDelete(rule.id)} className="text-red-600 hover:text-red-900"><TrashIcon className="w-5 h-5"/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && <RuleModal rule={selectedRule} onClose={() => { setIsModalOpen(false); setSelectedRule(null); }} onSave={handleSave} />}
    </div>
  )
}
