import React, { useEffect, useMemo, useState } from 'react'
import supabaseLib from '../../lib/supabase'

const { supabase } = supabaseLib

/**
 * Danh sách bản vẽ với tìm kiếm/lọc
 * Props:
 * @param {string} projectId
 */
export default function DrawingsList({ projectId }) {
  const [q, setQ] = useState('')
  const [area, setArea] = useState('')
  const [category, setCategory] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('list_project_drawings_overview', {
        p_project_id: projectId,
        p_q: q?.trim() || null,
        p_area: area?.trim() || null,
        p_category: category?.trim() || null,
      })
      if (error) throw error
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally { setLoading(false) }
  }

  // Initial load
  useEffect(() => { fetchData() }, [projectId])

  // Auto refresh when filters/search change (debounced)
  useEffect(() => {
    if (!projectId) return
    const t = setTimeout(() => { fetchData() }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, area, category, projectId])

  const areas = useMemo(() => Array.from(new Set(rows.map(r=>r.area).filter(Boolean))).sort(), [rows])
  const categories = useMemo(() => Array.from(new Set(rows.map(r=>r.category).filter(Boolean))).sort(), [rows])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-sm">Tìm kiếm</label>
          <input className="mt-1 border rounded p-2 w-64" value={q} onChange={e=>setQ(e.target.value)} placeholder="Tên, tiêu đề, khu vực, hạng mục…" />
        </div>
        <div>
          <label className="text-sm">Khu vực</label>
          <select className="mt-1 border rounded p-2 w-48" value={area} onChange={e=>setArea(e.target.value)}>
            <option value="">-- Tất cả --</option>
            {areas.map(a=> <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm">Hạng mục</label>
          <select className="mt-1 border rounded p-2 w-48" value={category} onChange={e=>setCategory(e.target.value)}>
            <option value="">-- Tất cả --</option>
            {categories.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={fetchData} className="px-4 py-2 rounded bg-blue-600 text-white">Lọc</button>
          <button onClick={()=>{ setQ(''); setArea(''); setCategory(''); }} className="px-4 py-2 rounded border">Làm mới</button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Đang tải…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(r => (
            <div key={r.id} className="border rounded overflow-hidden bg-white">
              <div className="aspect-video bg-gray-50 flex items-center justify-center overflow-hidden">
                {r.thumb_url
                  ? <img src={r.thumb_url} alt={r.name} className="w-full h-full object-cover" />
                  : <div className="text-gray-400 text-sm">Không có ảnh xem trước</div>}
              </div>
              <div className="p-3 text-sm">
                <div className="font-semibold">{r.name}</div>
                <div className="text-gray-600">{r.title || '—'}</div>
                <div className="mt-1 text-gray-600">Khu vực: {r.area || '—'} · Hạng mục: {r.category || '—'}</div>
                <div className="mt-1">Nguồn: {r.is_derived ? `PDF (${r.source_file_name || '—'}), trang ${r.page_number}` : 'Tải lẻ'}</div>
                <div className="mt-2 flex gap-2">
                  {r.file_url && (
                    <a className="px-3 py-1 border rounded hover:bg-gray-50" href={r.file_url} target="_blank" rel="noreferrer">Mở file</a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
