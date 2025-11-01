import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import supabaseLib from '../../lib/supabase'

const { supabase } = supabaseLib
import toast from 'react-hot-toast'

/**
 * Wizard: Tải PDF chung -> xem trước -> chọn trang -> nhập metadata -> Tạo set + tạo bản vẽ
 * - B1: Chọn file PDF (local)
 * - B2: Xem trước các trang (thumbnail), chọn trang cần tạo bản vẽ
 * - B3: Nhập metadata cho mỗi trang: name (bắt buộc), title, area, category
 * - B4: Upload PDF lên Storage, tạo set, up thumbnail (tùy chọn), gọi RPC bulk_add_drawings_from_set
 *
 * Props:
 * @param {string} projectId - ID dự án
 * @param {(created:{setId:string, inserted:number})=>void} [onCreated] - callback khi tạo xong
 */
export default function DrawingsFromPdfWizard({ projectId, onCreated }) {
  const [file, setFile] = useState(null)
  const [pdf, setPdf] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [pageMetas, setPageMetas] = useState({}) // pageNo -> {checked, name, title, area, category, thumbUrl}
  const [busy, setBusy] = useState(false)
  const [pdfTitle, setPdfTitle] = useState('Bản vẽ thi công (tập PDF chung)')
  const [pdfDesc, setPdfDesc] = useState('')

  // Setup worker for Vite
  useEffect(() => {
    try { pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl } catch {}
  }, [])

  // Load local PDF for preview
  useEffect(() => {
    let revoke
    const load = async () => {
      setPdf(null)
      setNumPages(0)
      setPageMetas({})
      if (!file) return
      try {
        const url = URL.createObjectURL(file)
        revoke = () => URL.revokeObjectURL(url)
        const doc = await pdfjsLib.getDocument({ url }).promise
        setPdf(doc)
        setNumPages(doc.numPages || 0)
        // init pageMetas
        setPageMetas(prev => {
          const next = { ...prev }
          for (let i=1;i<=doc.numPages;i++) {
            if (!next[i]) next[i] = { checked: false, name: '', title: '', area: '', category: '', thumbUrl: null }
          }
          return next
        })
      } catch (e) {
        console.error(e)
        toast.error('Không đọc được PDF. Vui lòng thử file khác.')
      }
    }
    load()
    return () => { try { revoke && revoke() } catch {} }
  }, [file])

  const setMeta = (page, patch) => {
    setPageMetas(m => ({ ...m, [page]: { ...(m[page]||{}), ...patch } }))
  }

  const selectedPages = useMemo(() => Object.entries(pageMetas).filter(([k,v]) => v?.checked).map(([k]) => Number(k)).sort((a,b)=>a-b), [pageMetas])

  const renderPageThumb = async (pageNo, scale=0.3) => {
    if (!pdf) return null
    const page = await pdf.getPage(pageNo)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d', { alpha: false })
    await page.render({ canvasContext: ctx, viewport, intent: 'display' }).promise
    return canvas
  }

  const uploadThumb = async (setId, pageNo, canvas) => {
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.9))
    const path = `${projectId}/${setId}/thumbs/page-${String(pageNo).padStart(3,'0')}.png`
    const { error } = await supabase.storage.from('project-drawings').upload(path, blob, {
      contentType: 'image/png', upsert: true
    })
    if (error) return null
    const { data } = supabase.storage.from('project-drawings').getPublicUrl(path)
    return data?.publicUrl || null
  }

  const handleSubmit = async () => {
    if (!projectId) return toast.error('Thiếu projectId')
    if (!file) return toast.error('Chưa chọn file PDF')
    if (!selectedPages.length) return toast.error('Chưa chọn trang bản vẽ')
    setBusy(true)
    try {
      // 1) Upload PDF
      const rand = crypto.randomUUID()
      const safeName = file.name.replace(/[^a-zA-Z0-9_.-]+/g, '_')
      const pdfPath = `${projectId}/${rand}/${safeName}`
      const { error: upErr } = await supabase.storage.from('project-drawings').upload(pdfPath, file, {
        cacheControl: '3600', upsert: false, contentType: 'application/pdf'
      })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('project-drawings').getPublicUrl(pdfPath)
      const pdfUrl = pub?.publicUrl

      // 2) Tạo set
      const { data: setId, error: setErr } = await supabase.rpc('create_project_drawing_set', {
        p_project_id: projectId,
        p_title: pdfTitle?.trim() || file.name,
        p_description: (pdfDesc||'').trim() || null,
        p_pdf_url: pdfUrl,
        p_file_name: file.name,
        p_file_size: file.size,
        p_page_count: numPages || null,
      })
      if (setErr) throw setErr

      // 3) Tạo thumbnail (tùy chọn) + gom payload
      const rows = []
      for (const pageNo of selectedPages) {
        let thumbUrl = null
        try {
          const canvas = await renderPageThumb(pageNo, 0.5)
          if (canvas) thumbUrl = await uploadThumb(setId, pageNo, canvas)
        } catch {}
        const meta = pageMetas[pageNo] || {}
        rows.push({
          page_number: pageNo,
          name: String(meta.name||'').trim(),
          title: String(meta.title||'').trim() || null,
          area: String(meta.area||'').trim() || null,
          category: String(meta.category||'').trim() || null,
          thumb_url: thumbUrl || null,
        })
      }

      // 4) Bulk insert
      const { data: inserted, error: insErr } = await supabase.rpc('bulk_add_drawings_from_set', {
        p_set_id: setId,
        p_drawings: rows,
      })
      if (insErr) throw insErr

      toast.success(`Đã tạo ${inserted||rows.length} bản vẽ từ PDF`)      
      onCreated && onCreated({ setId, inserted: inserted || rows.length })
      // reset
      setFile(null); setPdf(null); setNumPages(0); setPageMetas({})
    } catch (e) {
      console.error(e)
      toast.error(e?.message || 'Lỗi tạo bản vẽ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 bg-white">
        <h2 className="text-lg font-semibold mb-3">Tải PDF bản vẽ chung</h2>
        <div className="flex items-center gap-3">
          <input type="file" accept="application/pdf" onChange={e=>setFile(e.target.files?.[0]||null)} />
          {file && (
            <span className="text-sm text-gray-600">{file.name} ({Math.round(file.size/1024/1024*10)/10} MB)</span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <label className="text-sm">Tiêu đề tập PDF
            <input className="mt-1 w-full border rounded p-2" value={pdfTitle} onChange={e=>setPdfTitle(e.target.value)} />
          </label>
          <label className="text-sm">Mô tả (tùy chọn)
            <input className="mt-1 w-full border rounded p-2" value={pdfDesc} onChange={e=>setPdfDesc(e.target.value)} />
          </label>
        </div>
      </div>

      {pdf && (
        <div className="rounded-lg border p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Chọn trang và nhập thông tin (Tổng số trang: {numPages})</h3>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-sm border rounded" onClick={()=>{
                setPageMetas(m=>{ const n={...m}; Object.keys(n).forEach(k=>n[k].checked=true); return n })
              }}>Chọn tất cả</button>
              <button className="px-3 py-1 text-sm border rounded" onClick={()=>{
                setPageMetas(m=>{ const n={...m}; Object.keys(n).forEach(k=>n[k].checked=false); return n })
              }}>Bỏ chọn</button>
            </div>
          </div>
          <PageGrid pdf={pdf} pageMetas={pageMetas} setMeta={setMeta} />
        </div>
      )}

      <div className="flex justify-end">
        <button
          disabled={busy || !file || !selectedPages.length}
          onClick={handleSubmit}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >{busy ? 'Đang tạo…' : 'Tạo bản vẽ từ PDF đã chọn'}</button>
      </div>
    </div>
  )
}

/** @param {{ pdf:any, pageMetas:Record<number, any>, setMeta:(page:number,patch:any)=>void }} props */
function PageGrid({ pdf, pageMetas, setMeta }) {
  const [thumbs, setThumbs] = useState({}) // pageNo -> dataUrl
  const queueRef = useRef([])
  const pendingRef = useRef(false)

  // lazy render queue to avoid blocking UI
  useEffect(() => {
    let cancelled = false
    const pushAll = async () => {
      if (!pdf) return
      const num = pdf.numPages || 0
      const q = []
      for (let i=1;i<=num;i++) q.push(i)
      queueRef.current = q
      if (!pendingRef.current) run()
    }
    const run = async () => {
      if (pendingRef.current) return
      pendingRef.current = true
      while (queueRef.current.length && !cancelled) {
        const pageNo = queueRef.current.shift()
        try {
          const page = await pdf.getPage(pageNo)
          const viewport = page.getViewport({ scale: 0.25 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d', { alpha: false })
          await page.render({ canvasContext: ctx, viewport, intent: 'display' }).promise
          const url = canvas.toDataURL('image/png')
          setThumbs(t => ({ ...t, [pageNo]: url }))
        } catch {}
      }
      pendingRef.current = false
    }
    pushAll()
    return () => { cancelled = true }
  }, [pdf])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Object.keys(pageMetas).map(k => {
        const pageNo = Number(k)
        const meta = pageMetas[pageNo]
        return (
          <div key={k} className={`border rounded overflow-hidden ${meta.checked ? 'ring-2 ring-blue-500' : ''}`}>
            <div className="relative bg-gray-50">
              {thumbs[pageNo]
                ? <img src={thumbs[pageNo]} alt={`Trang ${pageNo}`} className="w-full block" />
                : <div className="h-48 flex items-center justify-center text-gray-400">Đang dựng ảnh…</div>}
              <label className="absolute top-2 left-2 bg-white/90 px-2 py-1 rounded shadow text-sm flex items-center gap-2">
                <input type="checkbox" checked={!!meta.checked} onChange={e=>setMeta(pageNo, { checked: e.target.checked })} />
                <span>Trang {pageNo}</span>
              </label>
            </div>
            <div className="p-3 grid grid-cols-1 gap-2 text-sm">
              <label>Mã hiệu (bắt buộc)
                <input value={meta.name} onChange={e=>setMeta(pageNo,{ name:e.target.value })} className="mt-1 w-full border rounded p-2" />
              </label>
              <label>Tiêu đề
                <input value={meta.title} onChange={e=>setMeta(pageNo,{ title:e.target.value })} className="mt-1 w-full border rounded p-2" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label>Khu vực
                  <input value={meta.area} onChange={e=>setMeta(pageNo,{ area:e.target.value })} className="mt-1 w-full border rounded p-2" />
                </label>
                <label>Hạng mục
                  <input value={meta.category} onChange={e=>setMeta(pageNo,{ category:e.target.value })} className="mt-1 w-full border rounded p-2" />
                </label>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
