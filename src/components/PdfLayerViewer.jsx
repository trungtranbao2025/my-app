import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import RBush from 'rbush'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { supabase } from '../lib/supabase'
import { PrinterIcon, DocumentArrowDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

// Minimal 2D layer viewer
// Props:
// - layers: Array<{ id: string, name: string, url: string, color?: string }>
//   Each layer corresponds to one PDF (first page rendered for now)
// - onClose: function() => void
// Notes:
// - Pan: drag with mouse; hold Shift to snap pan to major axis
// - Zoom: Ctrl + wheel (or use +/- buttons)
// - Opacity per layer: slider 0..100
// - Draw segments: toggle draw mode, click to place segment endpoints per active layer
// - Detect conflicts: Broad-phase via rbush on segment bboxes across layers; narrow via segment-segment test

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

const segSegIntersect = (a, b, c, d) => {
  // a,b,c,d are points: {x,y}
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const onSeg = (p, q, r) => (
    Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) &&
    Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y)
  )
  const d1 = cross(a, b, c)
  const d2 = cross(a, b, d)
  const d3 = cross(c, d, a)
  const d4 = cross(c, d, b)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true
  if (d1 === 0 && onSeg(a, c, b)) return true
  if (d2 === 0 && onSeg(a, d, b)) return true
  if (d3 === 0 && onSeg(c, a, d)) return true
  if (d4 === 0 && onSeg(c, b, d)) return true
  return false
}

const PdfLayerViewer = ({ layers = [], onClose, onConflictsChange, projectId = null, defaultArea = '', areaOptions = [] }) => {
  const containerRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [drag, setDrag] = useState(null)
  const [rendered, setRendered] = useState({}) // id -> { canvas, width, height }
  const originalRenderedRef = useRef(null) // keep originals for restore
  const cropAppliedOffsetRef = useRef({ x: 0, y: 0 })
  const [opacity, setOpacity] = useState({}) // id -> [0..1]
  const [visible, setVisible] = useState({}) // id -> bool
  const [activeLayerId, setActiveLayerId] = useState(layers[0]?.id || null)
  const [drawMode, setDrawMode] = useState(false)
  const [segments, setSegments] = useState({}) // id -> [{a:{x,y}, b:{x,y}}]
  const [pendingPoint, setPendingPoint] = useState(null)
  const [conflicts, setConflicts] = useState([])
  // Global rotate/crop for the overlaid view
  const [rotation, setRotation] = useState(0) // 0|90|180|270 degrees
  const [cropMode, setCropMode] = useState(false)
  const [cropRect, setCropRect] = useState(null) // {x,y,w,h} in viewer coords
  const [cropDrag, setCropDrag] = useState(null)
  const [cropScopeActiveOnly, setCropScopeActiveOnly] = useState(true) // true: crop only active unlocked layer
  const [hoverHandle, setHoverHandle] = useState(null) // 'n','s','e','w','ne','nw','se','sw','move'
  const [autoFit, setAutoFit] = useState(true)
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 })
  // Select to delete
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set()) // Set of `${layerId}:${segmentId}`
  // Align & overlay (2-point) state
  const [alignMode, setAlignMode] = useState(false)
  const [alignBaseId, setAlignBaseId] = useState(layers[0]?.id || null)
  const [alignTargetId, setAlignTargetId] = useState(layers[1]?.id || null)
  const [alignPicking, setAlignPicking] = useState(null) // 'base' | 'target' | null
  const [alignPoints, setAlignPoints] = useState({ base: [], target: [] }) // each: [{x,y}]
  // Alignment mode: 2-point (similarity) or 3-4 point (affine)
  const [alignPointMode, setAlignPointMode] = useState(2) // 2 | 3 | 4
  // Dragging existing align point
  const [alignDrag, setAlignDrag] = useState(null) // { set: 'base'|'target', index: number }
  // Multi-layer alignment using two labeled points per layer (p1, p2)
  const [primaryLayerId, setPrimaryLayerId] = useState(layers[0]?.id || null)
  const [secondaryLayerIds, setSecondaryLayerIds] = useState(new Set())
  const [perLayerAlignPoints, setPerLayerAlignPoints] = useState({}) // id -> { p1: {x,y}|null, p2: {x,y}|null }
  const [multiAlignPickLabel, setMultiAlignPickLabel] = useState(null) // 'p1' | 'p2' | null
  const [multiAlignDrag, setMultiAlignDrag] = useState(null) // { lid, label: 'p1'|'p2' }
  const [hideOtherLayerPoints, setHideOtherLayerPoints] = useState(true)
  // Save/export
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveArea, setSaveArea] = useState(defaultArea || '')
  const [saveCategory, setSaveCategory] = useState('Phối hợp')
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  // Helper: set primary layer and mark all others as secondary by default
  const setPrimaryWithAuto = (lid) => {
    setPrimaryLayerId(lid || null)
    const others = new Set((layers||[]).filter(x => x.id !== lid).map(x => x.id))
    setSecondaryLayerIds(others)
  }
  // Lock and snapping options
  const [alignLocked, setAlignLocked] = useState(false)
  const [snapGridEnabled, setSnapGridEnabled] = useState(false)
  const [snapGridSize, setSnapGridSize] = useState(10)
  const [snapAngleEnabled, setSnapAngleEnabled] = useState(false)
  const [snapAngleStep, setSnapAngleStep] = useState(15) // degrees
  // Hit sensitivity (screen pixels) for grabbing alignment handles
  const [alignHitTolerancePx, setAlignHitTolerancePx] = useState(18)
  // Visual size of alignment handles (pixels). Smaller = more precise placement.
  const [alignHandleSizePx, setAlignHandleSizePx] = useState(6)
  // Panel behavior
  const [alignAutoHide, setAlignAutoHide] = useState(true)
  const [alignPanelCollapsed, setAlignPanelCollapsed] = useState(false)
  const [alignPanelOpacity, setAlignPanelOpacity] = useState(0.95)
  const [layerTransforms, setLayerTransforms] = useState({}) // id -> [a,b,c,d,tx,ty]
  const [layerLocks, setLayerLocks] = useState({}) // id -> boolean (true = locked)
  // Move active layer by dragging (independent of viewport pan)
  const [layerMoveMode, setLayerMoveMode] = useState(false)
  const [moveLayerDrag, setMoveLayerDrag] = useState(null) // { start:{x,y}, base:[a,b,c,d,tx,ty], lid }
  // Suppress click-side effects after a drag (to avoid adding a point after dragging a handle)
  const didDragRef = useRef(false)
  // Per-layer colors for UI/legend
  const [layerColors, setLayerColors] = useState({}) // id -> color
  // Prefer user-chosen color when available; fall back to layer default then a safe accent
  const colorOf = (id) => (layerColors[id] ?? (layers.find(l=>l.id===id)?.color) ?? '#0066cc')
  // Shorten verbose layer names, e.g. "site_plan — [KV: Tầng 1] Xây" -> "Tầng 1 Xây"
  const shortName = (name) => {
    try {
      if (!name) return ''
      let s = String(name)
      const bi = s.indexOf('['), bj = s.indexOf(']')
      if (bi !== -1 && bj !== -1 && bj > bi) {
        const inside = s.slice(bi+1, bj) // e.g., "KV: Tầng 1"
        const after = s.slice(bj+1).replace(/^[-—–]*\s*/, '').trim()
        const mid = inside.split(':').slice(1).join(':').trim() || inside.trim()
        const core = mid.replace(/^KV\s*/i, '').trim()
        const out = [core, after].filter(Boolean).join(' ')
        return out || s
      }
      // Fallback: drop everything before an em-dash if present
      s = s.replace(/^.*?—\s*/, '').trim()
      return s || String(name)
    } catch { return String(name || '') }
  }
  const defaultPalette = ['#0ea5e9','#ef4444','#22c55e','#a855f7','#f59e0b','#14b8a6','#8b5cf6','#f97316']
  // Simple in-memory render cache (persists during component lifetime)
  const renderCacheRef = useRef(new Map()) // key: layer.url + '|'+scaleLabel -> {canvas,width,height}
  // Cache for tinted canvases: Map<baseCanvas, Map<colorHex, tintedCanvas>>
  const tintCacheRef = useRef(new Map())
  // Per-layer toggle: recolor dark (near-black) strokes to layer color
  const [layerRecolor, setLayerRecolor] = useState({}) // id -> boolean

  // --- color helpers for tinting ---
  const hexToRgb = (hex) => {
    if (!hex) return { r: 0, g: 0, b: 0 }
    const h = hex.replace('#','')
    const v = h.length === 3
      ? h.split('').map(ch=>parseInt(ch+ch,16))
      : [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
    return { r: v[0]||0, g: v[1]||0, b: v[2]||0 }
  }
  // Create a colorized copy where white stays white and dark strokes shift to the target color
  const buildTintedCanvas = (baseCanvas, colorHex) => {
    const { r: cr, g: cg, b: cb } = hexToRgb(colorHex || '#000')
    const w = baseCanvas.width, h = baseCanvas.height
    const out = document.createElement('canvas')
    out.width = w; out.height = h
    const bctx = baseCanvas.getContext('2d', { willReadFrequently: true })
    const src = bctx.getImageData(0, 0, w, h)
    const a = src.data
    // Mix rule: mix = white*I + color*(1-I), where I is luminance in [0..1]
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i], g = a[i+1], b = a[i+2]
      const lum = (0.299*r + 0.587*g + 0.114*b) / 255 // 0=black,1=white
      const wgt = 1 - lum
      a[i]   = Math.min(255, Math.round(255*lum + cr*wgt))
      a[i+1] = Math.min(255, Math.round(255*lum + cg*wgt))
      a[i+2] = Math.min(255, Math.round(255*lum + cb*wgt))
      // keep alpha
    }
    const octx = out.getContext('2d')
    octx.putImageData(src, 0, 0)
    return out
  }
  const getTintedCanvas = (baseCanvas, colorHex) => {
    if (!baseCanvas) return null
    let inner = tintCacheRef.current.get(baseCanvas)
    if (!inner) { inner = new Map(); tintCacheRef.current.set(baseCanvas, inner) }
    let out = inner.get(colorHex)
    if (!out) { out = buildTintedCanvas(baseCanvas, colorHex); inner.set(colorHex, out) }
    return out
  }

  // --- 2D matrix helpers ---
  const matIdentity = [1,0,0,1,0,0]
  const matEq = (a,b) => Array.isArray(a) && Array.isArray(b) && a.length===6 && b.length===6 && a.every((v,i)=>v===b[i])
  const matMulPoint = (m, p) => ({ x: m[0]*p.x + m[1]*p.y + m[4], y: m[2]*p.x + m[3]*p.y + m[5] })
  const matInverse = (m) => {
    if (!m) return matIdentity
    const [a,b,c,d,tx,ty] = m
    const det = a*d - b*c
    if (!det) return matIdentity
    const invA = d/det, invB = -b/det, invC = -c/det, invD = a/det
    const invTx = -(invA*tx + invB*ty)
    const invTy = -(invC*tx + invD*ty)
    return [invA, invB, invC, invD, invTx, invTy]
  }
  const matMul = (A,B) => {
    // Compose affine matrices (apply B then A)
    const [a1,b1,c1,d1,tx1,ty1] = A || matIdentity
    const [a2,b2,c2,d2,tx2,ty2] = B || matIdentity
    return [
      a1*a2 + b1*c2,
      a1*b2 + b1*d2,
      c1*a2 + d1*c2,
      c1*b2 + d1*d2,
      tx1*a2 + ty1*c2 + tx2,
      tx1*b2 + ty1*d2 + ty2,
    ]
  }
  const layerMat = (lid) => layerTransforms[lid] || matIdentity

  useEffect(() => {
    // Configure PDF.js worker for Vite using ?url to get a served asset
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
    } catch {}
    // defaults for new layers
    const vis = {}
    const op = {}
    const locks = {}
    for (const l of layers) {
      vis[l.id] = true
      op[l.id] = 0.85
      locks[l.id] = layerLocks[l.id] ?? false
    }
    setVisible(v => Object.keys(v).length ? v : vis)
    setOpacity(o => Object.keys(o).length ? o : op)
    setLayerLocks(prev => ({ ...locks, ...prev }))
    if (!activeLayerId && layers[0]) setActiveLayerId(layers[0].id)
  // default align layer candidates (pair)
    if (!alignBaseId && layers[0]) setAlignBaseId(layers[0].id)
    if (!alignTargetId && layers[1]) setAlignTargetId(layers[1].id)
    // assign default colors if missing
    setLayerColors(prev => {
      const next = { ...prev }
      layers.forEach((l, idx) => {
        if (!next[l.id]) next[l.id] = l.color || defaultPalette[idx % defaultPalette.length]
      })
      return next
    })
    // Ensure recolor toggle exists per layer (default off)
    setLayerRecolor(prev => {
      const next = { ...prev }
      layers.forEach((l) => { if (next[l.id] === undefined) next[l.id] = false })
      return next
    })
    // Initialize default multi-align roles if not chosen yet: first layer is primary, others are secondary
    setSecondaryLayerIds(prev => {
      if (prev && prev.size) return prev
      const pid = (primaryLayerId && layers.some(l=>l.id===primaryLayerId)) ? primaryLayerId : layers[0]?.id
      if (!pid) return new Set()
      return new Set(layers.filter(l=>l.id!==pid).map(l=>l.id))
    })
    // Default save name once area known
    // Initialize defaults for save modal
    const initArea = (defaultArea || areaOptions?.[0] || '').trim()
    if (!saveArea && initArea) setSaveArea(initArea)
    if (!saveName && initArea) setSaveName(`${initArea} Bản vẽ phối hợp`)
  }, [layers])

  useEffect(() => {
    // Progressive render: quick low-res first, then upgrade to high-res; update per layer for fast first paint
    let cancelled = false
    const scaleLow = 0.8
    const scaleHigh = 1.6
    const keyOf = (url, tag) => `${url}|${tag}`

    const renderPage = async (layer, scale, tag) => {
      const cacheKey = keyOf(layer.url, tag)
      if (renderCacheRef.current.has(cacheKey)) return renderCacheRef.current.get(cacheKey)
      try {
        const pdf = await pdfjsLib.getDocument({ url: layer.url }).promise
        const page = await pdf.getPage(1)
        // Always keep the same output canvas size based on the high scale to avoid layout jumps
        const vpHigh = page.getViewport({ scale: scaleHigh })
        const outCanvas = document.createElement('canvas')
        outCanvas.width = vpHigh.width
        outCanvas.height = vpHigh.height

        if (tag === 'high') {
          const ctx = outCanvas.getContext('2d', { alpha: false })
          const viewport = vpHigh
          await page.render({ canvasContext: ctx, viewport, intent: 'display' }).promise
        } else {
          // Render smaller then scale up into the output canvas
          const viewportLow = page.getViewport({ scale })
          const tmp = document.createElement('canvas')
          tmp.width = viewportLow.width
          tmp.height = viewportLow.height
          const tctx = tmp.getContext('2d', { alpha: false })
          await page.render({ canvasContext: tctx, viewport: viewportLow, intent: 'display' }).promise
          const ctx = outCanvas.getContext('2d', { alpha: false })
          ctx.imageSmoothingQuality = 'low'
          ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, outCanvas.width, outCanvas.height)
        }
        const out = { canvas: outCanvas, width: outCanvas.width, height: outCanvas.height }
        renderCacheRef.current.set(cacheKey, out)
        return out
      } catch (e) {
        console.warn('PDF render failed for layer', layer, e)
        return null
      }
    }

    const run = async () => {
      // Render low-res sequentially for immediate feedback
      for (const layer of layers) {
        if (cancelled) break
        const low = await renderPage(layer, scaleLow, 'low')
        if (low && !cancelled) {
          setRendered(prev => ({ ...prev, [layer.id]: low }))
        }
      }
      // Upgrade to high-res in background per layer
      for (const layer of layers) {
        if (cancelled) break
        const hi = await renderPage(layer, scaleHigh, 'high')
        if (hi && !cancelled) {
          setRendered(prev => ({ ...prev, [layer.id]: hi }))
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [layers])

  // Determine base canvas extents from loaded layers to avoid clipping on rotate
  const baseSize = useMemo(() => {
    let w = 0, h = 0
    for (const k of Object.keys(rendered)) {
      const r = rendered[k]
      if (!r) continue
      w = Math.max(w, r.width || 0)
      h = Math.max(h, r.height || 0)
    }
    return { w: w || 1280, h: h || 800 }
  }, [rendered])
  const mainW = baseSize.w, mainH = baseSize.h

  const startDrag = (e) => {
    const isPrimary = e.button === 0
    if (!isPrimary) return
    didDragRef.current = false
    if (cropMode) {
      const p0 = toCanvasXY(e.clientX, e.clientY)
      const h = handleAtPoint(p0, cropRect)
      if (!cropRect) {
        setCropDrag({ start: p0, type: 'se' })
        setCropRect({ x: p0.x, y: p0.y, w: 0, h: 0 })
      } else if (h) {
        setCropDrag({ start: p0, type: h, base: { ...cropRect } })
      } else {
        setCropDrag({ start: p0, type: 'se' })
        setCropRect({ x: p0.x, y: p0.y, w: 0, h: 0 })
      }
      return
    }
  // If in align mode, allow grabbing an existing align point to drag even while picking is ON
    if (alignMode && !alignLocked) {
      const p = toCanvasXY(e.clientX, e.clientY)
      const tol = alignHitTolerancePx / Math.max(zoom, 0.01)
      // search base points first, then target
      const hitIdxBase = !layerLocks[alignBaseId] ? (alignPoints.base || []).findIndex(pt => Math.hypot(pt.x - p.x, pt.y - p.y) <= tol) : -1
      if (hitIdxBase >= 0) {
        setAlignDrag({ set: 'base', index: hitIdxBase })
        const el = containerRef.current; if (el) el.style.cursor = 'grabbing'
        return
      }
      const hitIdxTarget = !layerLocks[alignTargetId] ? (alignPoints.target || []).findIndex(pt => Math.hypot(pt.x - p.x, pt.y - p.y) <= tol) : -1
      if (hitIdxTarget >= 0) {
        setAlignDrag({ set: 'target', index: hitIdxTarget })
        const el = containerRef.current; if (el) el.style.cursor = 'grabbing'
        return
      }
      // Hit test multi-layer labeled points (prefer active layer; optionally hide others)
      const testIds = hideOtherLayerPoints && activeLayerId ? [activeLayerId] : layers.map(l=>l.id)
      for (const lid of testIds) {
        if (layerLocks[lid]) continue
        const pts = perLayerAlignPoints[lid] || {}
        const entries = [ ['p1', pts.p1], ['p2', pts.p2] ]
        for (const [label, pt] of entries) {
          if (!pt) continue
          if (Math.hypot(pt.x - p.x, pt.y - p.y) <= tol) {
            setMultiAlignDrag({ lid, label })
            const el = containerRef.current; if (el) el.style.cursor = 'grabbing'
            return
          }
        }
      }
    }
    // If moving a single layer (not the viewport), start layer drag
    if (layerMoveMode && activeLayerId && !layerLocks[activeLayerId]) {
      const p0 = toCanvasXY(e.clientX, e.clientY)
      const base = layerTransforms[activeLayerId] || [1,0,0,1,0,0]
      setMoveLayerDrag({ start: p0, base: [...base], lid: activeLayerId })
      return
    }
    setDrag({ startX: e.clientX, startY: e.clientY, base: { ...pan } })
    if (autoFit) setAutoFit(false)
  }
  const moveDrag = (e) => {
    if (cropMode) {
      if (!cropDrag) return
      const p = toCanvasXY(e.clientX, e.clientY)
      const b = cropDrag.base || cropRect || { x: 0, y: 0, w: 0, h: 0 }
      let r = { ...b }
      switch (cropDrag.type) {
        case 'move': {
          const dx = p.x - cropDrag.start.x
          const dy = p.y - cropDrag.start.y
          r = { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h }
          break
        }
        case 'n': r = { x: b.x, y: Math.min(p.y, b.y + b.h - minCrop.h), w: b.w, h: b.y + b.h - Math.min(p.y, b.y + b.h - minCrop.h) }; break
        case 's': r = { x: b.x, y: b.y, w: b.w, h: Math.max(minCrop.h, p.y - b.y) }; break
        case 'w': r = { x: Math.min(p.x, b.x + b.w - minCrop.w), y: b.y, w: b.x + b.w - Math.min(p.x, b.x + b.w - minCrop.w), h: b.h }; break
        case 'e': r = { x: b.x, y: b.y, w: Math.max(minCrop.w, p.x - b.x), h: b.h }; break
        case 'nw': r = { x: Math.min(p.x, b.x + b.w - minCrop.w), y: Math.min(p.y, b.y + b.h - minCrop.h), w: (b.x + b.w) - Math.min(p.x, b.x + b.w - minCrop.w), h: (b.y + b.h) - Math.min(p.y, b.y + b.h - minCrop.h) }; break
        case 'ne': r = { x: b.x, y: Math.min(p.y, b.y + b.h - minCrop.h), w: Math.max(minCrop.w, p.x - b.x), h: (b.y + b.h) - Math.min(p.y, b.y + b.h - minCrop.h) }; break
        case 'sw': r = { x: Math.min(p.x, b.x + b.w - minCrop.w), y: b.y, w: (b.x + b.w) - Math.min(p.x, b.x + b.w - minCrop.w), h: Math.max(minCrop.h, p.y - b.y) }; break
        case 'se': r = { x: b.x, y: b.y, w: Math.max(minCrop.w, p.x - b.x), h: Math.max(minCrop.h, p.y - b.y) }; break
        default: break
      }
      setCropRect(clampRect(r))
      didDragRef.current = true
      return
    }
    // Dragging align point (manual move)
    if (alignDrag && !alignLocked) {
      const p = toCanvasXY(e.clientX, e.clientY)
      const sp = snapPoint(p, alignDrag.set)
      setAlignPoints(prev => {
        const next = { base: [...(prev.base||[])], target: [...(prev.target||[])] }
        if (alignDrag.set === 'base') next.base[alignDrag.index] = sp
        else next.target[alignDrag.index] = sp
        return next
      })
      didDragRef.current = true
      const el = containerRef.current; if (el) el.style.cursor = 'grabbing'
      return
    }
    // Dragging labeled multi-align point
    if (multiAlignDrag && !alignLocked) {
      const p = toCanvasXY(e.clientX, e.clientY)
      const sp = snapPoint(p, 'base')
      setPerLayerAlignPoints(prev => {
        const next = { ...prev }
        const lid = multiAlignDrag.lid
        const cur = { ...(next[lid] || {}) }
        cur[multiAlignDrag.label] = sp
        next[lid] = cur
        return next
      })
      didDragRef.current = true
      const el = containerRef.current; if (el) el.style.cursor = 'grabbing'
      return
    }
    // Dragging a single layer
    if (moveLayerDrag && layerMoveMode) {
      const p = toCanvasXY(e.clientX, e.clientY)
      const dx = p.x - moveLayerDrag.start.x
      const dy = p.y - moveLayerDrag.start.y
      setLayerTransforms(prev => ({
        ...prev,
        [moveLayerDrag.lid]: [
          moveLayerDrag.base[0], moveLayerDrag.base[1],
          moveLayerDrag.base[2], moveLayerDrag.base[3],
          (moveLayerDrag.base[4] || 0) + dx,
          (moveLayerDrag.base[5] || 0) + dy,
        ]
      }))
      didDragRef.current = true
      const el = containerRef.current; if (el) el.style.cursor = 'grabbing'
      return
    }
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    let nx = drag.base.x + dx
    let ny = drag.base.y + dy
    if (e.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy) * 2) ny = drag.base.y
      else if (Math.abs(dy) > Math.abs(dx) * 2) nx = drag.base.x
    }
    setPan({ x: nx, y: ny })
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) didDragRef.current = true
  }
  const endDrag = () => { setDrag(null); setCropDrag(null); setAlignDrag(null); setMoveLayerDrag(null); setMultiAlignDrag(null); const el = containerRef.current; if (el && !cropMode) el.style.cursor = 'default' }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const delta = -Math.sign(e.deltaY) * 0.1
      const nz = clamp(zoom + delta, 0.2, 6)
      setZoom(nz)
      if (autoFit) setAutoFit(false)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, autoFit])

  // ESC to cancel picking so the panel can be opened immediately
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setAlignPicking(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Track container viewport size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setViewSize({ w: el.clientWidth || 0, h: el.clientHeight || 0 })
    update()
    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => update())
      ro.observe(el)
    } else {
      const onResize = () => update()
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }
    return () => { try { ro && ro.disconnect() } catch {} }
  }, [])

  const computeFit = (vw, vh) => {
    if (!vw || !vh) return
    const rot = ((rotation % 360) + 360) % 360
    // Bounding box dims and min corner for the rotated rectangle about origin (0,0)
    let boxW, boxH, minX, minY
    if (rot === 0) { boxW = mainW; boxH = mainH; minX = 0; minY = 0 }
    else if (rot === 90) { boxW = mainH; boxH = mainW; minX = -mainH; minY = 0 }
    else if (rot === 180) { boxW = mainW; boxH = mainH; minX = -mainW; minY = -mainH }
    else { /* 270 */ boxW = mainH; boxH = mainW; minX = 0; minY = -mainW }

    const padding = 16
    const scale = Math.max(0.01, Math.min((vw - padding) / boxW, (vh - padding) / boxH))
    const targetLeft = (vw - boxW * scale) / 2
    const targetTop = (vh - boxH * scale) / 2
    // Translate so that rotated bbox's min corner aligns to target top-left
    const px = targetLeft - minX * scale
    const py = targetTop - minY * scale
    setZoom(scale)
    setPan({ x: px, y: py })
  }

  useEffect(() => {
    if (!autoFit) return
    computeFit(viewSize.w, viewSize.h)
  }, [autoFit, viewSize.w, viewSize.h, mainW, mainH, rotation])

  const toCanvasXY = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect()
    const dx = clientX - rect.left - pan.x
    const dy = clientY - rect.top - pan.y
    const theta = ((rotation % 360) + 360) % 360 * Math.PI / 180
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    // Inverse transform of scale then rotate about origin
    const x = (cos * dx + sin * dy) / zoom
    const y = (-sin * dx + cos * dy) / zoom
    return { x, y }
  }

  // Apply snapping rules: angle (relative to first point in same set) then grid; clamp to canvas
  const snapPoint = (p, setName) => {
    let pt = { ...p }
    if (snapAngleEnabled) {
      const arr = alignPoints[setName] || []
      const origin = arr.length > 0 ? arr[0] : null
      if (origin) {
        const dx = pt.x - origin.x
        const dy = pt.y - origin.y
        const r = Math.hypot(dx, dy)
        if (r > 0) {
          const stepRad = (snapAngleStep * Math.PI) / 180
          const ang = Math.atan2(dy, dx)
          const snappedAng = Math.round(ang / stepRad) * stepRad
          pt = { x: origin.x + r * Math.cos(snappedAng), y: origin.y + r * Math.sin(snappedAng) }
        }
      }
    }
    if (snapGridEnabled && snapGridSize > 0) {
      const g = snapGridSize
      pt = { x: Math.round(pt.x / g) * g, y: Math.round(pt.y / g) * g }
    }
    pt.x = clamp(pt.x, 0, mainW)
    pt.y = clamp(pt.y, 0, mainH)
    return pt
  }

  const keyFor = (lid, seg) => `${lid}:${seg.id || ''}`
  const isSelected = (lid, seg) => selectedIds.has(keyFor(lid, seg))
  const toggleSelect = (lid, seg, additive) => {
    const key = keyFor(lid, seg)
    setSelectedIds(prev => {
      const next = new Set(additive ? prev : [])
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  // Ensure changing active layer also clears cross-layer selections
  useEffect(() => {
    clearSelection()
  }, [activeLayerId])

  const distPointToSegment = (p, a, b) => {
    // p, a, b in viewer coords
    const vx = b.x - a.x, vy = b.y - a.y
    const wx = p.x - a.x, wy = p.y - a.y
    const len2 = vx*vx + vy*vy
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
    let t = (wx*vx + wy*vy) / len2
    t = Math.max(0, Math.min(1, t))
    const projx = a.x + t * vx
    const projy = a.y + t * vy
    return Math.hypot(p.x - projx, p.y - projy)
  }

  const handleSelectClick = (e) => {
    // Independent editing per layer: selection only targets the active layer
    const p = toCanvasXY(e.clientX, e.clientY)
    const tol = 6 / Math.max(zoom, 0.01)
    let best = null
    let bestD = Infinity
    if (activeLayerId && visible[activeLayerId]) {
      const arr = segments[activeLayerId] || []
      for (const seg of arr) {
        if (!insideCrop(seg.a) || !insideCrop(seg.b)) continue
        const d = distPointToSegment(p, seg.a, seg.b)
        if (d < bestD && d <= tol) { bestD = d; best = { lid: activeLayerId, seg } }
      }
    }
    if (!best) {
      if (!e.ctrlKey && !e.shiftKey) clearSelection()
      return
    }
    toggleSelect(best.lid, best.seg, e.ctrlKey || e.shiftKey)
  }

  const deleteSelected = () => {
    if (selectedIds.size === 0) return
    // Only delete selections within the active layer to avoid affecting others
    if (layerLocks[activeLayerId]) return
    setSegments(prev => {
      const out = { ...prev }
      if (activeLayerId) {
        const arr = prev[activeLayerId] || []
        out[activeLayerId] = arr.filter(seg => !selectedIds.has(keyFor(activeLayerId, seg)))
      }
      return out
    })
    clearSelection()
  }

  const insideCrop = (p) => {
    if (!cropRect || cropRect.w <= 0 || cropRect.h <= 0) return true
    return p.x >= cropRect.x && p.x <= cropRect.x + cropRect.w && p.y >= cropRect.y && p.y <= cropRect.y + cropRect.h
  }

  // --- Crop helpers: handles, clamping, commit/restore ---
  const minCrop = { w: 20, h: 20 }
  const clampRect = (r) => {
    const nx = clamp(r.x, 0, Math.max(0, mainW - minCrop.w))
    const ny = clamp(r.y, 0, Math.max(0, mainH - minCrop.h))
    const nw = clamp(r.w, minCrop.w, mainW - nx)
    const nh = clamp(r.h, minCrop.h, mainH - ny)
    return { x: nx, y: ny, w: nw, h: nh }
  }

  const handleAtPoint = (p, r) => {
    if (!r) return null
    const s = 8
    const near = (px, py, cx, cy) => Math.abs(px - cx) <= s && Math.abs(py - cy) <= s
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2
    if (near(p.x, p.y, r.x, r.y)) return 'nw'
    if (near(p.x, p.y, r.x + r.w, r.y)) return 'ne'
    if (near(p.x, p.y, r.x + r.w, r.y + r.h)) return 'se'
    if (near(p.x, p.y, r.x, r.y + r.h)) return 'sw'
    if (Math.abs(p.x - r.x) <= s && p.y >= r.y - s && p.y <= r.y + r.h + s) return 'w'
    if (Math.abs(p.x - (r.x + r.w)) <= s && p.y >= r.y - s && p.y <= r.y + r.h + s) return 'e'
    if (Math.abs(p.y - r.y) <= s && p.x >= r.x - s && p.x <= r.x + r.w + s) return 'n'
    if (Math.abs(p.y - (r.y + r.h)) <= s && p.x >= r.x - s && p.x <= r.x + r.w + s) return 's'
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return 'move'
    return null
  }

  useEffect(() => {
    if (!cropMode) return
    if (!cropRect) setCropRect({ x: 0, y: 0, w: mainW, h: mainH })
  }, [cropMode, cropRect, mainW, mainH])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMove = (e) => {
      if (!cropMode || cropDrag) return
      const p = toCanvasXY(e.clientX, e.clientY)
      const h = handleAtPoint(p, cropRect)
      setHoverHandle(h)
      const cursors = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize', move: 'move' }
      el.style.cursor = h ? (cursors[h] || 'default') : 'default'
    }
    el.addEventListener('mousemove', onMove)
    return () => { try { el.removeEventListener('mousemove', onMove) } catch {}; el.style.cursor = 'default' }
  }, [cropMode, cropRect, cropDrag])

  const commitCrop = () => {
    if (!cropRect) return
  let sx = Math.round(cropRect.x), sy = Math.round(cropRect.y)
  let sw = Math.round(cropRect.w), sh = Math.round(cropRect.h)
    // Determine which layers to crop
    const targetIds = cropScopeActiveOnly && activeLayerId ? [activeLayerId] : Object.keys(rendered)
    const toCrop = targetIds.filter(id => !layerLocks[id])
    if (toCrop.length === 0) { setCropMode(false); setCropRect(null); return }
    if (!originalRenderedRef.current) originalRenderedRef.current = {}
    if (!cropAppliedOffsetRef.current) cropAppliedOffsetRef.current = {}
    // Clamp crop rect to the smallest canvas among target layers to avoid OOB
    let minW = Infinity, minH = Infinity
    for (const id of toCrop) {
      const r = rendered[id]
      if (r) { minW = Math.min(minW, r.width); minH = Math.min(minH, r.height) }
    }
    if (!isFinite(minW) || !isFinite(minH)) { setCropMode(false); setCropRect(null); return }
    sx = Math.max(0, Math.min(sx, Math.max(0, minW - 1)))
    sy = Math.max(0, Math.min(sy, Math.max(0, minH - 1)))
    sw = Math.max(1, Math.min(sw, minW - sx))
    sh = Math.max(1, Math.min(sh, minH - sy))
    // Backup originals for layers we are about to crop
    for (const id of toCrop) {
      const r = rendered[id]; if (!r) continue
      if (!originalRenderedRef.current[id]) {
        const c = document.createElement('canvas')
        c.width = r.width; c.height = r.height
        const ctx = c.getContext('2d')
        ctx.drawImage(r.canvas, 0, 0)
        originalRenderedRef.current[id] = { canvas: c, width: r.width, height: r.height }
      }
      // Perform crop for this layer only
      const cOut = document.createElement('canvas')
      cOut.width = sw; cOut.height = sh
      const octx = cOut.getContext('2d')
      octx.drawImage(rendered[id].canvas, sx, sy, sw, sh, 0, 0, sw, sh)
      const outObj = { canvas: cOut, width: sw, height: sh }
      setRendered(prev => ({ ...prev, [id]: outObj }))
      cropAppliedOffsetRef.current[id] = { x: sx, y: sy }
      // Preserve transforms; adjust alignment points instead of clearing
      if (id === alignBaseId || id === alignTargetId) {
        setAlignPicking(null)
        setAlignPoints(prev => ({
          base: id === alignBaseId ? (prev.base || []).map(pt => ({ x: pt.x - sx, y: pt.y - sy })) : prev.base,
          target: id === alignTargetId ? (prev.target || []).map(pt => ({ x: pt.x - sx, y: pt.y - sy })) : prev.target
        }))
      }
      // Shift segments belonging to this layer only
      setSegments(prev => {
        const out = { ...prev }
        const arr = prev[id] || []
        out[id] = arr.map(s => ({ id: s.id, a: { x: s.a.x - sx, y: s.a.y - sy }, b: { x: s.b.x - sx, y: s.b.y - sy } }))
        return out
      })
    }
    setCropRect(null)
    setCropMode(false)
    if (autoFit) {
      setTimeout(() => {
        const el = containerRef.current
        if (el) setViewSize({ w: el.clientWidth || 0, h: el.clientHeight || 0 })
      }, 0)
    }
  }

  const restoreOriginal = () => {
    const orig = originalRenderedRef.current
    if (!orig || Object.keys(orig).length === 0) return
    // Restore each layer that has an original
    for (const [id, r] of Object.entries(orig)) {
      setRendered(prev => ({ ...prev, [id]: r }))
      const off = (cropAppliedOffsetRef.current && cropAppliedOffsetRef.current[id]) || { x:0, y:0 }
      if (off.x || off.y) {
        setSegments(prev => {
          const out = { ...prev }
          const arr = prev[id] || []
          out[id] = arr.map(s => ({ id: s.id, a: { x: s.a.x + off.x, y: s.a.y + off.y }, b: { x: s.b.x + off.x, y: s.b.y + off.y } }))
          return out
        })
        // Shift back alignment points for this layer if present
        if (id === alignBaseId || id === alignTargetId) {
          setAlignPoints(prev => ({
            base: id === alignBaseId ? (prev.base || []).map(pt => ({ x: pt.x + off.x, y: pt.y + off.y })) : prev.base,
            target: id === alignTargetId ? (prev.target || []).map(pt => ({ x: pt.x + off.x, y: pt.y + off.y })) : prev.target
          }))
        }
      }
      // No need to reset transforms for other layers
    }
    originalRenderedRef.current = null
    cropAppliedOffsetRef.current = {}
    setCropRect(null)
    if (autoFit) {
      setTimeout(() => {
        const el = containerRef.current
        if (el) setViewSize({ w: el.clientWidth || 0, h: el.clientHeight || 0 })
      }, 0)
    }
  }

  // Build a composite canvas of current visible layers with transforms and opacity
  const buildCompositeCanvas = (scale = 1) => {
    const w = Math.max(1, Math.round(mainW * scale))
    const h = Math.max(1, Math.round(mainH * scale))
    const base = document.createElement('canvas')
    base.width = w; base.height = h
    const ctx = base.getContext('2d', { alpha: true })
    // Draw each visible layer in order
    for (const l of layers) {
      if (!visible[l.id]) continue
      const r = rendered[l.id]
      if (!r || !r.canvas) continue
      const src = layerRecolor[l.id] ? (getTintedCanvas(r.canvas, colorOf(l.id)) || r.canvas) : r.canvas
      ctx.save()
      const m = layerTransforms[l.id] || [1,0,0,1,0,0]
      // Apply transform with scale
      ctx.transform(m[0], m[1], m[2], m[3], m[4]*scale, m[5]*scale)
      // draw with opacity
      ctx.globalAlpha = (opacity[l.id] ?? 0.85)
      // draw image (scaled)
      ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, src.width*scale, src.height*scale)
      ctx.restore()
    }
    // Apply rotation if needed by rendering into a rotated canvas
    const rot = ((rotation % 360) + 360) % 360
    if (rot === 0) return base
    const out = document.createElement('canvas')
    if (rot === 90) {
      out.width = h; out.height = w
      const octx = out.getContext('2d')
      octx.translate(out.width, 0)
      octx.rotate(Math.PI/2)
      octx.drawImage(base, 0, 0)
      return out
    } else if (rot === 180) {
      out.width = w; out.height = h
      const octx = out.getContext('2d')
      octx.translate(out.width, out.height)
      octx.rotate(Math.PI)
      octx.drawImage(base, 0, 0)
      return out
    } else if (rot === 270) {
      out.width = h; out.height = w
      const octx = out.getContext('2d')
      octx.translate(0, out.height)
      octx.rotate(-Math.PI/2)
      octx.drawImage(base, 0, 0)
      return out
    }
    return base
  }

  const printComposite = async () => {
    try {
      const canvas = buildCompositeCanvas(1)
      const dataUrl = canvas.toDataURL('image/png')
      const win = window.open('', '_blank')
      if (!win) { alert('Trình duyệt chặn cửa sổ in. Hãy cho phép popup và thử lại.'); return }
      win.document.open()
      win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>In bản vẽ phối hợp</title>
    <style>
      @page { size: auto; margin: 10mm; }
      html, body { height: 100%; }
      body { margin: 0; padding: 0; background: #fff; }
      img { width: 100%; height: auto; display: block; }
    </style>
  </head>
  <body>
    <img id="img" alt="composed" />
    <script>
      (function(){
        var el = document.getElementById('img');
        el.addEventListener('load', function(){
          setTimeout(function(){ try { window.focus(); window.print(); } catch(e) {} }, 100);
        });
        el.src = '${dataUrl}';
      })();
    <\/script>
  </body>
 </html>`)
      win.document.close()
    } catch (e) { console.error(e) }
  }

  const saveComposite = async () => {
    if (!projectId) { alert('Thiếu Project ID'); return }
    const area = (saveArea || defaultArea || '').trim()
    if (!area) { alert('Nhập khu vực'); return }
    const name = (saveName || `${area} Bản vẽ phối hợp`).trim()
    setSaving(true)
    try {
      const canvas = buildCompositeCanvas(1)
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.92))
      if (!blob) throw new Error('Xuất ảnh thất bại')
      const areaSlug = area.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'kv'
      const ts = new Date().toISOString().replace(/[:.]/g,'-')
      const fileName = `${name.replace(/[^a-zA-Z0-9_.\- ]+/g,'_')}.png`
      const path = `${projectId}/composed/${areaSlug}/${ts}-${fileName}`
      const { error: upErr } = await supabase.storage.from('project-drawings').upload(path, blob, {
        contentType: 'image/png', upsert: true
      })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('project-drawings').getPublicUrl(path)
      const file_url = pub?.publicUrl
      // Insert drawing row
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id || null
      const { error: insErr } = await supabase.from('project_drawings').insert({
        project_id: projectId,
        file_url,
        file_name: fileName,
        file_size: blob.size,
        file_type: 'image/png',
        name,
        title: name,
        area,
        category: saveCategory || 'Phối hợp',
        uploaded_by: userId,
      })
      if (insErr) throw insErr
      setSaveOpen(false)
      alert('Đã lưu bản vẽ phối hợp')
    } catch (e) {
      console.error(e)
      alert(e?.message || 'Lỗi lưu bản vẽ')
    } finally {
      setSaving(false)
    }
  }

  // Add a point/segment in draw mode
  const addPoint = (e) => {
    // If a drag just happened, ignore the click
    if (didDragRef.current) { didDragRef.current = false; return }
    if (selectMode) { handleSelectClick(e); return }
    // Multi-layer labeled point picking
    if (alignMode && multiAlignPickLabel && activeLayerId && !layerLocks[activeLayerId]) {
      const p = toCanvasXY(e.clientX, e.clientY)
      if (!insideCrop(p)) return
      const sp = snapPoint(p, 'base')
      setPerLayerAlignPoints(prev => {
        const next = { ...prev }
        const cur = { ...(next[activeLayerId] || {}) }
        cur[multiAlignPickLabel] = sp
        next[activeLayerId] = cur
        return next
      })
      return
    }
    // Align picking has priority over draw mode
    if (alignMode && alignPicking) {
      if (alignLocked) return
      // Block picking on a locked layer
      if ((alignPicking === 'base' && layerLocks[alignBaseId]) || (alignPicking === 'target' && layerLocks[alignTargetId])) return
      const p = toCanvasXY(e.clientX, e.clientY)
      if (!insideCrop(p)) return
      setAlignPoints(prev => {
        const key = alignPicking
        const arr = (prev[key] || []).slice()
        const limit = Math.min(alignPointMode, 4)
        if (arr.length < limit) arr.push(snapPoint(p, key))
        return { ...prev, [key]: arr }
      })
      return
    }
    if (!drawMode || !activeLayerId || !visible[activeLayerId]) return
    if (layerLocks[activeLayerId]) return
    const p = toCanvasXY(e.clientX, e.clientY)
    if (!insideCrop(p)) return
    if (!pendingPoint) {
      setPendingPoint(p)
      return
    }
    const seg = { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}` , a: pendingPoint, b: p }
    setSegments(prev => {
      const arr = prev[activeLayerId] ? prev[activeLayerId].slice() : []
      arr.push(seg)
      return { ...prev, [activeLayerId]: arr }
    })
    setPendingPoint(null)
  }

  // --- Align & overlay helpers ---
  const resetAlignPoints = () => setAlignPoints({ base: [], target: [] })
  const clearLayerTransform = (lid) => setLayerTransforms(t => { const n = { ...t }; delete n[lid]; return n })

  const computeSimilarity = (base, over) => {
    if (base.length !== 2 || over.length !== 2) return null
    const [B1, B2] = base, [O1, O2] = over
    const vB = { x: B2.x - B1.x, y: B2.y - B1.y }
    const vO = { x: O2.x - O1.x, y: O2.y - O1.y }
    const lenB = Math.hypot(vB.x, vB.y)
    const lenO = Math.hypot(vO.x, vO.y)
    if (lenB === 0 || lenO === 0) return null
    const s = lenB / lenO
    const angB = Math.atan2(vB.y, vB.x)
    const angO = Math.atan2(vO.y, vO.x)
    const theta = angB - angO
    const cos = Math.cos(theta), sin = Math.sin(theta)
    const a = s * cos, b = s * sin, c = -s * sin, d = s * cos
    const tx = B1.x - (a * O1.x + b * O1.y)
    const ty = B1.y - (c * O1.x + d * O1.y)
    return [a, b, c, d, tx, ty]
  }

  // Solve affine transform using 3 or more point pairs in least squares.
  // Returns [a,b,c,d,tx,ty] such that [u v]^T = [[a b],[c d]]*[x y]^T + [tx ty]^T
  const computeAffine = (base, over) => {
    const n = Math.min(base.length, over.length)
    if (n < 3) return null
    // Build A (2n x 6) and b (2n)
    const rows = 2 * n
    const A = Array.from({ length: rows }, () => Array(6).fill(0))
    const b = Array(rows).fill(0)
    for (let i = 0; i < n; i++) {
      const x = over[i].x, y = over[i].y
      const u = base[i].x, v = base[i].y
      // u row
      A[2*i][0] = x; A[2*i][1] = y; A[2*i][2] = 0; A[2*i][3] = 0; A[2*i][4] = 1; A[2*i][5] = 0
      b[2*i] = u
      // v row
      A[2*i+1][0] = 0; A[2*i+1][1] = 0; A[2*i+1][2] = x; A[2*i+1][3] = y; A[2*i+1][4] = 0; A[2*i+1][5] = 1
      b[2*i+1] = v
    }
    // Solve normal equations (AtA) m = (At b)
    const At = (M) => {
      const r = M.length, c = M[0].length
      const T = Array.from({ length: c }, () => Array(r).fill(0))
      for (let i=0;i<r;i++) for (let j=0;j<c;j++) T[j][i] = M[i][j]
      return T
    }
    const matMul = (M, N) => {
      const r = M.length, c = N[0].length, kmax = N.length
      const R = Array.from({ length: r }, () => Array(c).fill(0))
      for (let i=0;i<r;i++) for (let k=0;k<kmax;k++) {
        const Mik = M[i][k]
        if (Mik === 0) continue
        for (let j=0;j<c;j++) R[i][j] += Mik * N[k][j]
      }
      return R
    }
    const vecMul = (M, v) => {
      const r = M.length, c = M[0].length
      const out = Array(r).fill(0)
      for (let i=0;i<r;i++) {
        let s = 0
        for (let j=0;j<c;j++) s += M[i][j] * v[j]
        out[i] = s
      }
      return out
    }
    const AtM = At(A)
    const AtA = matMul(AtM, A) // 6x6
    const Atb = vecMul(AtM, b) // 6
    // Solve 6x6 via Gaussian elimination
    const aug = AtA.map((row, i) => row.concat([Atb[i]])) // 6 x 7
    const nvar = 6
    for (let i=0;i<nvar;i++) {
      // pivot
      let piv = i
      for (let r=i+1;r<nvar;r++) if (Math.abs(aug[r][i]) > Math.abs(aug[piv][i])) piv = r
      if (Math.abs(aug[piv][i]) < 1e-12) return null
      if (piv !== i) { const tmp = aug[i]; aug[i] = aug[piv]; aug[piv] = tmp }
      // normalize
      const div = aug[i][i]
      for (let j=i;j<=nvar;j++) aug[i][j] /= div
      // eliminate others
      for (let r=0;r<nvar;r++) if (r !== i) {
        const f = aug[r][i]
        if (f === 0) continue
        for (let j=i;j<=nvar;j++) aug[r][j] -= f * aug[i][j]
      }
    }
    const m = aug.map(row => row[nvar]) // length 6
    return [m[0], m[1], m[2], m[3], m[4], m[5]]
  }

  const applyAlignment = () => {
    if (!alignMode || !alignBaseId || !alignTargetId || alignBaseId === alignTargetId) return
    if (layerLocks[alignTargetId]) return
    let mat = null
    const nb = alignPoints.base.length
    const nt = alignPoints.target.length
    const need = alignPointMode === 2 ? 2 : Math.min(alignPointMode, 4)
    if (nb < need || nt < need) return
    if (alignPointMode === 2) mat = computeSimilarity(alignPoints.base.slice(0,2), alignPoints.target.slice(0,2))
    else mat = computeAffine(alignPoints.base.slice(0,need), alignPoints.target.slice(0,need))
    if (!mat) return
    setLayerTransforms(prev => {
      if (layerLocks[alignTargetId]) return prev
      return ({ ...prev, [alignTargetId]: mat })
    })
  }

  // Detect conflicts across visible layers within crop area
  const detectConflicts = () => {
    const layerIds = layers.filter(l => visible[l.id]).map(l => l.id)
    const trees = {}
    for (const lid of layerIds) {
      const tree = new RBush()
      const segs = (segments[lid] || []).filter(s => insideCrop(s.a) && insideCrop(s.b))
      tree.load(segs.map((s, i) => ({
        minX: Math.min(s.a.x, s.b.x), minY: Math.min(s.a.y, s.b.y),
        maxX: Math.max(s.a.x, s.b.x), maxY: Math.max(s.a.y, s.b.y),
        lid, i, s,
      })))
      trees[lid] = tree
    }
    const results = []
    for (let i = 0; i < layerIds.length; i++) {
      for (let j = i + 1; j < layerIds.length; j++) {
        const A = layerIds[i], B = layerIds[j]
        const segsA = (segments[A] || []).filter(s => insideCrop(s.a) && insideCrop(s.b))
        const treeB = trees[B]
        segsA.forEach((sa, ia) => {
          const box = {
            minX: Math.min(sa.a.x, sa.b.x), minY: Math.min(sa.a.y, sa.b.y),
            maxX: Math.max(sa.a.x, sa.b.x), maxY: Math.max(sa.a.y, sa.b.y)
          }
          const candidates = treeB.search(box)
          for (const cand of candidates) {
            const sb = cand.s
            if (segSegIntersect(sa.a, sa.b, sb.a, sb.b)) {
              results.push({ A, ia, B, ib: cand.i })
            }
          }
        })
      }
    }
    setConflicts(results)
    try { onConflictsChange && onConflictsChange(results) } catch {}
  }

  // --- Make points follow their layer transforms ---
  const prevLayerMatRef = useRef({}) // id -> mat
  useEffect(() => {
    // Compute delta for any changed layer transform and apply to points of that layer
    const deltas = {}
    for (const l of layers) {
      const id = l.id
      const cur = layerMat(id)
      const prev = prevLayerMatRef.current[id] || matIdentity
      if (!matEq(cur, prev)) {
        const invPrev = matInverse(prev)
        const delta = matMul(cur, invPrev) // maps old-canvas to new-canvas
        deltas[id] = delta
        prevLayerMatRef.current[id] = cur
      }
    }
    const ids = Object.keys(deltas)
    if (!ids.length) return
    // Move 2-layer align points
    if (ids.includes(alignBaseId) || ids.includes(alignTargetId)) {
      setAlignPoints(prev => {
        let changed = false
        let base = prev.base, target = prev.target
        if (ids.includes(alignBaseId) && base && base.length) {
          const D = deltas[alignBaseId]
          base = base.map(p => matMulPoint(D, p))
          changed = true
        }
        if (ids.includes(alignTargetId) && target && target.length) {
          const D = deltas[alignTargetId]
          target = target.map(p => matMulPoint(D, p))
          changed = true
        }
        return changed ? { base, target } : prev
      })
    }
    // Move multi-layer labeled points
    setPerLayerAlignPoints(prev => {
      let touched = false
      const next = { ...prev }
      for (const lid of ids) {
        const D = deltas[lid]
        const pts = next[lid]
        if (!pts) continue
        const np = { ...pts }
        if (np.p1) np.p1 = matMulPoint(D, np.p1)
        if (np.p2) np.p2 = matMulPoint(D, np.p2)
        next[lid] = np
        touched = true
      }
      return touched ? next : prev
    })
  }, [layerTransforms, layers, alignBaseId, alignTargetId])

  return (
    <div className="fixed inset-0 z-50 bg-white">
      <div className="h-12 flex items-center justify-between px-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={onClose}>Đóng</button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <button className="btn-secondary inline-flex items-center" onClick={printComposite} title="In ra PDF (qua trình duyệt)"><PrinterIcon className="h-5 w-5"/></button>
          {projectId && (
            <button className="btn-primary inline-flex items-center" onClick={()=>{ 
              const a=(saveArea||defaultArea||areaOptions?.[0]||'').trim(); 
              if (a) { setSaveArea(a); setSaveName(`${a} Bản vẽ phối hợp`) }
              setSaveOpen(true) 
            }} title="Lưu bản vẽ phối hợp">
              <DocumentArrowDownIcon className="h-5 w-5"/>
            </button>
          )}
          <button className="btn-secondary" onClick={() => setZoom(z => clamp(z*0.9, 0.2, 6))}>-</button>
          <div className="px-2 text-sm">{Math.round(zoom*100)}%</div>
          <button className="btn-secondary" onClick={() => setZoom(z => clamp(z*1.1, 0.2, 6))}>+</button>
          <div className="w-px h-6 bg-gray-200 mx-2" />
          <button className="btn-secondary" title="Xoay trái" onClick={() => setRotation(r => (r + 270) % 360)}>↺</button>
          <button className="btn-secondary" title="Xoay phải" onClick={() => setRotation(r => (r + 90) % 360)}>↻</button>
          <button className="btn-secondary inline-flex items-center" title="Đặt lại góc & thu phóng" onClick={() => { setRotation(0); if (!autoFit) { setPan({x:0,y:0}); setZoom(1) } else { /* autoFit effect will handle */ } }}>
            <ArrowPathIcon className="h-5 w-5"/>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-2" />
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={layerMoveMode} onChange={(e)=>setLayerMoveMode(e.target.checked)} disabled={!activeLayerId || !!layerLocks[activeLayerId]} /> Di chuyển
              </label>
              <div className="flex items-center gap-1 ml-1">
                <button className="btn-secondary" title="Xoay lớp trái 1°" disabled={!activeLayerId || !!layerLocks[activeLayerId]} onClick={()=>{
                  if (!activeLayerId || layerLocks[activeLayerId]) return
                  const base = layerTransforms[activeLayerId] || [1,0,0,1,0,0]
                  const ang = -Math.PI/180
                  const cos = Math.cos(ang), sin = Math.sin(ang)
                  const a = base[0]*cos + base[1]*sin
                  const b = -base[0]*sin + base[1]*cos
                  const c = base[2]*cos + base[3]*sin
                  const d = -base[2]*sin + base[3]*cos
                  setLayerTransforms(prev=>({ ...prev, [activeLayerId]: [a,b,c,d, base[4]||0, base[5]||0] }))
                }}>⟲</button>
                <button className="btn-secondary" title="Xoay lớp phải 1°" disabled={!activeLayerId || !!layerLocks[activeLayerId]} onClick={()=>{
                  if (!activeLayerId || layerLocks[activeLayerId]) return
                  const base = layerTransforms[activeLayerId] || [1,0,0,1,0,0]
                  const ang = Math.PI/180
                  const cos = Math.cos(ang), sin = Math.sin(ang)
                  const a = base[0]*cos + base[1]*sin
                  const b = -base[0]*sin + base[1]*cos
                  const c = base[2]*cos + base[3]*sin
                  const d = -base[2]*sin + base[3]*cos
                  setLayerTransforms(prev=>({ ...prev, [activeLayerId]: [a,b,c,d, base[4]||0, base[5]||0] }))
                }}>⟳</button>
              </div>
              <div className="w-px h-6 bg-gray-200 mx-2" />
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={drawMode} onChange={(e)=>setDrawMode(e.target.checked)} /> Đánh dấu
          </label>
          <label className="inline-flex items-center gap-2 text-sm ml-3">
                <input type="checkbox" checked={cropMode} onChange={(e)=>{ setCropMode(e.target.checked); if(!e.target.checked) setCropDrag(null) }} /> Cắt khung
          </label>
              {cropMode && (
                <label className="inline-flex items-center gap-2 text-sm ml-2">
                  <input type="checkbox" checked={cropScopeActiveOnly} onChange={(e)=>setCropScopeActiveOnly(e.target.checked)} /> Chỉ lớp này
                </label>
              )}
          <label className="inline-flex items-center gap-2 text-sm ml-3">
            <input type="checkbox" checked={selectMode} onChange={(e)=>{ setSelectMode(e.target.checked); if (!e.target.checked) clearSelection() }} /> Chọn/Xóa
          </label>
          {selectedIds.size > 0 && (
            <>
              <button className="btn-danger" onClick={deleteSelected}>Xóa đã chọn ({selectedIds.size})</button>
              <button className="btn-secondary" onClick={clearSelection}>Bỏ chọn</button>
            </>
          )}
          {cropMode && (
            <>
              <button className="btn-primary" onClick={commitCrop}>Lưu cắt</button>
              <button className="btn-secondary" onClick={() => { setCropMode(false) }}>Hủy</button>
            </>
          )}
          {cropRect && !cropMode && (
            <button className="btn-secondary" onClick={() => setCropRect(null)}>Xóa cắt</button>
          )}
          {originalRenderedRef.current && (
            <button className="btn-secondary" onClick={restoreOriginal}>Khôi phục ảnh gốc</button>
          )}
          {/* Align UI toggle */}
          <button
            className={`btn-secondary ml-2 ${alignMode ? 'ring-2 ring-sky-400' : ''}`}
            title="Lồng ghép bản vẽ"
            onClick={() => { const next = !alignMode; setAlignMode(next); if(!next){ setAlignPicking(null); resetAlignPoints() } }}
          >Lồng ghép</button>
          {/* Ẩn chức năng và chú dẫn phát hiện xung đột theo yêu cầu */}
        </div>
      </div>

      <div className="flex h-[calc(100vh-3rem)]">
        <div className="w-72 border-r border-gray-200 p-3 overflow-auto">
          <div className="text-sm font-semibold mb-2">Lớp</div>
          {layers.map(l => (
            <div key={l.id} className="mb-3 p-2 rounded border border-gray-200">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!visible[l.id]} onChange={(e)=>{
                  const checked = e.target.checked
                  setVisible(prev => {
                    const nv = { ...prev, [l.id]: checked }
                    if (checked) {
                      setActiveLayerId(l.id)
                    } else if (activeLayerId === l.id) {
                      const nextL = layers.find(x => nv[x.id])
                      setActiveLayerId(nextL ? nextL.id : null)
                    }
                    return nv
                  })
                }} />
                <span className="inline-flex items-center gap-2 cursor-pointer" onClick={()=>setActiveLayerId(l.id)}>
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorOf(l.id) }} />
                  {shortName(l.name)}
                </span>
              </label>
              <div className="mt-2">
                <input type="range" min={0} max={100} value={Math.round((opacity[l.id]||0)*100)} onChange={(e)=>setOpacity(o=>({...o, [l.id]: Number(e.target.value)/100}))} className="w-full" />
              </div>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <span>Độ mờ: {Math.round((opacity[l.id]||0)*100)}%</span>
                {activeLayerId === l.id && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px]" style={{ borderColor: colorOf(l.id), color: colorOf(l.id) }}>Đang thao tác</span>
                )}
                {layerLocks[l.id] && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] border-gray-300 text-gray-600">Đã khóa</span>
                )}
                <label className="ml-auto inline-flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={!!layerLocks[l.id]} onChange={(e)=>setLayerLocks(prev=>({ ...prev, [l.id]: e.target.checked }))} />
                  <span>Khóa lớp</span>
                </label>
              </div>
              <div className="text-xs text-gray-600 mt-2 flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2">
                  <span>Màu lớp</span>
                  <input
                    type="color"
                    value={colorOf(l.id)}
                    onChange={(e)=>setLayerColors(prev=>({ ...prev, [l.id]: e.target.value }))}
                    onInput={(e)=>setLayerColors(prev=>({ ...prev, [l.id]: e.target.value }))}
                    className="w-6 h-6 p-0 border rounded"
                  />
                </label>
                <label className="inline-flex items-center gap-1 ml-auto">
                  <input type="checkbox" checked={!!layerRecolor[l.id]} onChange={(e)=>setLayerRecolor(prev=>({ ...prev, [l.id]: e.target.checked }))} />
                  <span>Đổi nét đen thành màu</span>
                </label>
              </div>
              {/* Vai trò căn đa lớp: chọn trực tiếp tại danh sách lớp */}
              <div className="text-xs text-gray-600 mt-2 flex items-center justify-between gap-2">
                <span>Vai trò căn đa lớp</span>
                <select
                  className="border rounded px-1.5 py-0.5 text-xs"
                  value={primaryLayerId===l.id ? 'primary' : 'secondary'}
                  onChange={(e)=>{
                    const v = e.target.value
                    if (v === 'primary') {
                      setPrimaryWithAuto(l.id)
                    } else {
                      // nếu lớp này đang là chính mà đổi về phụ, chọn lớp đầu tiên còn lại làm chính
                      if (primaryLayerId === l.id) {
                        const firstOther = (layers||[]).find(x => x.id !== l.id)?.id || null
                        setPrimaryWithAuto(firstOther)
                      } else {
                        // giữ nguyên primary hiện tại; đảm bảo lớp này có trong tập phụ
                        setSecondaryLayerIds(prev=>{ const n=new Set(prev); n.add(l.id); return n })
                      }
                    }
                  }}
                >
                  <option value="primary">Lớp chính</option>
                  <option value="secondary">Lớp phụ</option>
                </select>
              </div>
            </div>
          ))}
          {/* hướng dẫn bị ẩn theo yêu cầu */}
        </div>

        <div className="flex-1 relative bg-gray-50 select-none">
          <div
            ref={containerRef}
            className="absolute inset-0"
            onMouseDown={startDrag}
            onMouseMove={(e)=>{
              // move/drag logic first
              moveDrag(e);
              if (drawMode) e.preventDefault();
              // Cursor feedback for alignment handles when not cropping
              if (!cropMode) {
                const el = containerRef.current
                if (!el) return
                if (alignDrag) { el.style.cursor = 'grabbing'; return }
                if (alignMode && !alignLocked) {
                  const p = toCanvasXY(e.clientX, e.clientY)
                  const tol = alignHitTolerancePx / Math.max(zoom, 0.01)
                  const overBase = !layerLocks[alignBaseId] && (alignPoints.base||[]).some(pt => Math.hypot(pt.x-p.x, pt.y-p.y) <= tol)
                  const overTarget = !overBase && !layerLocks[alignTargetId] && (alignPoints.target||[]).some(pt => Math.hypot(pt.x-p.x, pt.y-p.y) <= tol)
                  if (overBase || overTarget) { el.style.cursor = 'grab'; return }
                }
                // default
                el.style.cursor = 'default'
              }
            }}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onClick={addPoint}
          >
            <div
              className="absolute"
              style={{ left: pan.x, top: pan.y, width: mainW, height: mainH, transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: '0 0' }}
            >
              {/* Render PDF canvas layers */}
              {layers.map(l => {
                const r = rendered[l.id]
                if (!visible[l.id] || !r) return null
                const mat = layerTransforms[l.id]
                const extra = mat ? { transform: `matrix(${mat[0]}, ${mat[1]}, ${mat[2]}, ${mat[3]}, ${mat[4]}, ${mat[5]})`, transformOrigin: '0 0' } : {}
                return (
                  <div key={l.id} className="absolute left-0 top-0" style={{ opacity: opacity[l.id] ?? 0.85, ...extra }}>
                    <canvas
                      width={r.width}
                      height={r.height}
                      ref={el => {
                        if (el && r.canvas) {
                          const ctx = el.getContext('2d')
                          ctx.clearRect(0,0,el.width,el.height)
                          const src = layerRecolor[l.id] ? (getTintedCanvas(r.canvas, colorOf(l.id)) || r.canvas) : r.canvas
                          ctx.drawImage(src,0,0)
                        }
                      }}
                    />
                  </div>
                )
              })}
              {/* Draw user segments */}
               <svg className="absolute left-0 top-0" width={mainW} height={mainH}>
                {layers.map(l => (segments[l.id]||[]).map((s, idx) => {
                  const sel = isSelected(l.id, s)
                  return (
                    <line key={(s.id||idx)+'-'+l.id} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y}
                          stroke={sel ? '#e11d48' : colorOf(l.id)}
                          strokeWidth={sel ? 3 : 2}
                          strokeDasharray={sel ? '4 3' : undefined} />
                  )
                }))}
                {/* Pending point preview */}
                {pendingPoint && <circle cx={pendingPoint.x} cy={pendingPoint.y} r={3} fill="#f00" />}
                {/* Align pick points preview (draggable handles) */}
                  {alignMode && (()=>{
                    const showBase = !(hideOtherLayerPoints && alignPicking==='target')
                    if (!showBase) return null
                    return (alignPoints.base || []).map((p,i)=>{
                  const r = Math.max(2, alignHandleSizePx/2)
                  const labelDx = r + 3
                  const labelDy = r + 3
                  return (
                    <g key={'b'+i}>
                      <circle cx={p.x} cy={p.y} r={r} fill={colorOf(alignBaseId)} />
                      <text x={p.x+labelDx} y={p.y-labelDy} fontSize={10} fill={colorOf(alignBaseId)}>{i+1}</text>
                    </g>
                    )
                  })})()}
                  {alignMode && (()=>{
                    const showTarget = !(hideOtherLayerPoints && alignPicking==='base')
                    if (!showTarget) return null
                    return (alignPoints.target || []).map((p,i)=>{
                  const s = Math.max(4, alignHandleSizePx)
                  const labelDx = s/2 + 3
                  const labelDy = s/2 + 3
                  return (
                    <g key={'t'+i}>
                      <rect x={p.x - s/2} y={p.y - s/2} width={s} height={s} fill={colorOf(alignTargetId)} />
                      <text x={p.x+labelDx} y={p.y-labelDy} fontSize={10} fill={colorOf(alignTargetId)}>{i+1}</text>
                    </g>
                    )
                  })})()}
                  {/* Multi-layer labeled points (p1 circle, p2 square). Optionally hide others */}
                  {alignMode && (()=>{
                    const ids = hideOtherLayerPoints && activeLayerId ? [activeLayerId] : layers.map(l=>l.id)
                    const nodes = []
                    for (const lid of ids) {
                      const pts = perLayerAlignPoints[lid] || {}
                      const col = colorOf(lid)
                      if (pts.p1) {
                        const r = Math.max(2, alignHandleSizePx/2)
                        nodes.push(
                          <g key={'p1-'+lid}>
                            <circle cx={pts.p1.x} cy={pts.p1.y} r={r} fill={col} />
                            <text x={pts.p1.x + r + 3} y={pts.p1.y - (r + 3)} fontSize={10} fill={col}>1</text>
                          </g>
                        )
                      }
                      if (pts.p2) {
                        const s = Math.max(4, alignHandleSizePx)
                        nodes.push(
                          <g key={'p2-'+lid}>
                            <rect x={pts.p2.x - s/2} y={pts.p2.y - s/2} width={s} height={s} fill={col} />
                            <text x={pts.p2.x + s/2 + 3} y={pts.p2.y - (s/2 + 3)} fontSize={10} fill={col}>2</text>
                          </g>
                        )
                      }
                    }
                    return nodes
                  })()}
                {/* Crop overlay: dim outside cropRect */}
                {cropRect && (
                  <g>
                    <path
                      d={`M0 0 H ${mainW} V ${mainH} H 0 Z M ${cropRect.x} ${cropRect.y} H ${cropRect.x + cropRect.w} V ${cropRect.y + cropRect.h} H ${cropRect.x} Z`}
                      fill={cropMode ? 'rgba(0,0,0,0.35)' : '#ffffff'}
                      fillRule="evenodd"
                    />
                    <rect x={cropRect.x} y={cropRect.y} width={cropRect.w} height={cropRect.h} fill="none" stroke="#22c55e" strokeDasharray="6 4" strokeWidth={2} />
                    {/* Handles */}
                    {cropMode && (() => {
                      const hs = 8
                      const pts = [
                        { k: 'nw', x: cropRect.x, y: cropRect.y },
                        { k: 'n', x: cropRect.x + cropRect.w/2, y: cropRect.y },
                        { k: 'ne', x: cropRect.x + cropRect.w, y: cropRect.y },
                        { k: 'e', x: cropRect.x + cropRect.w, y: cropRect.y + cropRect.h/2 },
                        { k: 'se', x: cropRect.x + cropRect.w, y: cropRect.y + cropRect.h },
                        { k: 's', x: cropRect.x + cropRect.w/2, y: cropRect.y + cropRect.h },
                        { k: 'sw', x: cropRect.x, y: cropRect.y + cropRect.h },
                        { k: 'w', x: cropRect.x, y: cropRect.y + cropRect.h/2 },
                      ]
                      return pts.map(p => (
                        <rect key={p.k} x={p.x - hs/2} y={p.y - hs/2} width={hs} height={hs} fill="#000" stroke="#fff" strokeWidth={1} />
                      ))
                    })()}
                  </g>
                )}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {saveOpen && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center" onClick={()=>setSaveOpen(false)}>
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-md" onClick={(e)=>e.stopPropagation()}>
            <div className="p-4 border-b text-base font-semibold">Lưu bản vẽ phối hợp</div>
            <div className="p-4 grid gap-3">
              <div className="text-sm">
                <div>Khu vực</div>
                {Array.isArray(areaOptions) && areaOptions.length > 0 ? (
                  <select className="mt-1 w-full border rounded p-2" value={saveArea} onChange={(e)=>{ const v=e.target.value; setSaveArea(v); setSaveName(`${v} Bản vẽ phối hợp`) }}>
                    {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                ) : (
                  <input className="mt-1 w-full border rounded p-2" value={saveArea} onChange={(e)=>{ const v=e.target.value; setSaveArea(v); setSaveName(`${v} Bản vẽ phối hợp`) }} placeholder="VD: Tầng 1 - Khu A" />
                )}
              </div>
              <label className="text-sm">Hạng mục
                <input className="mt-1 w-full border rounded p-2" value={saveCategory} onChange={(e)=>setSaveCategory(e.target.value)} placeholder="Phối hợp" />
              </label>
              <label className="text-sm">Tên bản vẽ (mã hiệu)
                <input className="mt-1 w-full border rounded p-2" value={saveName} onChange={(e)=>setSaveName(e.target.value)} placeholder="VD: Tầng 1 Bản vẽ phối hợp" />
              </label>
            </div>
            <div className="p-3 border-t flex justify-end gap-2">
              <button className="btn-secondary" onClick={()=>setSaveOpen(false)}>Hủy</button>
              <button className="btn-primary" disabled={saving} onClick={saveComposite}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Align drawer panel */}
      {alignMode && (
        <>
        {/* Small chip when auto-hidden or manually collapsed */}
        {((alignAutoHide && !!alignPicking) || alignPanelCollapsed) && (
          <div className="absolute right-3 top-16 z-50 select-none">
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/90 backdrop-blur shadow border border-gray-200">
              <span className="text-sm font-medium text-gray-700">Lồng ghép</span>
              {alignPicking && <span className="text-xs text-gray-500">Đang chọn điểm…</span>}
              <button className="btn-secondary btn-sm" onClick={()=>{ setAlignPanelCollapsed(false); setAlignPicking(null) }}>
                Mở bảng
              </button>
            </div>
          </div>
        )}

        {/* Main alignment panel (hidden when auto-hide during picking or collapsed) */}
        {(!((alignAutoHide && !!alignPicking) || alignPanelCollapsed)) && (
        <div className="absolute right-3 top-16 w-[380px] sm:w-[420px] z-50">
          <div className="rounded-xl overflow-hidden shadow-lg border border-gray-200 bg-white/90 backdrop-blur flex flex-col" style={{ opacity: alignPanelOpacity, maxHeight: 'calc(100vh - 6rem)' }}>
            <div className="bg-gradient-to-r from-sky-600 to-sky-500 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
              <div className="font-semibold">Lồng ghép bản vẽ</div>
              <div className="flex items-center gap-2">
                <button className="text-white/90 hover:text-white" title="Thu gọn" onClick={()=>setAlignPanelCollapsed(true)}>—</button>
                <button className="text-white/90 hover:text-white" title="Đóng" onClick={()=>{ setAlignMode(false); setAlignPicking(null); resetAlignPoints() }}>✕</button>
              </div>
            </div>
            <div className="p-4 space-y-4 text-sm overflow-auto">
              
              {/* Lock and snapping options */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={alignLocked} onChange={(e)=>{ setAlignLocked(e.target.checked); if(e.target.checked) setAlignPicking(null) }} />
                    <span>Khóa biên nhà</span>
                  </label>
                  <label className="inline-flex items-center gap-2 ml-auto">
                    <input type="checkbox" checked={alignAutoHide} onChange={(e)=>setAlignAutoHide(e.target.checked)} />
                    <span>Tự ẩn khi chọn điểm</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 flex items-center gap-3">
                    <span className="text-xs text-gray-500">Độ nhạy bắt điểm</span>
                    <input type="range" min={6} max={24} step={1} value={alignHitTolerancePx} onChange={(e)=>setAlignHitTolerancePx(Number(e.target.value)||12)} className="flex-1" />
                    <span className="text-xs text-gray-600 w-10 text-right">{alignHitTolerancePx}px</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <span className="text-xs text-gray-500">Kích thước điểm</span>
                    <input type="range" min={4} max={12} step={1} value={alignHandleSizePx} onChange={(e)=>setAlignHandleSizePx(Number(e.target.value)||6)} className="flex-1" />
                    <span className="text-xs text-gray-600 w-10 text-right">{alignHandleSizePx}px</span>
                  </div>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={snapGridEnabled} onChange={(e)=>setSnapGridEnabled(e.target.checked)} />
                    <span>Bám lưới</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Ô (px)</span>
                    <input type="number" min={1} step={1} className="border rounded px-2 py-1 w-20" value={snapGridSize} onChange={(e)=>setSnapGridSize(Math.max(1, Number(e.target.value)||10))} />
                  </div>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={snapAngleEnabled} onChange={(e)=>setSnapAngleEnabled(e.target.checked)} />
                    <span>Bám góc</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Bước (°)</span>
                    <input type="number" min={1} max={90} step={1} className="border rounded px-2 py-1 w-20" value={snapAngleStep} onChange={(e)=>setSnapAngleStep(Math.min(90, Math.max(1, Number(e.target.value)||15)))} />
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <span className="text-xs text-gray-500">Độ mờ bảng</span>
                    <input type="range" min={0.5} max={1} step={0.05} value={alignPanelOpacity} onChange={(e)=>setAlignPanelOpacity(Number(e.target.value))} className="flex-1" />
                    <span className="text-xs text-gray-600 w-10 text-right">{Math.round(alignPanelOpacity*100)}%</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-gray-700 font-medium">Chế độ căn</div>
                <div className="flex items-center gap-2">
                  <select className="border rounded px-2 py-1" value={alignPointMode} onChange={(e)=>{ const v = Number(e.target.value)||2; setAlignPointMode(v); resetAlignPoints() }}>
                    <option value={2}>2 điểm (tỉ lệ + xoay)</option>
                    <option value={3}>3 điểm (Affine)</option>
                    <option value={4}>4 điểm (Affine chính xác hơn)</option>
                  </select>
                  {/* hướng dẫn bỏ theo yêu cầu */}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-gray-700 font-medium">Hiển thị điểm</div>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={hideOtherLayerPoints} onChange={(e)=>setHideOtherLayerPoints(e.target.checked)} />
                  <span>Chỉ hiển thị điểm của lớp đang thao tác</span>
                </label>
              </div>
              <div className="space-y-1">
                <div className="text-gray-700 font-medium">1) Chọn lớp chuẩn</div>
                <div className="flex items-center gap-2">
                  <select className="border rounded px-2 py-1 flex-1" value={alignBaseId||''} onChange={(e)=>{ setAlignBaseId(e.target.value); resetAlignPoints() }}>
                    {layers.map(l=>(<option key={l.id} value={l.id}>{shortName(l.name)}</option>))}
                  </select>
                  <span className="inline-flex items-center gap-1 min-w-[20px] justify-center">
                    <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: colorOf(alignBaseId) }} />
                  </span>
                  <button className={`btn-secondary ${alignPicking==='base'?'ring-2 ring-sky-400':''}`} disabled={alignLocked || !!layerLocks[alignBaseId]} onClick={()=>!(alignLocked || layerLocks[alignBaseId]) && setAlignPicking(p=>p==='base'?null:'base')}>Chọn điểm</button>
                  <span className="text-xs text-gray-500">{alignPoints.base.length}/{Math.min(alignPointMode,4)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-gray-700 font-medium">2) Chọn lớp cần ghép</div>
                <div className="flex items-center gap-2">
                  <select className="border rounded px-2 py-1 flex-1" value={alignTargetId||''} onChange={(e)=>{ setAlignTargetId(e.target.value); resetAlignPoints() }}>
                    {layers.map(l=>(<option key={l.id} value={l.id}>{shortName(l.name)}</option>))}
                  </select>
                  <span className="inline-flex items-center gap-1 min-w-[20px] justify-center">
                    <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: colorOf(alignTargetId) }} />
                  </span>
                  <button className={`btn-secondary ${alignPicking==='target'?'ring-2 ring-rose-400':''}`} disabled={alignLocked || !!layerLocks[alignTargetId]} onClick={()=>!(alignLocked || layerLocks[alignTargetId]) && setAlignPicking(p=>p==='target'?null:'target')}>Chọn điểm</button>
                  <span className="text-xs text-gray-500">{alignPoints.target.length}/{Math.min(alignPointMode,4)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-gray-700 font-medium">3) Thực hiện</div>
                <div className="flex items-center gap-2">
                  <button className="btn-primary flex-1" disabled={!alignBaseId || !alignTargetId || alignBaseId===alignTargetId || !!layerLocks[alignTargetId] || alignPoints.base.length<Math.min(alignPointMode,4) || alignPoints.target.length<Math.min(alignPointMode,4)} onClick={applyAlignment}>Căn lớp</button>
                  <button className="btn-secondary" onClick={resetAlignPoints}>Xóa điểm</button>
                </div>
                {alignTargetId && layerTransforms[alignTargetId] && (
                  <div className="flex items-center gap-2">
                    <button className="btn-secondary flex-1" disabled={!!layerLocks[alignTargetId]} onClick={()=>clearLayerTransform(alignTargetId)}>Hủy căn ({shortName(layers.find(l=>l.id===alignTargetId)?.name)||'lớp'})</button>
                  </div>
                )}
              </div>

              {/* Multi-layer alignment block */}
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <div className="text-gray-700 font-medium">Căn đa lớp theo 2 điểm (1 = gốc, 2 = hướng)</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Điểm:</span>
                  <button className={`btn-secondary btn-sm ${multiAlignPickLabel==='p1'?'ring-2 ring-sky-400':''}`} onClick={()=>setMultiAlignPickLabel(p=>p==='p1'?null:'p1')}>Chọn điểm 1</button>
                  <button className={`btn-secondary btn-sm ${multiAlignPickLabel==='p2'?'ring-2 ring-rose-400':''}`} onClick={()=>setMultiAlignPickLabel(p=>p==='p2'?null:'p2')}>Chọn điểm 2</button>
                  {multiAlignPickLabel && <span className="text-xs text-gray-500">(Nhấp vào bản vẽ để đặt {multiAlignPickLabel==='p1'?'điểm 1':'điểm 2'})</span>}
                </div>
                <div>
                  <div className="mb-1 text-sm">Lớp chính</div>
                  <select className="border rounded px-2 py-1 w-full" value={primaryLayerId||''} onChange={(e)=>setPrimaryWithAuto(e.target.value)}>
                    {layers.map(l=> (<option key={l.id} value={l.id}>{shortName(l.name)}</option>))}
                  </select>
                </div>
                <div>
                  <div className="mb-1 text-sm">Lớp phụ</div>
                  <div className="grid grid-cols-1 gap-1 max-h-36 overflow-auto pr-1">
                    {layers.map(l => (
                      <label key={l.id} className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" disabled={l.id===primaryLayerId} checked={secondaryLayerIds.has(l.id)} onChange={(e)=>{
                          setSecondaryLayerIds(prev => { const n=new Set(prev); if(e.target.checked) n.add(l.id); else n.delete(l.id); return n })
                        }} />
                        <span className="inline-flex items-center gap-2"><span className="inline-block w-3 h-3 rounded" style={{backgroundColor: colorOf(l.id)}}/> {shortName(l.name)}</span>
                      </label>
                    ))}
                  </div>
                  {/* hint removed as requested */}
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-primary flex-1" onClick={() => {
                    // Validate points
                    const basePts = perLayerAlignPoints[primaryLayerId] || {}
                    if (!basePts.p1 || !basePts.p2) return
                    const selected = Array.from(secondaryLayerIds).filter(id => !layerLocks[id])
                    if (!selected.length) return
                    setLayerTransforms(prev => {
                      const next = { ...prev }
                      for (const sid of selected) {
                        const sp = perLayerAlignPoints[sid] || {}
                        if (!sp.p1 || !sp.p2) continue
                        const mat = computeSimilarity([basePts.p1, basePts.p2], [sp.p1, sp.p2])
                        if (mat) next[sid] = mat
                      }
                      return next
                    })
                  }}>Áp dụng cho lớp phụ</button>
                  <button className="btn-secondary" onClick={()=>{ setPerLayerAlignPoints({}); setSecondaryLayerIds(new Set()); }}>Xóa điểm đa lớp</button>
                </div>
                {/* guidance removed as requested */}
              </div>
              {/* help block removed as requested */}
            </div>
          </div>
        </div>
        )}
        </>
      )}
    </div>
  )
}

export default PdfLayerViewer
