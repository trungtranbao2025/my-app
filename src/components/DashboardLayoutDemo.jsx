import React, { useState } from 'react'
import { 
  Bars3Icon, 
  XMarkIcon,
  HomeIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  ChartBarIcon,
  CogIcon,
  BellIcon
} from '@heroicons/react/24/outline'

/**
 * 🎨 Demo Layout Full Screen - Tự động điều chỉnh
 * 
 * Đặc điểm:
 * - Header cố định 64px
 * - Sidebar collapsible
 * - Main content tự động co giãn
 * - Responsive design
 * - Smooth animations
 */
export default function DashboardLayoutDemo() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Menu items
  const menuItems = [
    { icon: HomeIcon, label: 'Tổng quan', badge: null },
    { icon: ClipboardDocumentListIcon, label: 'Công việc', badge: 12 },
    { icon: UserGroupIcon, label: 'Nhân sự', badge: null },
    { icon: ChartBarIcon, label: 'Báo cáo', badge: 3 },
    { icon: CogIcon, label: 'Cài đặt', badge: null },
  ]

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* ============================================
          HEADER - Fixed Height (64px)
          ============================================ */}
      <header className="h-16 bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg z-20">
        <div className="h-full flex items-center justify-between px-6">
          {/* Left section */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title={sidebarOpen ? 'Đóng sidebar' : 'Mở sidebar'}
            >
              {sidebarOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
            <h1 className="text-xl font-bold">📊 Phần mềm quản lý</h1>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-4">
            <button className="relative p-2 hover:bg-white/20 rounded-lg transition-colors">
              <BellIcon className="w-6 h-6" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">
                A
              </div>
              <span className="text-sm font-medium">Admin User</span>
            </div>
          </div>
        </div>
      </header>

      {/* ============================================
          CONTENT AREA - Flexible (flex-1)
          Tự động chiếm không gian còn lại
          ============================================ */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* ==========================================
            SIDEBAR - Fixed Width (256px or 80px)
            Collapsible với smooth animation
            ========================================== */}
        <aside 
          className={`
            transition-all duration-300 ease-in-out
            ${sidebarOpen ? 'w-64' : 'w-20'}
            bg-gradient-to-b from-gray-50 to-gray-100 
            border-r border-gray-200
            flex flex-col
            overflow-hidden
          `}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200">
            <div className={`
              flex items-center gap-3
              ${sidebarOpen ? '' : 'justify-center'}
            `}>
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center text-white font-bold">
                Q
              </div>
              {sidebarOpen && (
                <div className="flex-1 animate-fadeIn">
                  <p className="text-sm font-bold text-gray-900">QLDA Pro</p>
                  <p className="text-xs text-gray-500">v2.0.0</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Menu - Scrollable */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {menuItems.map((item, index) => {
                const Icon = item.icon
                return (
                  <li key={index}>
                    <button
                      className={`
                        w-full flex items-center gap-3 
                        px-4 py-3 rounded-xl
                        text-gray-700 hover:text-cyan-600
                        hover:bg-white
                        transition-all duration-200
                        group
                        ${sidebarOpen ? '' : 'justify-center'}
                      `}
                    >
                      <Icon className="w-6 h-6 flex-shrink-0 group-hover:scale-110 transition-transform" />
                      {sidebarOpen && (
                        <span className="flex-1 text-left font-medium animate-fadeIn">
                          {item.label}
                        </span>
                      )}
                      {sidebarOpen && item.badge && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-fadeIn">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className={`
              text-xs text-gray-500 text-center
              ${sidebarOpen ? '' : 'hidden'}
            `}>
              <p>Screen: {window.innerWidth} × {window.innerHeight}</p>
              <p className="mt-1">Sidebar: {sidebarOpen ? '256px' : '80px'}</p>
            </div>
          </div>
        </aside>

        {/* ==========================================
            MAIN CONTENT - Flexible Width (flex-1)
            Tự động chiếm toàn bộ không gian còn lại
            ========================================== */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
          
          {/* Sticky Toolbar */}
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Dashboard Demo</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Layout tự động co giãn theo màn hình
                </p>
              </div>
              <button className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all">
                + Thêm mới
              </button>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="p-6 space-y-6">
            
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Tổng công việc', value: '248', color: 'from-blue-500 to-cyan-500', icon: '📊' },
                { label: 'Hoàn thành', value: '182', color: 'from-green-500 to-emerald-500', icon: '✅' },
                { label: 'Đang thực hiện', value: '45', color: 'from-yellow-500 to-orange-500', icon: '⚡' },
                { label: 'Trễ hạn', value: '21', color: 'from-red-500 to-pink-500', icon: '🔥' },
              ].map((stat, index) => (
                <div 
                  key={index}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 bg-gradient-to-br ${stat.color} rounded-xl text-2xl`}>
                      {stat.icon}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Info Card */}
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-200 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">🎯 Thông tin Layout</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-700">Container:</span>
                    <code className="bg-white px-2 py-1 rounded">h-screen w-screen</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-700">Header:</span>
                    <code className="bg-white px-2 py-1 rounded">h-16 (64px)</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-700">Sidebar:</span>
                    <code className="bg-white px-2 py-1 rounded">
                      {sidebarOpen ? 'w-64 (256px)' : 'w-20 (80px)'}
                    </code>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-700">Main:</span>
                    <code className="bg-white px-2 py-1 rounded">flex-1 (auto)</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-700">Overflow:</span>
                    <code className="bg-white px-2 py-1 rounded">overflow-y-auto</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-700">Responsive:</span>
                    <code className="bg-white px-2 py-1 rounded">✅ Enabled</code>
                  </div>
                </div>
              </div>
            </div>

            {/* Demo Content Cards */}
            {Array.from({ length: 8 }).map((_, index) => (
              <div 
                key={index}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  📝 Nội dung demo #{index + 1}
                </h3>
                <p className="text-gray-600">
                  Đây là nội dung mẫu để test scroll. Layout sẽ tự động thêm scrollbar khi 
                  nội dung vượt quá chiều cao màn hình. Sidebar và main content đều độc lập 
                  có scrollbar riêng.
                </p>
                <div className="mt-4 flex gap-2">
                  <button className="px-4 py-2 bg-cyan-100 text-cyan-700 rounded-lg text-sm font-medium hover:bg-cyan-200 transition-colors">
                    Xem thêm
                  </button>
                  <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                    Chỉnh sửa
                  </button>
                </div>
              </div>
            ))}

            {/* Footer info */}
            <div className="text-center py-8 text-gray-500 text-sm">
              <p>🎉 Layout tự động điều chỉnh full màn hình</p>
              <p className="mt-2">Thử resize browser để xem hiệu ứng responsive!</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
