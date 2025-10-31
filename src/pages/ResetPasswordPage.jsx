import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

// Trang đặt lại mật khẩu sau khi người dùng click link trong email Supabase
// Supabase sẽ redirect tới /reset-password với access token trong URL hash
// Người dùng nhập mật khẩu mới và xác nhận để cập nhật
const ResetPasswordPage = () => {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password || password.length < 6) {
      toast.error('Mật khẩu phải tối thiểu 6 ký tự')
      return
    }
    if (password !== confirm) {
      toast.error('Mật khẩu xác nhận không khớp')
      return
    }
    setLoading(true)
    try {
      await updatePassword(password)
      toast.success('Cập nhật mật khẩu mới thành công. Vui lòng đăng nhập lại.')
      window.location.href = '/login'
    } catch (error) {
      toast.error('Lỗi cập nhật: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 space-y-6">
        <h1 className="text-xl font-semibold text-gray-900 text-center">Đặt lại mật khẩu</h1>
        <p className="text-sm text-gray-600 text-center">Nhập mật khẩu mới cho tài khoản của bạn.</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">Mật khẩu mới</label>
            <input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required className="mt-1 input" placeholder="Mật khẩu mới" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Xác nhận mật khẩu</label>
            <input type={showPassword?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} required className="mt-1 input" placeholder="Nhập lại mật khẩu" />
          </div>
          <div className="flex items-center space-x-2">
            <input id="showpass" type="checkbox" className="h-4 w-4" checked={showPassword} onChange={()=>setShowPassword(!showPassword)} />
            <label htmlFor="showpass" className="text-sm text-gray-700">Hiện mật khẩu</label>
          </div>
          <button type="submit" disabled={loading} className="w-full btn-primary disabled:opacity-50">{loading?'Đang cập nhật...':'Cập nhật mật khẩu'}</button>
          <div className="text-center">
            <a href="/login" className="text-sm text-primary-600 hover:underline">Quay về đăng nhập</a>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ResetPasswordPage
