import React, { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  UserCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  EllipsisVerticalIcon,
  LockClosedIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon
} from '@heroicons/react/24/outline'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

const { usersApi, projectsApi, userActivityApi } = api

import { formatDate, formatDateTime, getRoleDisplayName } from '../utils/helpers'
import LoadingSpinner from '../components/LoadingSpinner'
import Pagination from '../components/Pagination'
import ExcelImportButton from '../components/ExcelImportButton'
import ExcelExportButton from '../components/ExcelExportButton'
import ExcelService from '../utils/excelService'
import PortalDropdown from '../components/PortalDropdown'

const StaffPage = () => {
  const { profile } = useAuth()
  const canManageStatus = profile?.role === 'manager'
  const showActions = canManageStatus // Ẩn toàn bộ cột thao tác đối với admin/user; chỉ Quản lý thấy
  const [users, setUsers] = useState([])
  const [allProjects, setAllProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showAddProjectForm, setShowAddProjectForm] = useState(false)
  const [editingProjectMember, setEditingProjectMember] = useState(null)
  const [newProjectAssignment, setNewProjectAssignment] = useState({
    projectId: '',
    roleInProject: '',
    positionInProject: '',
    systemRoleInProject: 'user'
  })
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    is_active: true,
    birthday: '',
    join_date: '',
    role: 'user' // thêm trường vai trò toàn hệ thống
  })
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingUser, setDeletingUser] = useState(null)
  const [activityMap, setActivityMap] = useState({})
  // Dropdown action state like ProgressPage
  const [openActionMenuId, setOpenActionMenuId] = useState(null)
  const actionBtnRefs = useRef({})

  useEffect(() => {
    loadInitialData()
  }, [])

  // Auto-refresh activity every 60s to keep Online status fresh
  useEffect(() => {
    let timer = null
    const tick = async () => {
      try {
        const activity = await userActivityApi.getSummary()
        const map = {}
        ;(activity || []).forEach(a => { if (a?.user_id) map[a.user_id] = a })
        setActivityMap(map)
      } catch {}
    }
    timer = setInterval(tick, 60000)
    return () => { if (timer) clearInterval(timer) }
  }, [])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [usersData, projectsData, activity] = await Promise.all([
        usersApi.getAll(),
        projectsApi.getAll(),
        userActivityApi.getSummary().catch(() => [])
      ])
      setUsers(usersData || [])
      setAllProjects(projectsData || [])
      const map = {}
      ;(activity || []).forEach(a => { map[a.user_id] = a })
      setActivityMap(map)
    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Không thể tải dữ liệu: ' + (error?.message || error))
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      const [data, activity] = await Promise.all([
        usersApi.getAll(),
        userActivityApi.getSummary().catch(() => [])
      ])
      setUsers(data || [])
      const map = {}
      ;(activity || []).forEach(a => { map[a.user_id] = a })
      setActivityMap(map)
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Không thể tải danh sách nhân sự: ' + (error?.message || error))
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (!formData.full_name.trim()) {
      toast.error('Vui lòng nhập họ tên')
      return
    }
    if (!formData.email.trim()) {
      toast.error('Vui lòng nhập email')
      return
    }

    try {
      if (editingUser) {
        const wasManager = editingUser.role === 'manager'
        const cleanedData = {
          ...formData,
          birthday: formData.birthday?.trim() || null,
          join_date: formData.join_date?.trim() || null,
          role: formData.role || 'user'
        }

        await usersApi.update(editingUser.id, cleanedData)

        // Nếu vừa được nâng lên Quản lý (global) thì xóa toàn bộ phân công dự án cũ (gộp 1 câu lệnh)
        if (!wasManager && cleanedData.role === 'manager') {
          try {
            await projectsApi.removeAllMembershipsForUser(editingUser.id)
            toast.success('Đã cấp quyền Quản lý và xóa các phân công dự án trước đó')
          } catch (remErr) {
            console.error('Lỗi xóa phân công dự án khi nâng quyền quản lý:', remErr)
            toast.error('Không thể xóa hết phân công cũ: ' + remErr.message)
          }
        } else {
          toast.success('Cập nhật nhân sự thành công')
        }

        await loadUsers()
        const updated = await usersApi.getById(editingUser.id)
        setEditingUser(updated)
      } else {
        const newUserData = {
          email: formData.email.trim(),
          password: formData.password || 'TempPassword123!',
          full_name: formData.full_name.trim(),
          phone: formData.phone?.trim() || null,
          birthday: formData.birthday?.trim() || null,
          join_date: formData.join_date?.trim() || null,
          is_active: formData.is_active,
          role: formData.role || 'user'
        }
        await usersApi.create(newUserData)
        toast.success(newUserData.role === 'manager' ? 'Thêm Quản lý thành công' : 'Thêm nhân sự thành công! Email đăng nhập đã được gửi.')
        // Refresh list but keep modal open for batch add
        await loadUsers()
        // Reset form for next entry, keep role and is_active for convenience
        setFormData(prev => ({
          full_name: '',
          email: '',
          password: '',
          phone: '',
          is_active: prev.is_active,
          birthday: '',
          join_date: '',
          role: prev.role || 'user'
        }))
        // Ensure the modal stays open for next input
        setEditingUser(null)
        setShowAddProjectForm(false)
      }

      // Do not close modal after adding a new user (batch mode)
      if (editingUser) {
        // If updating existing, close as before
        setShowModal(false)
        resetForm()
      }
    } catch (error) {
      console.error('Error saving user:', error)
      const errorMessage = error?.message || error?.toString() || 'Lỗi không xác định'
      toast.error(errorMessage)
    }
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      is_active: user.is_active !== false,
      birthday: user.birthday || '',
      join_date: user.join_date || '',
      role: user.role || 'user'
    })
    setShowModal(true)
    setShowAddProjectForm(false)
    setEditingProjectMember(null)
    setNewProjectAssignment({ projectId: '', roleInProject: '', positionInProject: '', systemRoleInProject: 'user' })
  }

  const handleToggleActive = async (userId, currentStatus) => {
    if (!canManageStatus) {
      toast.error('Chỉ Quản lý mới có quyền kích hoạt/vô hiệu hóa tài khoản')
      return
    }
    if (!window.confirm(`Bạn có chắc muốn ${currentStatus ? 'vô hiệu hóa' : 'kích hoạt'} nhân sự này?`)) return

    try {
      await usersApi.update(userId, { is_active: !currentStatus })
      toast.success(`${!currentStatus ? 'Kích hoạt' : 'Vô hiệu hóa'} thành công`)
      await loadUsers()
    } catch (error) {
      console.error('Error toggling user status:', error)
      toast.error('Lỗi: ' + (error?.message || error))
    }
  }

  const handleAddToProject = async () => {
    if (!newProjectAssignment.projectId || !newProjectAssignment.roleInProject.trim()) {
      toast.error('Vui lòng chọn dự án và nhập vai trò.')
      return
    }

    if (!editingUser || !editingUser.id) {
      toast.error('Không tìm thấy thông tin nhân sự. Vui lòng thử lại.')
      setShowAddProjectForm(false)
      return
    }

    try {
      if (editingProjectMember) {
        // Update existing project member
        await projectsApi.updateMemberRole(
          newProjectAssignment.projectId,
          editingUser.id,
          newProjectAssignment.roleInProject,
          newProjectAssignment.positionInProject,
          newProjectAssignment.systemRoleInProject
        )
        toast.success('Cập nhật vai trò trong dự án thành công!')
      } else {
        // Add new project member
        await projectsApi.addMember(
          newProjectAssignment.projectId,
          editingUser.id,
          newProjectAssignment.roleInProject,
          newProjectAssignment.positionInProject,
          newProjectAssignment.systemRoleInProject
        )
        toast.success('Thêm vào dự án thành công!')
      }

      setShowAddProjectForm(false)
      setEditingProjectMember(null)
      setNewProjectAssignment({ projectId: '', roleInProject: '', positionInProject: '', systemRoleInProject: 'user' })
      await loadUsers()
      const updated = await usersApi.getById(editingUser.id)
      setEditingUser(updated)
    } catch (error) {
      console.error('Error adding to project:', error)
      toast.error('Lỗi: ' + (error?.message || error))
    }
  }

  const handleEditProjectMember = (projectMember) => {
    setEditingProjectMember(projectMember)
    setNewProjectAssignment({
      projectId: projectMember.project.id,
      roleInProject: projectMember.role_in_project || '',
      positionInProject: projectMember.position_in_project || '',
      systemRoleInProject: projectMember.system_role_in_project || 'user'
    })
    setShowAddProjectForm(true)
  }

  const handleRemoveFromProject = async (projectId, userId) => {
    if (!window.confirm('Bạn có chắc muốn xóa nhân sự này khỏi dự án?')) return

    try {
      await projectsApi.removeMember(projectId, userId)
      toast.success('Xóa nhân sự khỏi dự án thành công!')
      await loadUsers()

      const updatedUser = await usersApi.getById(editingUser.id)
      setEditingUser(updatedUser)
    } catch (error) {
      console.error('Error removing user from project:', error)
      toast.error('Lỗi: ' + (error?.message || error))
    }
  }

  // Mở modal xác nhận xóa
  const handleOpenDeleteModal = (user) => {
    if (!canManageStatus) {
      toast.error('Chỉ Quản lý mới có quyền xóa tài khoản')
      return
    }
    setDeletingUser(user)
    setShowDeleteModal(true)
  }

  // Vô hiệu hóa tạm thời (soft delete)
  const handleSoftDelete = async () => {
    if (!deletingUser) return

    try {
      await usersApi.update(deletingUser.id, { is_active: false })
      toast.success('Đã vô hiệu hóa tài khoản thành công! Bạn có thể kích hoạt lại sau.')
      await loadUsers()
      setShowDeleteModal(false)
      setDeletingUser(null)
    } catch (error) {
      console.error('Error soft deleting user:', error)
      toast.error('Lỗi khi vô hiệu hóa: ' + (error?.message || error))
    }
  }

  // Xóa vĩnh viễn (hard delete)
  const handleHardDelete = async () => {
    if (!deletingUser) return

    // Cảnh báo đặc biệt nếu user đang quản lý dự án
    const managingProjects = deletingUser.project_members?.filter(pm => 
      pm.system_role_in_project === 'manager' || pm.system_role_in_project === 'admin'
    )

    if (managingProjects && managingProjects.length > 0) {
      const projectNames = managingProjects.map(pm => pm.project?.name || pm.project?.code).join(', ')
      const confirmMsg = `⚠️ CẢNH BÁO: Người này đang quản lý ${managingProjects.length} dự án:\n\n${projectNames}\n\nHệ thống sẽ tự động chuyển giao quyền quản lý dự án. Bạn có chắc chắn muốn xóa?`
      
      if (!window.confirm(confirmMsg)) {
        return
      }
    }

    try {
      await usersApi.delete(deletingUser.id)
      toast.success('Đã xóa tài khoản vĩnh viễn khỏi hệ thống!')
      await loadUsers()
      setShowDeleteModal(false)
      setDeletingUser(null)
    } catch (error) {
      console.error('Error hard deleting user:', error)
      toast.error('Lỗi khi xóa vĩnh viễn: ' + (error?.message || error))
    }
  }

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      password: '',
      phone: '',
      is_active: true,
      birthday: '',
      join_date: '',
      role: 'user'
    })
    setEditingUser(null)
    setShowAddProjectForm(false)
    setEditingProjectMember(null)
    setNewProjectAssignment({ projectId: '', roleInProject: '', positionInProject: '', systemRoleInProject: 'user' })
  }

  // Import Staff từ Excel
  const handleImportStaff = async (selectedData, selectedColumns) => {
    try {
      const importCount = { success: 0, failed: 0, errors: [] }

      for (let i = 0; i < selectedData.length; i++) {
        const row = selectedData[i]
        
        try {
          // Validate required fields
          if (!row['Họ tên'] || !row['Email']) {
            importCount.errors.push({
              row: i + 1,
              error: 'Thiếu họ tên hoặc email',
              data: row
            })
            importCount.failed++
            continue
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(row['Email'])) {
            importCount.errors.push({
              row: i + 1,
              error: 'Email không hợp lệ',
              data: row
            })
            importCount.failed++
            continue
          }

          // Map Excel columns to user data
          const userData = {
            full_name: row['Họ tên']?.toString().trim(),
            email: row['Email']?.toString().trim().toLowerCase(),
            password: row['Mật khẩu']?.toString() || 'TempPassword123!',
            phone: row['Số điện thoại']?.toString() || null,
            birthday: row['Ngày sinh'] || null,
            join_date: row['Ngày vào làm'] || new Date().toISOString().split('T')[0],
            is_active: row['Trạng thái']?.toString().toLowerCase() !== 'vô hiệu',
            role: row['Vai trò']?.toString().toLowerCase() === 'manager' ? 'manager' : 
                  row['Vai trò']?.toString().toLowerCase() === 'admin' ? 'admin' : 'user'
          }

          // Create user
          await usersApi.create(userData)
          importCount.success++

        } catch (error) {
          importCount.errors.push({
            row: i + 1,
            error: error.message || 'Lỗi không xác định',
            data: row
          })
          importCount.failed++
        }
      }

      // Show results
      if (importCount.success > 0) {
        toast.success(`Import thành công ${importCount.success} nhân sự!`)
        await loadUsers()
      }

      if (importCount.failed > 0) {
        console.error('Import errors:', importCount.errors)
        toast.error(`Có ${importCount.failed} nhân sự import thất bại. Xem console để biết chi tiết.`)
      }

    } catch (error) {
      console.error('Import staff error:', error)
      toast.error('Lỗi khi import: ' + error.message)
    }
  }

  // Export Staff ra Excel
  const handleExportStaff = () => {
    try {
      // Prepare data for export
      const exportData = filteredUsers.map(user => ({
        'Họ tên': user.full_name || '',
        'Email': user.email || '',
        'Số điện thoại': user.phone || '',
        'Ngày sinh': user.birthday ? formatDate(user.birthday) : '',
        'Ngày vào làm': user.join_date ? formatDate(user.join_date) : '',
        'Vai trò hệ thống': getRoleDisplayName(user.role),
        'Trạng thái': user.is_active ? 'Hoạt động' : 'Vô hiệu',
        'Số dự án tham gia': user.project_members?.length || 0,
        'Dự án': user.project_members?.map(pm => pm.project?.name || pm.project?.code).join(', ') || '',
        'Chức vụ trong dự án': user.project_members?.map(pm => pm.position_in_project || '').filter(p => p).join(', ') || '',
        'Vai trò trong dự án': user.project_members?.map(pm => pm.role_in_project || '').filter(r => r).join(', ') || ''
      }))

      return exportData
    } catch (error) {
      console.error('Export staff error:', error)
      toast.error('Lỗi khi chuẩn bị dữ liệu export')
      return []
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setShowAddProjectForm(false)
    setEditingProjectMember(null)
    resetForm()
  }

  // (Original filteredUsers logic replaced later after effectiveUsers computation)

  // Get role badge color
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'manager':
        return 'bg-purple-100 text-purple-800'
      case 'admin':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Access control: Theo yêu cầu, mọi người dùng đăng nhập đều có quyền xem như Manager trên trang Nhân sự
  // Do đó bỏ chặn và luôn hiển thị toàn bộ danh sách
  const effectiveUsers = users || []

  // Phân trang và lọc: đặt Hook ở top-level để không vi phạm thứ tự Hook
  const [staffPage, setStaffPage] = useState(1)
  const [staffPageSize, setStaffPageSize] = useState(25)

  const filteredUsers = React.useMemo(() => {
    return (effectiveUsers || []).filter(user => {
      const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.phone?.includes(searchTerm)
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'active' && user.is_active) ||
                           (statusFilter === 'inactive' && !user.is_active)
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [effectiveUsers, searchTerm, roleFilter, statusFilter])

  const totalUsers = filteredUsers.length
  const staffStart = (staffPage - 1) * staffPageSize
  const staffEnd = Math.min(staffStart + staffPageSize, totalUsers)
  const displayedUsers = React.useMemo(() => filteredUsers.slice(staffStart, staffEnd), [filteredUsers, staffStart, staffEnd])
  React.useEffect(() => { setStaffPage(1) }, [searchTerm, roleFilter, statusFilter])

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="w-full min-h-screen px-2 sm:px-4 lg:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Quản lý nhân sự</h1>
        
        <div className="flex items-center gap-3 flex-wrap">
          {/* Import Excel */}
          <ExcelImportButton onImport={handleImportStaff}>
            <DocumentArrowUpIcon className="w-4 h-4" />
            <span>Import Excel</span>
          </ExcelImportButton>

          {/* Export Excel */}
          <ExcelExportButton
            data={handleExportStaff()}
            filename="DanhSachNhanSu"
            disabled={filteredUsers.length === 0}
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            <span>Export Excel</span>
          </ExcelExportButton>

          {/* Add Staff Button (only for global admin/manager) */}
          {(profile?.role === 'manager' || profile?.role === 'admin') && (
            <button
              onClick={() => {
                setEditingUser(null)
                resetForm()
                setShowModal(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-sm font-semibold text-white hover:from-cyan-600 hover:to-blue-700 transition-all duration-200 shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40 hover:-translate-y-0.5 whitespace-nowrap"
            >
              <PlusIcon className="w-5 h-5" />
              Thêm nhân sự
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid gap-4 grid-autofit-240">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm nhân sự..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input"
          >
            <option value="all">Tất cả vai trò</option>
            <option value="manager">Quản lý</option>
            <option value="admin">Quản trị viên</option>
            <option value="user">Nhân viên</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Vô hiệu hóa</option>
          </select>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Tổng: <span className="font-semibold">{filteredUsers.length}</span> nhân sự
        </div>
      </div>

      {/* Users Table */}
      <div className="card p-0 overflow-x-auto">
  <table className="min-w-full w-full table-auto divide-y divide-cyan-100 border border-gray-200 [&>thead>tr>th]:text-center [&>thead>tr>th]:align-middle [&>tbody>tr>td]:align-middle [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
          <thead className="bg-white/60 backdrop-blur">
            <tr>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Nhân sự</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Liên hệ</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Dự án tham gia</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Ngày vào</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Hoạt động</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Trạng thái</th>
              {showActions && (
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Thao tác</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white/40 backdrop-blur divide-y divide-cyan-50">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={showActions ? 7 : 6} className="px-6 py-12 text-center text-gray-500">Không có nhân sự nào</td>
              </tr>
            ) : (
              displayedUsers.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-50 ${!user.is_active ? 'opacity-60 bg-gray-50' : ''}`}>
                  <td className="px-4 py-4 whitespace-nowrap max-w-[220px]">
                    <div className="flex items-center text-left gap-3">
                      <div className="flex-shrink-0 h-10 w-10 relative">
                        {user.avatar_url ? (
                          <>
                            <img className={`h-10 w-10 rounded-full ${!user.is_active ? 'grayscale' : ''}`} src={user.avatar_url} alt="" />
                            {!user.is_active && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-full">
                                <LockClosedIcon className="h-5 w-5 text-white" />
                              </div>
                            )}
                          </>
                        ) : (
                          <div className={`h-10 w-10 rounded-full ${!user.is_active ? 'bg-gray-400' : 'bg-gray-300'} flex items-center justify-center relative`}>
                            <UserCircleIcon className={`h-6 w-6 ${!user.is_active ? 'text-gray-600' : 'text-gray-600'}`} />
                            {!user.is_active && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-full">
                                <LockClosedIcon className="h-5 w-5 text-white" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className={`text-sm font-medium break-words ${!user.is_active ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                          {user.full_name}
                          {!user.is_active && <span className="ml-2 text-xs text-red-600">(Đã vô hiệu)</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-left max-w-[220px]">
                    <div className={`text-sm break-words ${!user.is_active ? 'text-gray-500' : 'text-gray-900'}`}>{user.email}</div>
                    {user.phone && <div className="text-sm text-gray-500">{user.phone}</div>}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500 max-w-[320px]">
                    {user.project_members && user.project_members.length > 0 ? (
                      <ul className="space-y-1">
                        {user.project_members.map(pm => (
                          <li key={pm.id}>
                            <div className="text-left">
                              <span className="font-semibold text-gray-700">{pm.project?.code || pm.project?.name || 'N/A'}</span>
                              {pm.position_in_project && (
                                <span className="text-blue-600"> - {pm.position_in_project}</span>
                              )}
                              {pm.role_in_project && (
                                <span className="text-gray-500"> ({pm.role_in_project})</span>
                              )}
                            </div>
                            {pm.system_role_in_project && (
                              <div className="text-xs mt-0.5 text-left">
                                <span className={`px-2 py-0.5 rounded-full ${getRoleBadgeColor(pm.system_role_in_project)}`}>
                                  {getRoleDisplayName(pm.system_role_in_project)}
                                </span>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : ('-')}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left">{user.join_date ? formatDate(user.join_date) : '-'}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-600 leading-5">
                        <div><span className="text-gray-700 font-medium">7 ngày:</span> {activityMap[user.id]?.weekly_login_count ?? '-'}</div>
                        <div><span className="text-gray-700 font-medium">Lần cuối:</span> {activityMap[user.id]?.last_login_at ? formatDateTime(activityMap[user.id]?.last_login_at) : '-'}</div>
                      </div>
                      <div className="whitespace-nowrap">
                        {activityMap[user.id]?.is_online ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                            <span className="inline-block w-2 h-2 rounded-full bg-gray-400"></span>
                            Offline
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-left">
                    {user.is_active !== false ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800"><CheckCircleIcon className="w-4 h-4 mr-1" />Hoạt động</span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800"><XCircleIcon className="w-4 h-4 mr-1" />Vô hiệu</span>
                    )}
                  </td>
                  {showActions && (
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative inline-block text-left">
                        <button
                          ref={(el) => { if (el) actionBtnRefs.current[user.id] = el }}
                          onClick={(e) => { e.stopPropagation(); setOpenActionMenuId(prev => prev === user.id ? null : user.id) }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          title="Thao tác"
                        >
                          <EllipsisVerticalIcon className="h-5 w-5" />
                        </button>
                        <PortalDropdown
                          open={openActionMenuId === user.id}
                          onClose={() => setOpenActionMenuId(null)}
                          anchorRef={{ current: actionBtnRefs.current[user.id] }}
                          width={220}
                        >
                          <div className="py-1 text-sm">
                            <div className="px-3 py-2 text-gray-500 uppercase tracking-wide text-[11px]">Thao tác</div>
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 inline-flex items-center gap-2"
                              onClick={() => { setOpenActionMenuId(null); handleEdit(user) }}
                            >
                              <PencilIcon className="h-4 w-4"/> Sửa
                            </button>
                            {canManageStatus && (
                              <button
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 inline-flex items-center gap-2"
                                onClick={() => { setOpenActionMenuId(null); handleToggleActive(user.id, user.is_active) }}
                              >
                                {user.is_active ? (<><XCircleIcon className="h-4 w-4"/> Vô hiệu hóa</>) : (<><CheckCircleIcon className="h-4 w-4"/> Kích hoạt</>)}
                              </button>
                            )}
                            {canManageStatus && (
                              <button
                                className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-700 inline-flex items-center gap-2"
                                onClick={() => { setOpenActionMenuId(null); handleOpenDeleteModal(user) }}
                              >
                                <TrashIcon className="h-4 w-4"/> Xóa tài khoản
                              </button>
                            )}
                          </div>
                        </PortalDropdown>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="p-3 border-t border-gray-100">
          <Pagination
            total={totalUsers}
            page={staffPage}
            pageSize={staffPageSize}
            onChange={({ page, pageSize }) => { setStaffPage(page); setStaffPageSize(pageSize) }}
          />
        </div>
      </div>

      {/* Modal for Add/Edit User */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingUser ? 'Cập nhật thông tin nhân sự' : 'Thêm nhân sự mới'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name and Email */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Họ và tên *</label>
                    <input type="text" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} className="input" required />
                  </div>

                  <div>
                    <label className="label">Email *</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input" required disabled={!!editingUser} />
                  </div>
                </div>

                {/* Password (only for new user) */}
                {!editingUser && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Mật khẩu {editingUser ? '' : '*'}</label>
                      <input 
                        type="password" 
                        value={formData.password} 
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                        className="input" 
                        placeholder="Tối thiểu 6 ký tự"
                        required={!editingUser}
                        minLength={6}
                      />
                      <p className="text-xs text-gray-500 mt-1">Mật khẩu mặc định nếu để trống: TempPassword123!</p>
                    </div>
                    <div></div>
                  </div>
                )}

                {/* Phone and Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Số điện thoại</label>
                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input" placeholder="0912345678" />
                  </div>

                  <div>
                    <label className="label">Trạng thái</label>
                    <select
                      value={formData.is_active ? 'active' : 'inactive'}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                      className="input"
                      disabled={!canManageStatus}
                      title={!canManageStatus ? 'Chỉ Quản lý mới được đổi trạng thái' : undefined}
                    >
                      <option value="active">Hoạt động</option>
                      <option value="inactive">Vô hiệu hóa</option>
                    </select>
                  </div>
                </div>

                {/* Checkbox Vai trò Quản lý (chỉ hiện với tài khoản quản lý) */}
                {profile?.role === 'manager' && (
                  <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded p-3">
                    <input
                      id="isGlobalManager"
                      type="checkbox"
                      checked={formData.role === 'manager'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.checked ? 'manager' : 'user' })}
                      className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <div className="flex flex-col">
                      <label htmlFor="isGlobalManager" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Cấp quyền Quản lý toàn hệ thống
                      </label>
                      <p className="text-xs text-gray-500">
                        Quản lý có toàn quyền trên tất cả dự án và nhân sự.
                      </p>
                    </div>
                  </div>
                )}

                {/* Join Date and Birthday */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Ngày vào làm</label>
                    <input type="date" value={formData.join_date} onChange={(e) => setFormData({ ...formData, join_date: e.target.value })} className="input" />
                  </div>

                  <div>
                    <label className="label">Ngày sinh</label>
                    <input type="date" value={formData.birthday} onChange={(e) => setFormData({ ...formData, birthday: e.target.value })} className="input" />
                  </div>
                </div>

                {/* Projects */}
                {editingUser && (
                  <div className="space-y-2">
                    <label className="label">Dự án tham gia</label>
                    {editingUser?.project_members && editingUser.project_members.length > 0 ? (
                      <div className="space-y-2 rounded-md border border-gray-200 p-3">
                        {editingUser.project_members.map(pm => (
                          <div key={pm.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">{pm.project?.name || 'Unnamed'}</p>
                              <div className="text-sm text-gray-600 mt-1 space-y-1">
                                {pm.position_in_project && (
                                  <p className="text-blue-600">Chức vụ: {pm.position_in_project}</p>
                                )}
                                {pm.role_in_project && (
                                  <p>Vai trò: {pm.role_in_project}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                type="button" 
                                className="text-blue-600 hover:text-blue-800" 
                                title="Sửa"
                                onClick={() => handleEditProjectMember(pm)}
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              <button 
                                type="button" 
                                className="text-red-500 hover:text-red-700" 
                                title="Xóa khỏi dự án" 
                                onClick={() => handleRemoveFromProject(pm.project.id, editingUser.id)}
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Nhân sự này chưa tham gia dự án nào.</p>
                    )}

                    {!showAddProjectForm ? (
                      <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => setShowAddProjectForm(true)}>+ Thêm vào dự án</button>
                    ) : (
                      <div className="mt-3 rounded-md border border-blue-300 bg-blue-50 p-4">
                        <h4 className="font-medium text-gray-800 mb-3">
                          {editingProjectMember ? 'Cập nhật thông tin dự án' : 'Thêm vào dự án mới'}
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Dự án</label>
                            <select 
                              value={newProjectAssignment.projectId} 
                              onChange={(e) => setNewProjectAssignment({ ...newProjectAssignment, projectId: e.target.value })} 
                              className="input"
                              disabled={!!editingProjectMember}
                            >
                              <option value="">-- Chọn dự án --</option>
                              {allProjects && allProjects.length > 0 && allProjects
                                .filter(p => {
                                  if (editingProjectMember) {
                                    return p.id === editingProjectMember.project.id
                                  }
                                  if (!editingUser || !editingUser.project_members) {
                                    return true
                                  }
                                  return !editingUser.project_members.some(pm => pm.project?.id === p.id)
                                })
                                .map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Chức vụ trong dự án</label>
                            <input 
                              type="text" 
                              placeholder="VD: Kỹ sư giám sát, Trưởng nhóm..." 
                              value={newProjectAssignment.positionInProject} 
                              onChange={(e) => setNewProjectAssignment({ ...newProjectAssignment, positionInProject: e.target.value })} 
                              className="input" 
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò / Nhiệm vụ *</label>
                            <input 
                              type="text" 
                              placeholder="VD: Giám sát thi công, Quản lý chất lượng..." 
                              value={newProjectAssignment.roleInProject} 
                              onChange={(e) => setNewProjectAssignment({ ...newProjectAssignment, roleInProject: e.target.value })} 
                              className="input" 
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò hệ thống trong dự án *</label>
                            <select 
                              value={newProjectAssignment.systemRoleInProject} 
                              onChange={(e) => setNewProjectAssignment({ ...newProjectAssignment, systemRoleInProject: e.target.value })} 
                              className="input"
                            >
                              <option value="user">Nhân viên</option>
                              <option value="admin">Quản trị viên</option>
                              <option value="manager">Quản lý</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Quyền hạn của nhân sự trong dự án này</p>
                          </div>
                          
                          <div className="flex items-center justify-end gap-2 pt-2">
                            <button 
                              type="button" 
                              className="btn-secondary btn-sm" 
                              onClick={() => {
                                setShowAddProjectForm(false)
                                setEditingProjectMember(null)
                                setNewProjectAssignment({ projectId: '', roleInProject: '', positionInProject: '', systemRoleInProject: 'user' })
                              }}
                            >
                              Hủy
                            </button>
                            <button 
                              type="button" 
                              className="btn-primary btn-sm" 
                              onClick={handleAddToProject}
                            >
                              {editingProjectMember ? 'Cập nhật' : 'Lưu'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={handleCloseModal} className="btn-secondary">Hủy</button>
                  <button type="submit" className="btn-primary">{editingUser ? 'Cập nhật' : 'Tạo mới'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa tài khoản */}
      {showDeleteModal && deletingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <TrashIcon className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Xóa tài khoản</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {deletingUser.full_name} ({deletingUser.email})
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-gray-700">
                  Bạn muốn xóa tài khoản này theo cách nào?
                </p>

                {/* Vô hiệu hóa tạm thời */}
                <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50">
                  <h3 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                    <XCircleIcon className="w-5 h-5" />
                    Vô hiệu hóa tạm thời
                  </h3>
                  <ul className="text-sm text-orange-800 space-y-1 mb-3 ml-7">
                    <li>• Tài khoản không thể đăng nhập</li>
                    <li>• Dữ liệu được giữ nguyên</li>
                    <li>• Có thể kích hoạt lại sau</li>
                  </ul>
                  <button
                    onClick={handleSoftDelete}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                  >
                    Vô hiệu hóa tạm thời
                  </button>
                </div>

                {/* Xóa vĩnh viễn */}
                <div className="border-2 border-red-200 rounded-lg p-4 bg-red-50">
                  <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                    <TrashIcon className="w-5 h-5" />
                    Xóa vĩnh viễn
                  </h3>
                  <ul className="text-sm text-red-800 space-y-1 mb-3 ml-7">
                    <li>• Xóa hoàn toàn khỏi hệ thống</li>
                    <li>• Xóa tất cả dữ liệu liên quan</li>
                    <li>• <strong>KHÔNG THỂ khôi phục</strong></li>
                  </ul>
                  <button
                    onClick={handleHardDelete}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                  >
                    Xóa vĩnh viễn
                  </button>
                </div>
              </div>

              {/* Nút hủy */}
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeletingUser(null)
                  }}
                  className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Hủy bỏ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StaffPage
