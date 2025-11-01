import React, { useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import supabaseLib from '../lib/supabase'

const { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } = supabaseLib
import { isSupabaseReachable, onNextOnline } from '../utils/network'

const LoginPage = () => {
  const { signIn, user, resetPassword } = useAuth()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [sendingReset, setSendingReset] = useState(false)
  
  // Company settings from database
  const [companySettings, setCompanySettings] = useState({
    logo: {
      type: 'text',
      imagePath: null,
      fallbackText: 'PM',
      imageAlt: 'Logo công ty'
    },
    companyName: 'Tên công ty',
    subtitle: 'Tên phần mềm'
  })
  const [logoError, setLogoError] = useState(false)

  // Load company settings from database
  useEffect(() => {
    loadCompanySettings()
  }, [])

  const loadCompanySettings = async () => {
    try {
      // Skip when Supabase REST is unreachable to avoid UI timeouts; retry on next online
      const reachable = await isSupabaseReachable('rest', 1200)
      if (!reachable) {
        onNextOnline(() => loadCompanySettings())
        return
      }
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['company_logo', 'company_name', 'app_name'])

      if (error) throw error

      const settings = { ...companySettings }
      data?.forEach(setting => {
        if (setting.key === 'company_logo' && setting.value) {
          settings.logo = setting.value
        } else if (setting.key === 'company_name' && setting.value) {
          settings.companyName = setting.value
        } else if (setting.key === 'app_name' && setting.value) {
          settings.subtitle = setting.value
        }
      })
      setCompanySettings(settings)
    } catch (error) {
      console.error('Error loading company settings:', error)
    }
  }

  // Redirect if already logged in
  if (user) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Quick connectivity preflight to Supabase auth before hitting signIn
      const reachable = await (async () => {
        try {
          if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
          const ctrl = new AbortController()
          const t = setTimeout(() => ctrl.abort(), 2000)
          const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
            method: 'GET',
            headers: { apikey: SUPABASE_ANON_KEY },
            mode: 'cors',
            signal: ctrl.signal,
          })
          clearTimeout(t)
          // Treat opaque as reachable to avoid false negatives behind proxies
          return res?.ok || res?.type === 'opaque'
        } catch {
          return false
        }
      })()

      if (!reachable) {
        toast.error('Không thể kết nối máy chủ xác thực. Vui lòng kiểm tra mạng/VPN hoặc thử lại sau.')
        return
      }

      await signIn(formData.email, formData.password)
      toast.success('Đăng nhập thành công!')
    } catch (error) {
      console.error('Login error:', error)
      const msg = (error?.name === 'AbortError' || String(error?.message || '').includes('aborted'))
        ? 'Kết nối tới Supabase bị gián đoạn. Vui lòng kiểm tra mạng/VPN và thử lại.'
        : ('Đăng nhập thất bại: ' + (error?.message || 'Không rõ lỗi'))
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    if (!forgotEmail) return
    setSendingReset(true)
    try {
      await resetPassword(forgotEmail)
      toast.success('Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư!')
      setShowForgot(false)
    } catch (error) {
      toast.error('Không thể gửi email: ' + error.message)
    } finally {
      setSendingReset(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Quên mật khẩu</h3>
            <p className="text-sm text-gray-600">Nhập email đã đăng ký, hệ thống sẽ gửi đường dẫn đặt lại mật khẩu.</p>
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input type="email" required value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} className="mt-1 input" placeholder="you@example.com" />
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={()=>setShowForgot(false)} className="btn-secondary px-4 py-2">Hủy</button>
                <button type="submit" disabled={sendingReset} className="btn-primary px-4 py-2 disabled:opacity-50">{sendingReset?'Đang gửi...':'Gửi email'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Header */}
          <div className="text-center">
            {/* Logo - doubled size (80x80 from 40x40) */}
            <div className="mx-auto h-80 w-80 bg-primary-600 rounded-2xl flex items-center justify-center shadow-xl overflow-hidden">
              {companySettings.logo.type === 'image' && companySettings.logo.imagePath && !logoError ? (
                <img
                  src={companySettings.logo.imagePath}
                  alt={companySettings.logo.imageAlt}
                  className="h-full w-full object-contain p-4"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="text-white font-bold text-9xl">
                  {companySettings.logo.fallbackText}
                </span>
              )}
            </div>

            {/* Tên công ty */}
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              {companySettings.companyName}
            </h1>

            {/* Tên phần mềm */}
            <h2 className="mt-2 text-lg font-semibold text-primary-600">
              {companySettings.subtitle}
            </h2>
          </div>

          {/* Form */}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 input"
                placeholder="Nhập địa chỉ email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Mật khẩu
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="input pr-10"
                  placeholder="Nhập mật khẩu"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  Ghi nhớ đăng nhập
                </label>
              </div>

              <div className="text-sm">
                <a href="#" onClick={(e)=>{e.preventDefault();setShowForgot(true); setForgotEmail(formData.email);}} className="font-medium text-primary-600 hover:text-primary-500">
                  Quên mật khẩu?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Chưa có tài khoản?{' '}
                <a href="/register" className="font-medium text-primary-600 hover:text-primary-500">
                  Liên hệ quản trị viên
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
