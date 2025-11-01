import React, { useState, useEffect } from 'react'
import supabaseLib from '../lib/supabase'

const { supabase } = supabaseLib
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const CompanyLogo = ({ size = 'md', showText = false, className = '' }) => {
  const { profile } = useAuth()
  const [logoConfig, setLogoConfig] = useState({
    type: 'text',
    imagePath: null,
    fallbackText: 'PM',
    imageAlt: 'Logo công ty'
  })
  const [companyName, setCompanyName] = useState('QLDA')
  const [logoError, setLogoError] = useState(false)
  const [uploading, setUploading] = useState(false)

  const isManager = profile?.role === 'manager'

  // Size classes - Logo 40x40 cho login page
  const sizeClasses = {
    xs: 'h-8 w-8',        // Sidebar mobile (32px)
    sm: 'h-12 w-12',      // Sidebar desktop (48px)
    '2x': 'h-16 w-16',    // Header double size (64px)
    md: 'h-40 w-40',      // Login page - 40x40 Tailwind units (160px)
    lg: 'h-40 w-40',      // 40x40 (160px)
    xl: 'h-40 w-40'       // 40x40 (160px)
  }

  const textSizeClasses = {
    xs: 'text-xs',        // Sidebar text nhỏ
    sm: 'text-sm',        // Sidebar text vừa
    '2x': 'text-base',    // Header double size fallback text
    md: 'text-6xl',       // Login page text
    lg: 'text-6xl',       // Text lớn
    xl: 'text-6xl'        // Text lớn
  }

  useEffect(() => {
    loadCompanySettings()
  }, [])

  const loadCompanySettings = async () => {
    try {
      // Use RPC to avoid triggering recursive profile policies via implicit joins
      const { data, error } = await supabase.rpc('get_system_settings', { keys: ['company_logo', 'company_name'] })
      if (error) {
        if (error.code === '42P17') {
          console.warn('Bỏ qua lỗi recursion RLS khi load company settings – dùng fallback mặc định')
          return
        }
        throw error
      }
      const rows = Array.isArray(data) ? data : []
      for (const row of rows) {
        if (row.key === 'company_logo' && row.value) setLogoConfig(row.value)
        if (row.key === 'company_name' && row.value) setCompanyName(row.value)
      }
    } catch (error) {
      console.error('Error loading company settings:', error)
    }
  }

  const handleLogoClick = () => {
    if (!isManager) {
      toast.error('Chỉ Manager mới có quyền thay đổi logo!')
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (file) {
        await uploadLogo(file)
      }
    }
    input.click()
  }

  const uploadLogo = async (file) => {
    if (!isManager) return

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Kích thước file không được vượt quá 2MB!')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ chấp nhận file ảnh!')
      return
    }

    setUploading(true)
    const loadingToast = toast.loading('Đang tải logo lên...')

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `logo-${Date.now()}.${fileExt}`
      const filePath = `logos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath)

      const publicUrl = urlData.publicUrl

      // Update system_settings
      const newLogoConfig = {
        type: 'image',
        imagePath: publicUrl,
        fallbackText: logoConfig.fallbackText,
        imageAlt: 'Logo công ty'
      }

      const { error: updateError } = await supabase
        .from('system_settings')
        .update({ value: newLogoConfig })
        .eq('key', 'company_logo')

      if (updateError) throw updateError

      setLogoConfig(newLogoConfig)
      setLogoError(false)
      toast.success('Logo đã được cập nhật!', { id: loadingToast })
    } catch (error) {
      console.error('Error uploading logo:', error)
      toast.error('Lỗi khi tải logo: ' + error.message, { id: loadingToast })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={`flex items-center ${className}`}>
      <div
        className={`${sizeClasses[size]} bg-primary-600 rounded-lg flex items-center justify-center shadow-lg overflow-hidden ${
          isManager ? 'cursor-pointer hover:opacity-80 transition-opacity group relative' : ''
        }`}
        onClick={handleLogoClick}
        title={isManager ? 'Click để thay đổi logo' : 'Logo công ty'}
      >
        {logoConfig.type === 'image' && logoConfig.imagePath && !logoError ? (
          <img
            src={logoConfig.imagePath}
            alt={logoConfig.imageAlt}
            className="h-full w-full object-contain p-1"
            onError={() => setLogoError(true)}
          />
        ) : (
          <span className={`text-white font-bold ${textSizeClasses[size]}`}>
            {logoConfig.fallbackText}
          </span>
        )}

        {/* Overlay for managers */}
        {isManager && (
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
            <svg
              className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
        )}
      </div>

      {showText && (
        <div className="ml-3">
          <h1 className="text-lg font-semibold text-gray-900">{companyName}</h1>
          <p className="text-xs text-gray-500">Quản lý dự án</p>
        </div>
      )}
    </div>
  )
}

export default CompanyLogo
