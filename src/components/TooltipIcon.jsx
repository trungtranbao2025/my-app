import React from 'react'

export default function TooltipIcon({ label, children, className = '', placement = 'top' }) {
  // Simple CSS-only tooltip using Tailwind group-hover
  const placeCls = placement === 'top'
    ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
    : placement === 'right'
      ? 'left-full top-1/2 -translate-y-1/2 ml-2'
      : placement === 'left'
        ? 'right-full top-1/2 -translate-y-1/2 mr-2'
        : 'top-full left-1/2 -translate-x-1/2 mt-2'

  return (
    <span className={`relative inline-flex items-center group ${className}`}>
      {children}
      {label && (
        <span className={`pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow group-hover:block ${placeCls}`}>
          {label}
        </span>
      )}
    </span>
  )
}
