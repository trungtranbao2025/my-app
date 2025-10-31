import React from 'react'

const LoadingSpinner = ({ size = 'medium', message = 'Đang tải...' }) => {
  
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8', 
    large: 'h-12 w-12'
  }

  // Đã bỏ nút Reset: giao diện chỉ hiển thị spinner + thông điệp

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-primary-600 ${sizeClasses[size]}`}></div>
      {message && (
        <p className="mt-3 text-sm text-gray-600">{message}</p>
      )}
      
      {/* Nút reset đã được loại bỏ theo yêu cầu */}
    </div>
  )
}

export default LoadingSpinner
