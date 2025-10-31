import React, { useState, useEffect } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { forceResetApp } from '../utils/resetApp'

const ResetButton = () => {
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    // Add keyboard shortcut: Ctrl+Shift+R
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault()
        handleReset()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleReset = () => {
    if (window.confirm('⚠️ Reset toàn bộ ứng dụng?\n\nTất cả dữ liệu cache và session sẽ bị xóa. Bạn sẽ cần đăng nhập lại.\n\n✅ Nhấn OK để reset\n❌ Nhấn Cancel để hủy\n\n💡 Tip: Có thể dùng phím tắt Ctrl+Shift+R')) {
      setIsResetting(true)
      forceResetApp()
    }
  }

  if (isResetting) {
    return (
      <button
        disabled
        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
      >
        <ArrowPathIcon className="h-5 w-5 animate-spin" />
        <span>Đang reset...</span>
      </button>
    )
  }

  return (
    <button
      onClick={handleReset}
      className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
      title="Reset ứng dụng (Clear cache + Reload) - Phím tắt: Ctrl+Shift+R"
    >
      <ArrowPathIcon className="h-5 w-5" />
      <span className="hidden md:inline">Reset</span>
    </button>
  )
}

export default ResetButton
