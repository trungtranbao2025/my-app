import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import supabaseLib from '../lib/supabase'

const { supabase } = supabaseLib
import { isSupabaseReachable, onNextOnline } from '../utils/network'
import toast from 'react-hot-toast'
import { BuildingOfficeIcon, PhotoIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/LoadingSpinner'

const CompanySettingsPage = () => {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [settings, setSettings] = useState({
    company_name: '',
    app_name: '',
    logo: {
      type: 'text',
      imagePath: null,
      fallbackText: 'LOGO',
      imageAlt: 'Logo công ty'
    }
  })
  const [logoPreview, setLogoPreview] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      // Avoid calling REST when unreachable; auto-retry when back online
      const reachable = await isSupabaseReachable('rest', 1200)
      if (!reachable) {
        onNextOnline(() => loadSettings())
        return
      }
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['company_name', 'app_name', 'company_logo'])

      if (error) throw error

      const newSettings = { ...settings }
      data?.forEach(setting => {
        if (setting.key === 'company_logo' && setting.value) {
          newSettings.logo = setting.value
        } else if (setting.key === 'company_name' && setting.value) {
          newSettings.company_name = setting.value
        } else if (setting.key === 'app_name' && setting.value) {
          newSettings.app_name = setting.value
        }
      })
      setSettings(newSettings)
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error('Không thể tải cài đặt: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings.company_name?.trim()) {
      toast.error('Vui lòng nhập tên công ty')
      return
    }
    if (!settings.app_name?.trim()) {
      toast.error('Vui lòng nhập tên phần mềm')
      return
    }

    try {
      setSaving(true)
      const reachable = await isSupabaseReachable('rest', 1200)
      if (!reachable) {
        toast.error('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng/VPN và thử lại khi trực tuyến.')
        onNextOnline(() => handleSave())
        return
      }

      // Upsert company_name
      const { error: nameError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'company_name',
          value: settings.company_name,
          description: 'Tên công ty'
        }, {
          onConflict: 'key'
        })

      if (nameError) throw nameError

      // Upsert app_name
      const { error: appError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'app_name',
          value: settings.app_name,
          description: 'Tên phần mềm'
        }, {
          onConflict: 'key'
        })

      if (appError) throw appError

      // Upsert logo
      const { error: logoError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'company_logo',
          value: settings.logo,
          description: 'Logo công ty'
        }, {
          onConflict: 'key'
        })

      if (logoError) throw logoError

      toast.success('Lưu cài đặt thành công!')
      await loadSettings()
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Lỗi lưu cài đặt: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Kích thước file không được vượt quá 2MB')
      return
    }

    try {
      setUploading(true)
      const reachable = await isSupabaseReachable('rest', 1200)
      if (!reachable) {
        toast.error('Không thể kết nối lưu trữ. Vui lòng thử lại khi trực tuyến.')
        onNextOnline(() => {})
        return
      }

      // Delete old logo if exists
      if (settings.logo.imagePath) {
        const oldPath = settings.logo.imagePath.split('/').pop()
        await supabase.storage
          .from('company-assets')
          .remove([oldPath])
      }

      // Upload new logo
      const fileExt = file.name.split('.').pop()
      const fileName = `logo-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(fileName)

      // Update settings
      setSettings({
        ...settings,
        logo: {
          ...settings.logo,
          type: 'image',
          imagePath: urlData.publicUrl
        }
      })

      // Preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result)
      }
      reader.readAsDataURL(file)

      toast.success('Upload logo thành công!')
    } catch (error) {
      console.error('Error uploading logo:', error)
      toast.error('Lỗi upload logo: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveLogo = () => {
    setSettings({
      ...settings,
      logo: {
        type: 'text',
        imagePath: null,
        fallbackText: settings.logo.fallbackText || 'LOGO',
        imageAlt: 'Logo công ty'
      }
    })
    setLogoPreview(null)
  }

  if (loading) {
    return <LoadingSpinner />
  }

  // Check permission
  if (profile?.role !== 'manager') {
    return (
      <div className="w-full min-h-screen px-4 py-6">
        <div className="card bg-yellow-50/70 border-yellow-300">
          <p className="text-sm text-yellow-700">
            Bạn không có quyền truy cập trang này. Chỉ Quản lý mới có thể thay đổi cài đặt công ty.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Cài đặt công ty</h1>
      </div>

      {/* Settings Form */}
      <div className="card max-w-2xl space-y-6">
        {/* Company Name */}
        <div>
          <label className="label flex items-center gap-2">
            <BuildingOfficeIcon className="w-5 h-5" />
            Tên công ty *
          </label>
          <input
            type="text"
            value={settings.company_name}
            onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
            className="input"
            placeholder="Ví dụ: Công ty TNHH ABC"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Tên công ty sẽ hiển thị trên trang đăng nhập
          </p>
        </div>

        {/* App Name */}
        <div>
          <label className="label">Tên phần mềm *</label>
          <input
            type="text"
            value={settings.app_name}
            onChange={(e) => setSettings({ ...settings, app_name: e.target.value })}
            className="input"
            placeholder="Ví dụ: Hệ thống quản lý dự án"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Tên phần mềm sẽ hiển thị trên trang đăng nhập
          </p>
        </div>

        {/* Logo Fallback Text */}
        <div>
          <label className="label">Ký tự hiển thị khi không có logo</label>
          <input
            type="text"
            value={settings.logo.fallbackText}
            onChange={(e) => setSettings({
              ...settings,
              logo: { ...settings.logo, fallbackText: e.target.value }
            })}
            className="input w-32"
            placeholder="LOGO"
            maxLength="4"
          />
          <p className="text-xs text-gray-500 mt-1">
            Tối đa 4 ký tự (ví dụ: ABC, QLDA, PM)
          </p>
        </div>

        {/* Logo Upload */}
        <div>
          <label className="label flex items-center gap-2">
            <PhotoIcon className="w-5 h-5" />
            Logo công ty
          </label>
          
          {/* Current Logo Preview */}
          <div className="mb-4">
            <div className="w-32 h-32 bg-primary-600 rounded-lg flex items-center justify-center shadow-lg overflow-hidden">
              {settings.logo.type === 'image' && settings.logo.imagePath ? (
                <img
                  src={logoPreview || settings.logo.imagePath}
                  alt={settings.logo.imageAlt}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <span className="text-white font-bold text-4xl">
                  {settings.logo.fallbackText}
                </span>
              )}
            </div>
          </div>

          {/* Upload Button */}
          <div className="flex gap-2">
            <label className="btn-secondary cursor-pointer inline-flex items-center">
              <PhotoIcon className="w-5 h-5 mr-2" />
              {uploading ? 'Đang tải...' : 'Chọn logo'}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
            {settings.logo.type === 'image' && settings.logo.imagePath && (
              <button
                onClick={handleRemoveLogo}
                className="btn-danger"
                type="button"
              >
                Xóa logo
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Định dạng: JPG, PNG, GIF. Kích thước tối đa: 2MB. Khuyến nghị: 200x200px
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="card max-w-2xl">
        <h3 className="text-lg font-semibold mb-4">Xem trước trang đăng nhập</h3>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg p-8">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-auto">
            {/* Logo */}
            <div className="mx-auto h-40 w-40 bg-primary-600 rounded-lg flex items-center justify-center shadow-lg overflow-hidden">
              {settings.logo.type === 'image' && settings.logo.imagePath ? (
                <img
                  src={logoPreview || settings.logo.imagePath}
                  alt={settings.logo.imageAlt}
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <span className="text-white font-bold text-6xl">
                  {settings.logo.fallbackText}
                </span>
              )}
            </div>

            {/* Company Name */}
            <h1 className="mt-4 text-2xl font-bold text-gray-900 text-center">
              {settings.company_name || 'Tên công ty'}
            </h1>

            {/* App Name */}
            <h2 className="mt-2 text-lg font-semibold text-primary-600 text-center">
              {settings.app_name || 'Tên phần mềm'}
            </h2>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompanySettingsPage
