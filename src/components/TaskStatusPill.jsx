import React from 'react'

// A compact, read-only status pill showing label, days chip, and a small days bar
// Props:
// - task: { status, is_completed, due_date }
// - comparisonDate?: string | Date (defaults to today)
// - className?: string
// - size?: 'normal' | 'compact' (compact reduces paddings/heights)
export default function TaskStatusPill({ task, comparisonDate, className = '', size = 'compact' }) {
  const compDate = comparisonDate ? new Date(comparisonDate) : new Date()

  const getDaysRemaining = (dueDate, isCompleted) => {
    if (isCompleted || !dueDate) return null
    const due = new Date(dueDate)
    const cmp = new Date(compDate)
    due.setHours(0, 0, 0, 0)
    cmp.setHours(0, 0, 0, 0)
    const diffTime = due - cmp
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getStatusInfo = (t) => {
    const isCompleted = t?.is_completed === true || t?.status === 'completed' || (t?.progress_percent != null && Number(t.progress_percent) >= 100)
    if (isCompleted) {
      return { label: 'Hoàn thành', color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200', daysRemaining: null }
    }
    const daysRemaining = getDaysRemaining(t?.due_date, isCompleted)
    if (daysRemaining === null) {
      return { label: 'Chưa có hạn', color: 'bg-gray-400', textColor: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', daysRemaining: null }
    }
    if (daysRemaining < 0) {
      return { label: 'Trễ hạn', color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200', daysRemaining }
    }
    if (daysRemaining === 0) {
      return { label: 'Cảnh báo', color: 'bg-orange-500', textColor: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', daysRemaining }
    }
    return { label: 'Đang thực hiện', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', daysRemaining }
  }

  const renderDaysBar = (daysRemaining) => {
    if (daysRemaining === null) return null
    const maxDays = 30
    const absRemaining = Math.abs(daysRemaining)
    const percentage = Math.min((absRemaining / maxDays) * 100, 100)

    if (daysRemaining < 0) {
      return (
        <div className={`flex items-center ${size === 'compact' ? 'h-1.5' : 'h-2'}`}>
          <div className={`flex-1 flex justify-end bg-gray-100 rounded-l ${size === 'compact' ? 'h-1.5' : 'h-2'} relative overflow-hidden`}>
            <div className="h-full bg-gradient-to-l from-red-600 to-red-400 rounded-l transition-all duration-300" style={{ width: `${percentage}%` }}>
              <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent"></div>
            </div>
          </div>
          <div className={`${size === 'compact' ? 'h-2' : 'h-3'} w-px bg-gray-700`}></div>
          <div className={`flex-1 bg-gray-100 rounded-r ${size === 'compact' ? 'h-1.5' : 'h-2'}`}></div>
        </div>
      )
    }
    if (daysRemaining === 0) {
      return (
        <div className={`flex items-center ${size === 'compact' ? 'h-1.5' : 'h-2'}`}>
          <div className={`flex-1 bg-gray-100 rounded-l ${size === 'compact' ? 'h-1.5' : 'h-2'}`}></div>
          <div className={`${size === 'compact' ? 'h-2' : 'h-3'} w-1 bg-orange-500 rounded-sm animate-pulse shadow`}></div>
          <div className={`flex-1 bg-gray-100 rounded-r ${size === 'compact' ? 'h-1.5' : 'h-2'}`}></div>
        </div>
      )
    }
    const barColor = daysRemaining <= 7 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 'bg-gradient-to-r from-green-400 to-green-600'
    return (
      <div className={`flex items-center ${size === 'compact' ? 'h-1.5' : 'h-2'}`}>
        <div className={`flex-1 bg-gray-100 rounded-l ${size === 'compact' ? 'h-1.5' : 'h-2'}`}></div>
        <div className={`${size === 'compact' ? 'h-2' : 'h-3'} w-px bg-gray-700`}></div>
        <div className={`flex-1 bg-gray-100 rounded-r ${size === 'compact' ? 'h-1.5' : 'h-2'} relative overflow-hidden`}>
          <div className={`h-full ${barColor} rounded-r transition-all duration-300`} style={{ width: `${percentage}%` }}>
            <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent"></div>
          </div>
        </div>
      </div>
    )
  }

  const info = getStatusInfo(task || {})

  return (
    <div className={`inline-block ${className}`}>
      <div className={`rounded-xl border-2 ${info.bgColor} ${info.borderColor} ${size === 'compact' ? 'p-1.5' : 'p-2'} w-full min-w-[150px] ${size === 'compact' ? 'min-h-[40px]' : 'min-h-[48px]'}`}>
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <div className={`w-1 h-1 ${info.color} rounded-full animate-pulse flex-shrink-0`}></div>
            <span className={`text-[10px] sm:text-[11px] font-bold ${info.textColor} uppercase tracking-tight truncate leading-tight text-left`}>
              {info.label}
            </span>
          </div>
          {info.daysRemaining !== null && (
            <span className={`text-[9px] sm:text-[10px] font-extrabold ${info.textColor} tabular-nums px-1 py-0.5 rounded flex-shrink-0 whitespace-nowrap leading-tight ${info.daysRemaining < 0 ? 'bg-red-100' : info.daysRemaining === 0 ? 'bg-orange-100' : 'bg-yellow-100'}`}>
              {info.daysRemaining === 0 ? 'NAY' : info.daysRemaining < 0 ? `TRỄ ${Math.abs(info.daysRemaining)}` : `${info.daysRemaining}`}
            </span>
          )}
        </div>
        <div className="bg-white/70 rounded px-1 py-0.5">
          {info.daysRemaining !== null ? renderDaysBar(info.daysRemaining) : (
            <div className={`${size === 'compact' ? 'h-1.5' : 'h-2'}`}></div>
          )}
        </div>
      </div>
    </div>
  )
}
