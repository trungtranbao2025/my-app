"use client"
import { useEffect, useRef, useState } from 'react'
// Defer pdfjs-dist import to client runtime to avoid SSR issues

export default function PdfCanvas({ pdfUrl, pageIndex, onPicked, colorClass = 'text-sky-600' }: {
  pdfUrl: string
  pageIndex: number
  onPicked: (pts: [{x:number;y:number},{x:number;y:number}]) => void
  colorClass?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [pts, setPts] = useState<{x:number;y:number}[]>([])

  useEffect(() => {
    let canceled = false
    const run = async () => {
      const pdfjsLib: any = await import('pdfjs-dist')
      const pdf = await pdfjsLib.getDocument({ url: pdfUrl, disableWorker: true } as any).promise
      const page = await pdf.getPage(pageIndex+1)
      const viewport = page.getViewport({ scale: 1.25 })
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: ctx as any, viewport, canvas } as any).promise
    }
    run().catch(console.error)
    return () => { canceled = true }
  }, [pdfUrl, pageIndex])

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const n = [...pts, {x,y}].slice(-2)
    setPts(n)
    if (n.length === 2) onPicked(n as any)
  }

  return (
    <div className="inline-block">
      <canvas ref={canvasRef} onClick={onClick} className="border border-gray-200 rounded" />
      <svg className="absolute pointer-events-none -mt-px -ml-px w-0 h-0" />
      <div className="mt-2 text-xs text-gray-600">Chọn 2 điểm (P1, P2). Màu: <span className={colorClass}>●</span></div>
      <div className="mt-1 text-xs">{pts.map((p,i)=>`P${i+1}=(${p.x.toFixed(1)},${p.y.toFixed(1)})`).join('  ')}</div>
    </div>
  )
}
