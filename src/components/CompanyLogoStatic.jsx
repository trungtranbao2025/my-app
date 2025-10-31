import React, { memo } from 'react'
import { Link } from 'react-router-dom'

// Memoize CompanyLogo to avoid re-renders
const CompanyLogo = memo(({ size = 'sm', showText = false }) => {
  const sizeClasses = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24'
  }

  const textSizeClasses = {
    xs: 'text-base',
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl'
  }

  return (
    <Link to="/dashboard" className="flex items-center space-x-2 flex-shrink-0">
      <div className={`${sizeClasses[size]} flex-shrink-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md`}>
        <span className={size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-sm' : 'text-xl'}>IB</span>
      </div>
      {showText && (
        <div className="hidden sm:block">
          <div className={`${textSizeClasses[size]} font-bold text-gray-900 leading-tight`}>
            IBST BIM
          </div>
          {size !== 'xs' && (
            <div className="text-xs text-gray-500 leading-tight">
              Quản lý Dự án
            </div>
          )}
        </div>
      )}
    </Link>
  )
})

CompanyLogo.displayName = 'CompanyLogo'

export default CompanyLogo
