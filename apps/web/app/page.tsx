"use client"
import { useMemo, useState } from 'react'
import { z } from 'zod'
import PdfCanvas from '@/components/PdfCanvas'
import { computeSimilarity, type ControlPoints, type Similarity } from '@/lib/geometry'
import { alignAndOverlay } from '@/lib/overlay'

const CpSchema = z.object({
  base: z.tuple([z.object({x:z.number(), y:z.number()}), z.object({x:z.number(), y:z.number()})]),
  overlay: z.tuple([z.object({x:z.number(), y:z.number()}), z.object({x:z.number(), y:z.number()})])
})

export default function Page() {
  const [baseUrl, setBaseUrl] = useState('/sample/base.pdf')
  const [overlayUrl, setOverlayUrl] = useState('/sample/overlay.pdf')
  const [basePts, setBasePts] = useState<[{x:number;y:number},{x:number;y:number}] | null>(null)
  const [overPts, setOverPts] = useState<[{x:number;y:number},{x:number;y:number}] | null>(null)
  const [sim, setSim] = useState<Similarity | null>(null)
  const [merged, setMerged] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canAlign = useMemo(()=> !!basePts && !!overPts, [basePts, overPts])

  const onAlign = async () => {
    if (!basePts || !overPts) return
    setBusy(true)
    try {
      const cps: ControlPoints = { base: basePts as any, overlay: overPts as any }
      CpSchema.parse(cps)
      const transform = computeSimilarity(cps)
      setSim(transform)
      const { mergedPreviewUrl } = await alignAndOverlay({
        basePdfUrl: baseUrl,
        overlayPdfUrl: overlayUrl,
        basePageIndex: 0,
        overlayPageIndex: 0,
        cps
      })
      setMerged(mergedPreviewUrl)
    } catch (e:any) {
      alert(e?.message || 'Align error')
    } finally { setBusy(false) }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Overlay & Clash Check (MVP)</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white shadow-sm rounded p-3">
          <div className="mb-2 text-sm font-medium">Base PDF</div>
          <PdfCanvas pdfUrl={baseUrl} pageIndex={0} onPicked={setBasePts} colorClass="text-sky-500" />
        </div>
        <div className="bg-white shadow-sm rounded p-3">
          <div className="mb-2 text-sm font-medium">Overlay PDF</div>
          <PdfCanvas pdfUrl={overlayUrl} pageIndex={0} onPicked={setOverPts} colorClass="text-red-500" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50" disabled={!canAlign || busy} onClick={onAlign}>Align & Overlay</button>
        {sim && <div className="text-sm text-gray-600">s={sim.s.toFixed(3)} θ={(sim.thetaRad*180/Math.PI).toFixed(1)}° tx={sim.tx.toFixed(1)} ty={sim.ty.toFixed(1)}</div>}
      </div>
      {merged && (
        <div className="bg-white shadow rounded p-3">
          <div className="mb-2 text-sm">Merged preview</div>
          <img src={merged} alt="merged preview" className="max-w-full" />
        </div>
      )}
    </div>
  )
}
