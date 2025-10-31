import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * MultiSelectChips
 * A lightweight multi-select with search, dropdown, and removable chips.
 *
 * Props:
 * - options: Array<{ value: string, label: string }>
 * - value: string[] (selected values)
 * - onChange: (values: string[]) => void
 * - placeholder?: string
 * - disabled?: boolean
 * - className?: string
 */
export default function MultiSelectChips({ options = [], value = [], onChange, placeholder = 'Chọn...', disabled = false, className = '' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [query, options])

  const toggle = () => { if (!disabled) setOpen((o) => !o) }

  const isSelected = (v) => value.includes(v)

  const onToggleItem = (v) => {
    if (!onChange) return
    if (isSelected(v)) onChange(value.filter(x => x !== v))
    else onChange([...value, v])
  }

  const remove = (v) => onChange?.(value.filter(x => x !== v))

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`w-full min-h-[2.5rem] rounded-lg border px-3 py-2 text-sm flex items-center gap-2 flex-wrap bg-white ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-text'} focus-within:ring-2 focus-within:ring-cyan-500`}
        onClick={toggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') toggle() }}
      >
        {value.length === 0 && (
          <span className="text-gray-400 select-none">{placeholder}</span>
        )}
        {value.map(v => {
          const opt = options.find(o => o.value === v)
          if (!opt) return null
          return (
            <span key={v} className="inline-flex items-center gap-1 bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-1 rounded-full">
              <span className="text-xs font-medium">{opt.label}</span>
              <button
                type="button"
                className="text-cyan-700/70 hover:text-cyan-900"
                onClick={(e) => { e.stopPropagation(); remove(v) }}
                aria-label={`Remove ${opt.label}`}
              >
                ×
              </button>
            </span>
          )
        })}
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute z-50 mt-2 w-full bg-white border rounded-lg shadow-xl p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm..."
            className="w-full mb-2 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
            {filtered.length === 0 && (
              <div className="text-sm text-gray-400 px-2 py-3">Không có kết quả</div>
            )}
            {filtered.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  className="accent-cyan-600"
                  checked={isSelected(opt.value)}
                  onChange={() => onToggleItem(opt.value)}
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
