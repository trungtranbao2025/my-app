import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * PortalDropdown
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - anchorRef: ref to the button/anchor element
 * - width: number (px) optional
 * - children: menu content (should handle its own clicks)
 */
const PortalDropdown = ({ open, onClose, anchorRef, width = 200, children }) => {
  const menuRef = useRef(null)
  const [style, setStyle] = useState({ top: 0, left: 0, minWidth: width, transformOrigin: 'top right' })

  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef?.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const menuEl = menuRef.current
    const viewportH = window.innerHeight
    const viewportW = window.innerWidth

    // Default: drop down from top-right of anchor
    const gap = 6
    let top = rect.bottom + gap
    let left = Math.min(rect.right - width, viewportW - width - 8)
    if (left < 8) left = 8

    // If going off bottom, flip to drop-up
    const estimatedHeight = (menuEl?.offsetHeight || 240)
    if (top + estimatedHeight > viewportH - 8) {
      top = Math.max(rect.top - gap - estimatedHeight, 8)
      setStyle({ top, left, minWidth: width, transformOrigin: 'bottom right' })
    } else {
      setStyle({ top, left, minWidth: width, transformOrigin: 'top right' })
    }
  }, [open, anchorRef, width, children])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    const onScroll = () => onClose?.()
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      {/* Backdrop to capture outside clicks */}
      <div
        className="fixed inset-0 z-[9998]" 
        onMouseDown={onClose}
      />
      <div
        ref={menuRef}
        className="fixed z-[9999] bg-white rounded-xl shadow-xl ring-1 ring-gray-900/5 overflow-hidden animate-fadeIn"
        style={style}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  )
}

export default PortalDropdown
