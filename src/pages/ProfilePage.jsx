import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { UserCircleIcon, EnvelopeIcon, CalendarIcon, BriefcaseIcon, XMarkIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { formatDate } from '../utils/helpers'
import supabaseLib from '../lib/supabase'

const { supabase } = supabaseLib

const ProfilePage = () => {
  const { profile, user, updateProfile, fetchProfile } = useAuth()
  const location = useLocation()
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    birthday: profile?.birthday || ''
  })

  // Open password modal directly when navigated with state { action: 'change-password' }
  useEffect(() => {
    if (location?.state && location.state.action === 'change-password') {
      setShowPasswordModal(true)
    }
  }, [location?.state])

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-500">Đang tải thông tin...</p>
        </div>
      </div>
    )
  }

  const getRoleName = (role) => {
    const roles = {
      manager: 'Quản lý',
      admin: 'Quản trị viên',
      user: 'Nhân viên'
    }
    return roles[role] || role
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      await updateProfile({
        full_name: formData.full_name,
        birthday: formData.birthday || null
      })

      toast.success('Cập nhật thông tin thành công!')
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Lỗi khi cập nhật: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      full_name: profile?.full_name || '',
      birthday: profile?.birthday || ''
    })
    setIsEditing(false)
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    })
  }

  const handleChangePassword = async () => {
    try {
      // Validate passwords
      if (!passwordData.newPassword || !passwordData.confirmPassword) {
        toast.error('Vui lòng nhập đầy đủ thông tin')
        return
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        toast.error('Mật khẩu xác nhận không khớp')
        return
      }

      if (passwordData.newPassword.length < 6) {
        toast.error('Mật khẩu mới phải có ít nhất 6 ký tự')
        return
      }

      setSaving(true)

      // If currentPassword is provided, verify it first
      if (passwordData.currentPassword) {
        try {
          // Store current session
          const { data: sessionData } = await supabase.auth.getSession()
          const currentSession = sessionData.session
          
          // Try to sign in with current password to verify
          const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
            email: user?.email,
            password: passwordData.currentPassword
          })

          if (signInError) {
            toast.error('Mật khẩu hiện tại không đúng')
            setSaving(false)
            return
          }
          
          // Restore the original session immediately
          if (currentSession) {
            await supabase.auth.setSession(currentSession)
          }
        } catch (err) {
          console.error('Verification error:', err)
          toast.error('Không thể xác thực mật khẩu hiện tại')
          setSaving(false)
          return
        }
      }

      // Update password
      const { error, data } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (error) {
        console.error('Update password error:', error)
        throw error
      }

      console.log('Password updated successfully:', data)
      toast.success('Đổi mật khẩu thành công!')
      
      setShowPasswordModal(false)
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      
    } catch (error) {
      console.error('Error changing password:', error)
      if (error.message.includes('session')) {
        toast.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
      } else {
        toast.error('Lỗi khi đổi mật khẩu: ' + error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Thông tin cá nhân</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="text-center">
              <div className="mx-auto h-24 w-24 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <UserCircleIcon className="h-16 w-16 text-primary-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">{profile.full_name}</h2>
              <p className="text-sm text-gray-500 mt-1">{getRoleName(profile.role)}</p>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-center text-sm text-gray-600">
                  <EnvelopeIcon className="h-4 w-4 mr-2" />
                  {user?.email}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Details Card */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Thông tin chi tiết</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="input disabled:bg-gray-50"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="input bg-gray-50"
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">Email không thể thay đổi</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vai trò
                </label>
                <input
                  type="text"
                  value={getRoleName(profile.role)}
                  disabled
                  className="input bg-gray-50"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <CalendarIcon className="inline h-4 w-4 mr-1" />
                  Ngày sinh
                </label>
                <input
                  type="date"
                  name="birthday"
                  value={formData.birthday || ''}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="input disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <BriefcaseIcon className="inline h-4 w-4 mr-1" />
                  Ngày tham gia
                </label>
                <input
                  type="text"
                  value={formatDate(profile.created_at)}
                  disabled
                  className="input bg-gray-50"
                  readOnly
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn-primary w-full"
                  >
                    Chỉnh sửa thông tin
                  </button>
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="btn-secondary w-full"
                  >
                    Đổi mật khẩu
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="btn-secondary disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !formData.full_name}
                    className="btn-primary disabled:opacity-50"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Card */}
      <div className="card mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Thống kê hoạt động</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">-</p>
            <p className="text-sm text-gray-600 mt-1">Dự án tham gia</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">-</p>
            <p className="text-sm text-gray-600 mt-1">Công việc hoàn thành</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">-</p>
            <p className="text-sm text-gray-600 mt-1">Công việc đang thực hiện</p>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Đổi mật khẩu</h2>
              <button 
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                  })
                }}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mật khẩu hiện tại <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  placeholder="Nhập mật khẩu hiện tại"
                  className="input-field"
                  autoComplete="current-password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mật khẩu mới <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  className="input-field"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Xác nhận mật khẩu mới <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="Nhập lại mật khẩu mới"
                  className="input-field"
                  autoComplete="new-password"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Lưu ý:</strong> Mật khẩu mới phải có ít nhất 6 ký tự và khác với mật khẩu hiện tại. Sau khi đổi mật khẩu thành công, bạn có thể tiếp tục sử dụng hệ thống.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                  })
                }}
                disabled={saving}
                className="flex-1 btn-secondary disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleChangePassword}
                disabled={saving || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {saving ? 'Đang xử lý...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfilePage
