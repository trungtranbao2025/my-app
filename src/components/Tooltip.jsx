import React from 'react'

/**
 * Lightweight tooltip using Tailwind only (no portal/state libs).
 * Usage:
 *  <Tooltip text="Nội dung tooltip"><button>...</button></Tooltip>
 */
const Tooltip = ({ text, position = 'top', children }) => {
  const posClass = position === 'bottom'
    ? 'left-1/2 -translate-x-1/2 top-full mt-2'
    : position === 'left'
      ? 'right-full mr-2 top-1/2 -translate-y-1/2'
      : position === 'right'
        ? 'left-full ml-2 top-1/2 -translate-y-1/2'
        : 'left-1/2 -translate-x-1/2 bottom-full mb-2' // top

  return (
    <span className="relative inline-flex group">
      {children}
      <span className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg ring-1 ring-black/10 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${posClass}`}>
        {text}
      </span>
    </span>
  )
}

export default Tooltip
