import React, { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import Tesseract from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { PhotoIcon, DocumentIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

try { pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl } catch {}

/**
 * SelectiveOCRInput
 * - Accepts image or PDF
 * - Renders the first page (PDF) or the image to a canvas
 * - Lets user draw a selection rectangle and OCRs only the selected region
 */
const SelectiveOCRInput = ({ onTextExtracted, className = '', helpText = 'Kéo thả chọn vùng trên ảnh/PDF rồi bấm “Nhận dạng vùng đã chọn”. Kết quả sẽ được trả về cho form.' }) => {
  const fileInputRef = useRef(null)
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selection, setSelection] = useState(null) // { x, y, w, h } in canvas coords
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPoint, setStartPoint] = useState(null)
  const [sourceInfo, setSourceInfo] = useState({ type: null, width: 0, height: 0 })

  const openFilePicker = () => fileInputRef.current?.click()

  const drawImageToCanvas = (img) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Fit to container width (max 900px) while preserving aspect ratio
    const maxWidth = Math.min(containerRef.current?.clientWidth || 900, 900)
    const scale = Math.min(1, maxWidth / img.width)
    const cw = Math.round(img.width * scale)
    const ch = Math.round(img.height * scale)

    canvas.width = cw
    canvas.height = ch
    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(img, 0, 0, cw, ch)
    setSourceInfo({ type: 'image', width: cw, height: ch })
    setSelection(null)
  }

  const drawPdfPageToCanvas = async (file) => {
    const bytes = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: bytes, disableWorker: false }).promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const maxWidth = Math.min(containerRef.current?.clientWidth || 900, 900)
    const scale = Math.min(1.5, maxWidth / viewport.width)
    const scaled = page.getViewport({ scale })

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = Math.ceil(scaled.width)
    canvas.height = Math.ceil(scaled.height)

    await page.render({ canvasContext: ctx, viewport: scaled }).promise
    setSourceInfo({ type: 'pdf', width: canvas.width, height: canvas.height })
    setSelection(null)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      if (file.type === 'application/pdf') {
        await drawPdfPageToCanvas(file)
        toast.success('Đã tải trang đầu của PDF. Hãy chọn vùng để nhận dạng.')
      } else if (file.type.startsWith('image/')) {
        const img = new Image()
        img.onload = () => drawImageToCanvas(img)
        img.onerror = () => toast.error('Không thể đọc ảnh.')
        img.src = URL.createObjectURL(file)
        toast.success('Đã tải ảnh. Hãy chọn vùng để nhận dạng.')
      } else {
        toast.error('Vui lòng chọn ảnh hoặc file PDF')
      }
    } catch (err) {
      console.error(err)
      toast.error('Lỗi khi đọc file: ' + err.message)
    } finally {
      // reset input value so the same file can be reselected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const getCanvasMousePos = (evt) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(evt.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(evt.clientY - rect.top, rect.height))
    // Map to canvas coordinate space (account for CSS scaling)
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    return { x: x * scaleX, y: y * scaleY }
  }

  const onMouseDown = (e) => {
    if (!canvasRef.current) return
    setIsSelecting(true)
    const p = getCanvasMousePos(e)
    setStartPoint(p)
    setSelection({ x: p.x, y: p.y, w: 0, h: 0 })
  }
  const onMouseMove = (e) => {
    if (!isSelecting || !startPoint) return
    const p = getCanvasMousePos(e)
    const x = Math.min(startPoint.x, p.x)
    const y = Math.min(startPoint.y, p.y)
    const w = Math.abs(p.x - startPoint.x)
    const h = Math.abs(p.y - startPoint.y)
    setSelection({ x, y, w, h })
  }
  const onMouseUp = () => setIsSelecting(false)

  const recognizeSelection = async () => {
    if (!selection || selection.w < 8 || selection.h < 8) {
      toast.error('Vui lòng chọn vùng đủ lớn để nhận dạng')
      return
    }
    const { x, y, w, h } = selection

    // Crop selected region to an offscreen canvas
    const srcCanvas = canvasRef.current
    const off = document.createElement('canvas')
    off.width = Math.round(w)
    off.height = Math.round(h)
    const octx = off.getContext('2d')
    octx.drawImage(srcCanvas, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, Math.round(w), Math.round(h))

    try {
      setIsProcessing(true)
      setProgress(0)
      toast.loading('Đang nhận dạng vùng đã chọn...', { id: 'sel-ocr' })
      const result = await Tesseract.recognize(off, 'vie', {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100))
        },
      })
      const text = (result.data.text || '').trim()
      if (!text) {
        toast.error('Không tìm thấy văn bản trong vùng đã chọn', { id: 'sel-ocr' })
        return
      }
      toast.success(`Đã nhận dạng ${text.length} ký tự từ vùng chọn`, { id: 'sel-ocr' })
      onTextExtracted?.(text)
    } catch (err) {
      console.error(err)
      toast.error('Lỗi OCR: ' + err.message, { id: 'sel-ocr' })
    } finally {
      setIsProcessing(false)
      setProgress(0)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isProcessing}
          className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${
            isProcessing ? 'bg-gray-100 text-gray-400 border-gray-300' : 'bg-emerald-50 text-emerald-700 border-emerald-500 hover:bg-emerald-100'
          }`}
        >
          <PhotoIcon className="w-5 h-5" />
          <span>Chọn ảnh / PDF</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={recognizeSelection}
          disabled={isProcessing || !selection}
          className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${
            isProcessing || !selection ? 'bg-gray-100 text-gray-400 border-gray-300' : 'bg-blue-50 text-blue-700 border-blue-500 hover:bg-blue-100'
          }`}
        >
          {isProcessing ? (
            <>
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              <span>Đang nhận dạng {progress}%</span>
            </>
          ) : (
            <>
              <DocumentIcon className="w-5 h-5" />
              <span>Nhận dạng vùng đã chọn</span>
            </>
          )}
        </button>
      </div>

      <div className="text-xs text-gray-500">{helpText}</div>

      <div ref={containerRef} className="relative border rounded-lg overflow-hidden bg-gray-50">
        <canvas
          ref={canvasRef}
          className="w-full h-auto select-none cursor-crosshair"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        />
        {selection && (
          <div
            className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
            style={{
              left: `${(selection.x / (canvasRef.current?.width || 1)) * 100}%`,
              top: `${(selection.y / (canvasRef.current?.height || 1)) * 100}%`,
              width: `${(selection.w / (canvasRef.current?.width || 1)) * 100}%`,
              height: `${(selection.h / (canvasRef.current?.height || 1)) * 100}%`,
            }}
          />
        )}
        {!sourceInfo.type && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
            Chưa có nội dung. Hãy chọn ảnh hoặc PDF để bắt đầu.
          </div>
        )}
      </div>
    </div>
  )
}

export default SelectiveOCRInput
