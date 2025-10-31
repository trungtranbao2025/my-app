import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { PDFDocument } from 'pdf-lib'
import toast from 'react-hot-toast'
import { projectDocsApi } from '../../lib/api'
import { PaperClipIcon, ScissorsIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline'

/**
 * Tải PDF nhiều bản vẽ -> chọn trang -> nhập Khu vực/Tiêu đề -> Tách mỗi trang thành 1 PDF và tải lên project_documents (category='site_plan')
 *
 * Props:
 * - projectId: string (bắt buộc)
 * - areaOptions?: string[] (gợi ý khu vực lấy từ bảng công việc)
 * - onInserted?: (rows: any[]) => void  // callback khi đã tải xong tất cả trang, trả về danh sách bản ghi mới
 */
export default function SiteDocsFromPdfWizard({ projectId, areaOptions = [], onInserted }) {
  const [file, setFile] = useState(null)
  const [pdf, setPdf] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [pageMetas, setPageMetas] = useState({}) // pageNo -> {checked, area, title}
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try { pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl } catch {}
  }, [])

  // Đọc PDF local để xem trước
  useEffect(() => {
    let revoke
    const load = async () => {
      setPdf(null); setNumPages(0); setPageMetas({})
      if (!file) return
      try {
        const url = URL.createObjectURL(file)
        revoke = () => URL.revokeObjectURL(url)
        const doc = await pdfjsLib.getDocument({ url }).promise
        setPdf(doc)
        setNumPages(doc.numPages || 0)
        setPageMetas(prev => {
          const next = { ...prev }
          for (let i=1;i<=doc.numPages;i++) if (!next[i]) next[i] = { checked: false, area: '', title: '' }
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

  const selectedPages = useMemo(() => Object.entries(pageMetas).filter(([k,v]) => v?.checked).map(([k]) => Number(k)).sort((a,b)=>a-b), [pageMetas])

  const setMeta = (page, patch) => setPageMetas(m => ({ ...m, [page]: { ...(m[page]||{}), ...patch } }))

  const sanitize = (s) => String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-').replace(/^-+|-+$/g, '')

  const buildTitleWithArea = (title, area) => {
    const base = String(title || '').replace(/\s*\[(?:KV|Khu\s*vuc|Khu\s*vực)\s*:\s*[^\]]+\]\s*/i, '').trim()
    return area ? `[KV: ${area}] ${base}` : base
  }

  // Tách 1 trang thành PDF blob
  const extractPageToBlob = async (fileArrayBuffer, pageNumber) => {
    const srcPdf = await PDFDocument.load(fileArrayBuffer)
    const dstPdf = await PDFDocument.create()
    const [copied] = await dstPdf.copyPages(srcPdf, [pageNumber - 1])
    dstPdf.addPage(copied)
    const bytes = await dstPdf.save({ addDefaultPage: false })
    return new Blob([bytes], { type: 'application/pdf' })
  }

  const handleSubmit = async () => {
    if (!projectId) return toast.error('Thiếu projectId')
    if (!file) return toast.error('Chưa chọn file PDF')
    if (!selectedPages.length) return toast.error('Chưa chọn trang bản vẽ')
    setBusy(true)
    try {
      const buf = await file.arrayBuffer()
      const inserted = []
      for (const pageNo of selectedPages) {
        const meta = pageMetas[pageNo] || {}
        const blob = await extractPageToBlob(buf, pageNo)
        const baseName = file.name.replace(/\.pdf$/i, '')
        const areaPart = meta.area ? `-${sanitize(meta.area)}` : ''
        const titlePart = meta.title ? `-${sanitize(meta.title).slice(0,40)}` : ''
        const newName = `${baseName}-p${String(pageNo).padStart(2,'0')}${areaPart}${titlePart}.pdf`
        const newFile = new File([blob], newName, { type: 'application/pdf' })
        const title = buildTitleWithArea(meta.title || `${baseName} - Trang ${pageNo}`, meta.area)
        try {
          const row = await projectDocsApi.upload(projectId, newFile, { title, category: 'site_plan' })
          inserted.push(row)
        } catch (e) {
          console.error('Upload trang thất bại', e)
          toast.error(`Lỗi tải trang ${pageNo}`)
        }
      }
      if (inserted.length) toast.success(`Đã tạo ${inserted.length} tài liệu từ PDF`)
      onInserted && onInserted(inserted)
      // reset
      setFile(null); setPdf(null); setNumPages(0); setPageMetas({})
    } catch (e) {
      console.error(e)
      toast.error('Lỗi xử lý PDF')
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      {/* Hàng nút thao tác: Chọn file + Tách & tải đặt cùng hàng */}
      <div className="flex items-center gap-3 flex-wrap">
        <input id="wizard-file" type="file" accept="application/pdf" onChange={(e)=>setFile(e.target.files?.[0]||null)} className="sr-only" />
        <label htmlFor="wizard-file" className="btn-secondary inline-flex items-center gap-2 cursor-pointer" title="Chọn PDF chứa nhiều bản vẽ">
          <PaperClipIcon className="h-4 w-4"/> Chọn tệp PDF
        </label>
        {file && <span className="text-sm text-gray-600 truncate" title={file.name}>{file.name} ({Math.round(file.size/1024/1024*10)/10} MB)</span>}

        <button
          disabled={busy || !file || !selectedPages.length}
          onClick={handleSubmit}
          className="btn-primary inline-flex items-center gap-2"
          title="Tách từng trang và tải lên dự án"
        >
          {busy ? (
            'Đang xử lý…'
          ) : (
            <>
              <ScissorsIcon className="h-4 w-4"/>
              <CloudArrowUpIcon className="h-4 w-4"/>
              <span>Tách & tải các trang đã chọn</span>
            </>
          )}
        </button>
      </div>

      {pdf && (
        <PageGrid pdf={pdf} pageMetas={pageMetas} setMeta={setMeta} areaOptions={areaOptions} />
      )}
    </div>
  )
}

function PageGrid({ pdf, pageMetas, setMeta, areaOptions }) {
  const [thumbs, setThumbs] = useState({}) // pageNo -> dataUrl/objectURL
  const revokeRef = useRef([]) // keep created objectURLs to revoke on unmount

  useEffect(() => {
    let cancelled = false
    const MAX_THUMB_WIDTH = 320 // px, keep small for speed
    const CONCURRENCY = 3 // render a few pages in parallel
    const PRIME_FIRST = 6 // render first rows ASAP

    const flushQueue = (buf) => {
      if (!buf.length) return
      setThumbs(prev => {
        const next = { ...prev }
        for (const [no, url] of buf) next[no] = url
        return next
      })
      buf.length = 0
    }

    const renderThumb = async (pageNo) => {
      if (cancelled) return
      try {
        const page = await pdf.getPage(pageNo)
        const base = page.getViewport({ scale: 1 })
        const scale = Math.max(0.1, Math.min(0.6, MAX_THUMB_WIDTH / base.width))
        const viewport = page.getViewport({ scale })

        // Prefer OffscreenCanvas when available for faster toBlob
        let url
        if (typeof OffscreenCanvas !== 'undefined') {
          const canvas = new OffscreenCanvas(viewport.width, viewport.height)
          const ctx = canvas.getContext('2d', { alpha: false })
          await page.render({ canvasContext: ctx, viewport, intent: 'display' }).promise
          const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 })
          url = URL.createObjectURL(blob)
        } else {
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
          await page.render({ canvasContext: ctx, viewport, intent: 'display' }).promise
          if (canvas.toBlob) {
            const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.8))
            url = URL.createObjectURL(blob)
          } else {
            url = canvas.toDataURL('image/png')
          }
        }
        revokeRef.current.push(url)
        return [pageNo, url]
      } catch {
        return null
      }
    }

    const runPool = async () => {
      if (!pdf) return
      const num = pdf.numPages || 0
      const order = []
      // Prioritize first pages for a quick perceived load
      for (let i = 1; i <= Math.min(num, PRIME_FIRST); i++) order.push(i)
      for (let i = PRIME_FIRST + 1; i <= num; i++) order.push(i)

      const buf = []
      let idx = 0

      const worker = async () => {
        while (!cancelled && idx < order.length) {
          const myIndex = idx++
          const pageNo = order[myIndex]
          const pair = await renderThumb(pageNo)
          if (pair) buf.push(pair)
          // batch state updates to reduce renders
          if (buf.length >= 2 || myIndex === order.length - 1) flushQueue(buf)
        }
      }

      const workers = Array.from({ length: Math.min(CONCURRENCY, order.length) }, () => worker())
      await Promise.all(workers)
    }

    runPool()
    return () => {
      cancelled = true
      // cleanup created object URLs
      try { for (const u of revokeRef.current) URL.revokeObjectURL(u) } catch {}
      revokeRef.current = []
    }
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
              <label>Khu vực
                {Array.isArray(areaOptions) && areaOptions.length > 0 ? (
                  <select value={meta.area} onChange={e=>setMeta(pageNo,{ area:e.target.value })} className="mt-1 w-full border rounded p-2">
                    <option value="">-- Chọn --</option>
                    {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                ) : (
                  <input value={meta.area} onChange={e=>setMeta(pageNo,{ area:e.target.value })} className="mt-1 w-full border rounded p-2" />
                )}
              </label>
              <label>Tiêu đề
                <input value={meta.title} onChange={e=>setMeta(pageNo,{ title:e.target.value })} className="mt-1 w-full border rounded p-2" />
              </label>
            </div>
          </div>
        )
      })}
    </div>
  )
}
