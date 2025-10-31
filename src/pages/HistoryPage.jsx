import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { historyApi, projectsApi, usersApi } from '../lib/api'
import { formatDateTime } from '../utils/helpers'
import toast from 'react-hot-toast'

const HistoryPage = () => {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [projects, setProjects] = useState([])
  const [filters, setFilters] = useState({ projectId: '', entityType: '', search: '' })
  const [loading, setLoading] = useState(true)
  const [actorMap, setActorMap] = useState({})

  const canView = profile?.role === 'manager' || profile?.role === 'admin'

  useEffect(() => {
    if (!canView) return
    ;(async () => {
      try {
        setLoading(true)
        const [hist, prj] = await Promise.all([
          historyApi.list({ limit: 200 }),
          projectsApi.getAll().catch(() => [])
        ])
        setItems(hist)
        setProjects(prj || [])
        // Fetch actor names for display
        const actorIds = Array.from(new Set((hist || []).map(h => h.actor_id).filter(Boolean)))
        if (actorIds.length) {
          try {
            const nameMap = await usersApi.getNamesByIds(actorIds)
            setActorMap(nameMap || {})
          } catch (e) {
            console.warn('Không thể tải tên người dùng cho lịch sử:', e)
            setActorMap({})
          }
        } else {
          setActorMap({})
        }
      } catch (e) {
        console.error(e)
        toast.error('Không thể tải lịch sử: ' + (e?.message || ''))
      } finally {
        setLoading(false)
      }
    })()
  }, [canView])

  const onApply = async (h) => {
    if (!window.confirm('Khôi phục phiên bản này?')) return
    try {
      const res = await historyApi.apply(h.id, 'manual restore from UI')
      if (res && res.startsWith('OK')) toast.success('Đã khôi phục')
      else toast.error(res || 'Khôi phục thất bại')
      // reload after restore
      const hist = await historyApi.list({ limit: 200 })
      setItems(hist)
    } catch (e) {
      console.error(e)
      toast.error('Lỗi: ' + (e?.message || ''))
    }
  }

  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-800">Lịch sử thay đổi</h1>
        <p className="mt-4 text-gray-600">Chỉ Quản lý hoặc Quản trị viên mới có quyền truy cập.</p>
      </div>
    )
  }

  const getSummary = (h) => {
    const d = h?.data || {}
    let content = ''
    let location = ''
    switch (h.entity_type) {
      case 'tasks':
        content = d.title || '(Không có tiêu đề)'
        location = 'Công việc'
        break
      case 'progress_items':
        content = d.title || '(Không có tiêu đề)'
        location = d.area ? `Tiến độ · ${d.area}` : 'Tiến độ'
        break
      case 'project_documents':
        content = d.title || d.file_name || '(Tài liệu)'
        location = d.category ? `Tài liệu dự án · ${d.category}` : 'Tài liệu dự án'
        break
      case 'task_attachments':
        content = d.file_name || '(Tệp đính kèm)'
        location = d.task_id ? `Báo cáo công việc · #${String(d.task_id).slice(0,8)}` : 'Báo cáo công việc'
        break
      default:
        content = d.title || d.name || '(Mục dữ liệu)'
        location = h.entity_type
    }
    return { content, location }
  }

  const filtered = items.filter(h => {
    if (filters.projectId && h.project_id !== filters.projectId) return false
    if (filters.entityType && h.entity_type !== filters.entityType) return false
    if (filters.search) {
      const s = filters.search.toLowerCase()
      const { content, location } = getSummary(h)
      const actorName = actorMap[h.actor_id] || ''
      const hay = [content, location, h.reason || '', actorName].join(' ').toLowerCase()
      if (!hay.includes(s)) return false
    }
    return true
  })

  return (
    <div className="w-full min-h-screen px-2 sm:px-4 lg:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Lịch sử thay đổi</h1>
      </div>

      <div className="card">
        <div className="grid gap-4 grid-autofit-240">
          <select value={filters.projectId} onChange={e => setFilters(f => ({ ...f, projectId: e.target.value || '' }))} className="input">
            <option value="">Tất cả dự án</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
            ))}
          </select>

          <select value={filters.entityType} onChange={e => setFilters(f => ({ ...f, entityType: e.target.value }))} className="input">
            <option value="">Tất cả loại dữ liệu</option>
            <option value="tasks">Công việc</option>
            <option value="progress_items">Tiến độ</option>
            <option value="project_documents">Tài liệu dự án</option>
          </select>

          <input type="text" className="input" placeholder="Tìm kiếm nội dung..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="min-w-full w-full table-auto divide-y divide-cyan-100 border border-gray-200 [&>thead>tr>th]:text-center [&>thead>tr>th]:align-middle [&>tbody>tr>td]:align-middle [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
          <thead className="bg-white/60 backdrop-blur">
            <tr>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Thời gian</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Loại</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Người thao tác</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Bản</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Dự án</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Nội dung</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Vị trí thao tác</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Thao tác</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Khôi phục</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-500">Đang tải...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-500">Không có lịch sử</td></tr>
            ) : (
              filtered.map(h => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{formatDateTime(h.created_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{h.entity_type} · {h.action}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{actorMap[h.actor_id] || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">v{h.version}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{h.project_id ? (projects.find(p => p.id === h.project_id)?.code || '-') : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{getSummary(h).content}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{getSummary(h).location}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{h.reason || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <button className="btn-primary btn-sm" onClick={() => onApply(h)}>Khôi phục</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default HistoryPage
