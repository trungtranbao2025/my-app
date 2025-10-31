import React, { useState, useEffect } from 'react'
import { Outlet, Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { clearAuthStorage } from '../utils/auth'
import { 
  HomeIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  UserCircleIcon,
  ChevronDownIcon,
  KeyIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline'
import { ClockIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from './LoadingSpinner'
import CompanyLogo from './CompanyLogo'

const Layout = () => {
  const { user, profile, signOut, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState(null)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Close profile menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!profileMenuOpen) return
      if (menuAnchorEl && !menuAnchorEl.contains(e.target)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [profileMenuOpen, menuAnchorEl])

  // Don't block UI on loading - just check if user exists
  if (!user && !loading) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Show UI immediately if user exists, even if profile is still loading
  if (!user && loading) {
    return <LoadingSpinner message="Đang xác thực..." />
  }

  const navigation = [
    { name: 'Tổng quan', href: '/dashboard', icon: HomeIcon },
    { name: 'Dự án', href: '/projects', icon: ChartBarIcon },
    { name: 'Tiến độ', href: '/progress', icon: ChartBarIcon },
    { name: 'Công việc', href: '/tasks', icon: ClipboardDocumentListIcon },
    { name: 'Nhân sự', href: '/staff', icon: UserGroupIcon },
    ...(profile?.role === 'manager' || profile?.role === 'admin' ? [
      { name: 'Cài đặt công ty', href: '/company-settings', icon: Cog6ToothIcon },
      { name: 'Cài đặt hệ thống', href: '/system-settings', icon: WrenchScrewdriverIcon },
      { name: 'Lịch sử', href: '/history', icon: ClockIcon },
      // Trang 'Luật nhắc việc' đã bị loại bỏ theo yêu cầu
    ] : [])
  ]

  const handleSignOut = async () => {
    try {
      await signOut()
      // Clear any cached data
      clearAuthStorage()
      // Force redirect to login
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Logout error:', error)
      // Force logout anyway
      clearAuthStorage()
      navigate('/login', { replace: true })
    }
  }

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <div className="min-h-screen flex flex-col bg-transparent">
      {/* Mobile menu overlay */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-white shadow-xl">
          <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200">
            <CompanyLogo size="xs" showText={true} />
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive(item.href)
                    ? 'bg-primary-100 text-primary-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Mobile user actions */}
          <div className="flex-shrink-0 border-t border-gray-200 p-4">
            <div className="flex items-center mb-3">
              <UserCircleIcon className="h-10 w-10 text-gray-400" />
              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {profile?.full_name || user?.email || 'Đang tải...'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {profile?.role === 'manager' ? 'Quản lý' : 
                   profile?.role === 'admin' ? 'Quản trị viên' : 
                   profile?.role ? 'Nhân viên' : '...'}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Link
                to="/profile"
                onClick={() => setSidebarOpen(false)}
                className="flex-1 btn-secondary text-xs py-2 text-center"
              >
                Hồ sơ
              </Link>
              <button
                onClick={() => { setSidebarOpen(false); navigate('/profile', { state: { action: 'change-password' } }) }}
                className="flex-1 btn-secondary text-xs py-2"
              >
                Đổi mật khẩu
              </button>
              <button
                onClick={handleSignOut}
                className="flex-1 btn-danger text-xs py-2"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Header with horizontal navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-cyan-100 shadow-sm">
        <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="mr-4 text-gray-500 hover:text-gray-700 lg:hidden"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          {/* Logo */}
          <div className="flex-shrink-0">
            <CompanyLogo size="2x" showText={true} />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex lg:ml-8 lg:space-x-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive(item.href)
                    ? 'bg-primary-100 text-primary-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className="mr-2 h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Right side actions (simplified) */}
          <div className="flex flex-1 justify-end items-center">
            {/* Profile dropdown */}
            <div className="relative" ref={setMenuAnchorEl}>
              <button
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-50 border border-gray-200 text-gray-700"
              
                title={profile?.full_name || user?.email}
              >
                <UserCircleIcon className="h-6 w-6 text-primary-600" />
                <span className="hidden sm:block text-sm font-medium">
                  {profile?.full_name || user?.email || 'Tài khoản'}
                </span>
                <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black/5 z-50 overflow-hidden">
                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <UserCircleIcon className="h-5 w-5 text-gray-500" />
                      Hồ sơ của tôi
                    </Link>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false)
                        navigate('/profile', { state: { action: 'change-password' } })
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <KeyIcon className="h-5 w-5 text-gray-500" />
                      Đổi mật khẩu
                    </button>
                    <div className="my-1 border-t border-gray-100" />
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      <ArrowRightOnRectangleIcon className="h-5 w-5" />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {!online && (
          <div className="w-full bg-red-600 text-white text-xs py-1 px-4 sm:px-6 lg:px-8">
            Mất kết nối Internet. Một số dữ liệu sẽ không thể tải được.
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 w-full overflow-y-auto">
        <div className="page-container px-4 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>

    </div>
  )
}

export default Layout
