import { computeSimilarity, type ControlPoints, type Similarity } from './geometry'
import { renderPdfPageToCanvas } from './pdf'
import { toBinaryMask, countAndMaskOverlap } from './raster'

export type AlignOptions = {
  vectorMode?: 'vector' | 'raster'
  dpi?: number
  tolerancePx?: number
  debug?: boolean
}

export type ClashRegion = {
  areaPx2: number
  bbox: [number, number, number, number]
}

export type ClashReport = {
  totalOverlapPx2: number
  regions: ClashRegion[]
  previewPngPath?: string
  geojsonPath?: string
}

export async function alignAndOverlay(params: {
  basePdfUrl: string
  overlayPdfUrl: string
  basePageIndex: number
  overlayPageIndex: number
  cps: ControlPoints
  options?: AlignOptions
}): Promise<{ transform: Similarity; report: ClashReport; mergedPreviewUrl: string }> {
  const { basePdfUrl, overlayPdfUrl, basePageIndex, overlayPageIndex, cps, options } = params
  const sim = computeSimilarity(cps)

  // Raster MVP
  const base = await renderPdfPageToCanvas(basePdfUrl, basePageIndex, 1.25)
  const over = await renderPdfPageToCanvas(overlayPdfUrl, overlayPageIndex, 1.25)

  // Warp overlay by similarity
  const out = document.createElement('canvas')
  out.width = Math.max(base.width, over.width)
  out.height = Math.max(base.height, over.height)
  const ctx = out.getContext('2d')!
  ctx.clearRect(0,0,out.width,out.height)
  ctx.globalAlpha = 1
  ctx.drawImage(base, 0, 0)

  const [a,b,c,d,tx,ty] = sim.matrix
  ctx.save()
  ctx.transform(a, b, c, d, tx, ty)
  ctx.globalAlpha = 0.5
  ctx.drawImage(over, 0, 0)
  ctx.restore()

  // Simple raster overlap measure
  const baseMask = toBinaryMask(base)
  // Create warped overlay bitmap to same space as base
  const overBmp = document.createElement('canvas')
  overBmp.width = out.width
  overBmp.height = out.height
  const octx = overBmp.getContext('2d')!
  octx.setTransform(a, b, c, d, tx, ty)
  octx.drawImage(over, 0, 0)
  const overMask = toBinaryMask(overBmp)

  const { count, bbox } = countAndMaskOverlap(baseMask, overMask)
  const report: ClashReport = {
    totalOverlapPx2: count,
    regions: bbox ? [{ areaPx2: count, bbox }] : []
  }
  return { transform: sim, report, mergedPreviewUrl: out.toDataURL('image/png') }
}
