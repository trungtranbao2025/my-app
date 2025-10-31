import React, { useMemo, useState } from 'react'

/**
 * Advanced Pagination Component
 * Props:
 * - total: number (required) total items
 * - page: number (1-based)
 * - pageSize: number
 * - onChange: ({ page, pageSize }) => void
 * - pageSizeOptions?: number[] default [10,25,50,100]
 * - className?: string
 */
export default function Pagination({ total = 0, page = 1, pageSize = 25, onChange, pageSizeOptions = [10,25,50,100], className = '' }) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 1)))
  const current = Math.min(Math.max(1, page), totalPages)
  const [goto, setGoto] = useState('')

  const start = total === 0 ? 0 : (current - 1) * pageSize + 1
  const end = Math.min(current * pageSize, total)

  const pages = useMemo(() => {
    // Sliding window of pages
    const windowSize = 5
    let startP = Math.max(1, current - Math.floor(windowSize / 2))
    let endP = Math.min(totalPages, startP + windowSize - 1)
    startP = Math.max(1, Math.min(startP, endP - windowSize + 1))
    const arr = []
    for (let p = startP; p <= endP; p++) arr.push(p)
    return arr
  }, [current, totalPages])

  const setPage = (p) => onChange?.({ page: Math.min(Math.max(1, p), totalPages), pageSize })
  const setPageSize = (s) => onChange?.({ page: 1, pageSize: s })

  const go = () => {
    const n = parseInt(goto)
    if (!Number.isFinite(n)) return
    setPage(n)
    setGoto('')
  }

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${className}`}>
      <div className="text-sm text-gray-600">
        Hiển thị {start}-{end} / {total}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-600">Trang:</span>
          <button className="btn-secondary px-2 py-1" onClick={() => setPage(1)} disabled={current === 1} title="Đầu">«</button>
          <button className="btn-secondary px-2 py-1" onClick={() => setPage(current - 1)} disabled={current === 1} title="Trước">‹</button>
          <div className="hidden sm:flex items-center gap-1">
            {pages[0] > 1 && <span className="px-2 text-gray-500">…</span>}
            {pages.map(p => (
              <button key={p} className={`px-3 py-1 rounded border ${p === current ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white hover:bg-gray-50 border-gray-200'}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            {pages[pages.length-1] < totalPages && <span className="px-2 text-gray-500">…</span>}
          </div>
          <button className="btn-secondary px-2 py-1" onClick={() => setPage(current + 1)} disabled={current === totalPages} title="Sau">›</button>
          <button className="btn-secondary px-2 py-1" onClick={() => setPage(totalPages)} disabled={current === totalPages} title="Cuối">»</button>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={goto}
            onChange={(e)=>setGoto(e.target.value.replace(/[^0-9]/g,''))}
            onKeyDown={(e)=>{ if(e.key==='Enter') go() }}
            placeholder="#"
            className="w-16 input py-1"
          />
          <button className="btn-secondary py-1" onClick={go}>Tới</button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-600">/ trang:</span>
          <select value={pageSize} onChange={(e)=>setPageSize(parseInt(e.target.value))} className="input py-1">
            {pageSizeOptions.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
