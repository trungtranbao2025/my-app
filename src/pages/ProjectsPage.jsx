import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EllipsisVerticalIcon,
  FunnelIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon
} from '@heroicons/react/24/outline'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

const { projectsApi, projectDocsApi } = api

import { useCache } from '../hooks/useCache'
import { formatDate, getProjectStatusColor, getProjectStatusText } from '../utils/helpers'
import LoadingSpinner from '../components/LoadingSpinner'
import Pagination from '../components/Pagination'
import ExcelExportButton from '../components/ExcelExportButton'
import ExcelImportButton from '../components/ExcelImportButton'
import VoiceInput from '../components/VoiceInput'
import OCRInput from '../components/OCRInput'
import PortalDropdown from '../components/PortalDropdown'

const ProjectsPage = () => {
  const { profile } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [showDocsModal, setShowDocsModal] = useState(false)
  const [docsProject, setDocsProject] = useState(null)
  const [docs, setDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docSearch, setDocSearch] = useState('')
  const [docSort, setDocSort] = useState('meeting_desc')
  const [docFile, setDocFile] = useState(null)
  const [docTitle, setDocTitle] = useState('')
  const [docDate, setDocDate] = useState('')
  // Dropdown state for actions like ProgressPage
  const [openActionMenuId, setOpenActionMenuId] = useState(null)
  const actionBtnRefs = useRef({})
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    location: '',
    start_date: '',
    duration_months: '',
    duration_days: '',
    total_days: '',
    end_date: '',
    contract_number: '',
    status: 'planning',
    budget: '',
    extension_count: 0,
    extension_date: ''
  })

  // Use cache hook for better performance (increased to 10 minutes)
  const { data: cachedProjects, loading: cacheLoading, refresh } = useCache(
    'projects_full',
    projectsApi.getAllFull,
    10 * 60 * 1000 // 10 minutes cache - no need to reload often
  )

  useEffect(() => {
    if (cachedProjects) {
      setProjects(cachedProjects)
      setLoading(false)
    } else {
      setLoading(cacheLoading)
    }
  }, [cachedProjects, cacheLoading])

  const loadProjects = async () => {
    try {
      setLoading(true)
      await refresh()
      if (cachedProjects) {
        setProjects(cachedProjects)
      }
    } catch (error) {
      console.error('Error loading projects:', error)
      toast.error('Không thể tải danh sách dự án')
    } finally {
      setLoading(false)
    }
  }

  // Documents helpers
  const openDocs = async (project) => {
    setDocsProject(project)
    setShowDocsModal(true)
    await loadDocs(project.id)
  }

  const loadDocs = async (projectId) => {
    try {
      setDocsLoading(true)
      const data = await projectDocsApi.list(projectId, { search: docSearch, sort: docSort, category: 'minutes' })
      setDocs(data || [])
    } catch (e) {
      console.error(e)
      toast.error('Không thể tải biên bản họp')
    } finally {
      setDocsLoading(false)
    }
  }

  const handleUploadDoc = async (e) => {
    e?.preventDefault?.()
    if (!docsProject) return
    if (!docFile) {
      toast.error('Vui lòng chọn file')
      return
    }
    try {
      await projectDocsApi.upload(docsProject.id, docFile, {
        title: docTitle || docFile.name,
        meetingDate: docDate || null,
        category: 'minutes'
      })
      toast.success('Đã tải lên biên bản họp')
      setDocFile(null)
      setDocTitle('')
      setDocDate('')
      await loadDocs(docsProject.id)
    } catch (e) {
      console.error(e)
      toast.error('Tải lên thất bại: ' + (e.message || ''))
    }
  }

  const handleDeleteDoc = async (doc) => {
    if (!window.confirm('Xóa biên bản này?')) return
    try {
      await projectDocsApi.delete(doc)
      toast.success('Đã xóa')
      await loadDocs(docsProject.id)
    } catch (e) {
      console.error(e)
      toast.error('Không thể xóa')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      // Tính toán total_days và end_date
      let totalDays = 0
      if (formData.total_days) {
        totalDays = parseInt(formData.total_days)
      } else if (formData.duration_days) {
        totalDays = parseInt(formData.duration_days)
      } else if (formData.duration_months) {
        totalDays = parseInt(formData.duration_months) * 30
      }

      // Tính ngày hoàn thành
      let endDate = null
      if (formData.start_date && totalDays > 0) {
        const startDate = new Date(formData.start_date)
        const calculatedEndDate = new Date(startDate)
        calculatedEndDate.setDate(calculatedEndDate.getDate() + totalDays)
        endDate = calculatedEndDate.toISOString().split('T')[0]
      }

      const projectData = {
        ...formData,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        duration_months: formData.duration_months ? parseInt(formData.duration_months) : null,
        duration_days: formData.duration_days ? parseInt(formData.duration_days) : totalDays || null,
        total_days: totalDays || null,
        end_date: endDate,
        extension_count: formData.extension_count ? parseInt(formData.extension_count) : 0,
        extension_date: formData.extension_date || null,
        manager_id: profile.id
      }

      // Optimistic update - update UI immediately
      if (editingProject) {
        const updatedProjects = projects.map(p => 
          p.id === editingProject.id ? { ...p, ...projectData } : p
        )
        setProjects(updatedProjects)
        setShowModal(false)
        setEditingProject(null)
        resetForm()
        
        await projectsApi.update(editingProject.id, projectData)
        toast.success('Cập nhật dự án thành công!')
        
        // Refresh cache in background
        refresh()
      } else {
        const newProject = await projectsApi.create(projectData)
        
        // Add to local state immediately
        setProjects([newProject, ...projects])
        setShowModal(false)
        resetForm()
        
        toast.success('Tạo dự án mới thành công!')
        
        // Refresh cache in background
        refresh()
      }
    } catch (error) {
      console.error('Error saving project:', error)
      toast.error(editingProject ? 'Không thể cập nhật dự án' : 'Không thể tạo dự án')
      
      // Rollback on error
      await refresh()
    }
  }

  const handleEdit = (project) => {
    setEditingProject(project)
    setFormData({
      code: project.code || '',
      name: project.name || '',
      description: project.description || '',
      location: project.location || '',
      start_date: project.start_date || '',
      duration_months: project.duration_months || '',
      duration_days: project.duration_days || '',
      total_days: project.total_days || '',
      end_date: project.end_date || '',
      contract_number: project.contract_number || '',
      status: project.status || 'planning',
      budget: project.budget || '',
      extension_count: project.extension_count || 0,
      extension_date: project.extension_date || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (project) => {
    if (!window.confirm(`Bạn có chắc muốn xóa dự án "${project.name}"?`)) {
      return
    }

    try {
      // Optimistic delete - remove from UI immediately
      const filteredProjects = projects.filter(p => p.id !== project.id)
      setProjects(filteredProjects)
      
      await projectsApi.delete(project.id)
      toast.success('Xóa dự án thành công!')
      
      // Refresh cache in background
      refresh()
    } catch (error) {
      console.error('Error deleting project:', error)
      toast.error('Không thể xóa dự án')
      
      // Rollback on error
      await refresh()
    }
  }

  // Export projects to Excel
  const handleExport = () => {
    const exportData = filteredProjects.map(p => ({
      'Mã dự án': p.code,
      'Tên dự án': p.name,
      'Mô tả': p.description || '',
      'Địa điểm': p.location || '',
      'Trạng thái': getProjectStatusText(p.status),
      'Ngày bắt đầu': p.start_date ? formatDate(p.start_date) : '',
      'Ngày hoàn thành': p.end_date ? formatDate(p.end_date) : '',
      'Số ngày thực hiện': p.total_days || '',
      'Thời gian (tháng)': p.duration_months || '',
      'Số hợp đồng': p.contract_number || '',
      'Số lần gia hạn': p.extension_count || 0,
      'Ngày gia hạn': p.extension_date ? formatDate(p.extension_date) : '',
      'Ngân sách': p.budget || '',
      'Quản lý': p.manager?.full_name || '',
      'Ngày tạo': formatDate(p.created_at)
    }))
    
    return exportData
  }

  // Import projects from Excel
  const handleImport = async (data) => {
    try {
      let successCount = 0
      let errorCount = 0
      
      for (const row of data) {
        try {
          // Map Excel columns to project fields
          const projectData = {
            code: row['Mã dự án'] || row['code'],
            name: row['Tên dự án'] || row['name'],
            description: row['Mô tả'] || row['description'] || '',
            location: row['Địa điểm'] || row['location'] || '',
            status: row['Trạng thái']?.toLowerCase() || row['status'] || 'planning',
            start_date: row['Ngày bắt đầu'] || row['start_date'] || null,
            duration_months: parseInt(row['Thời gian (tháng)'] || row['duration_months'] || 0),
            duration_days: parseInt(row['Thời gian (ngày)'] || row['duration_days'] || 0),
            contract_number: row['Số hợp đồng'] || row['contract_number'] || '',
            budget: parseFloat(row['Ngân sách'] || row['budget'] || 0),
            progress_percent: parseInt(row['Tiến độ (%)'] || row['progress_percent'] || 0)
          }
          
          // Validate required fields
          if (!projectData.code || !projectData.name) {
            errorCount++
            continue
          }
          
          await projectsApi.create(projectData)
          successCount++
        } catch (error) {
          console.error('Error importing row:', error)
          errorCount++
        }
      }
      
      toast.success(`Import thành công ${successCount} dự án${errorCount > 0 ? `, ${errorCount} lỗi` : ''}`)
      loadProjects()
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Lỗi khi import: ' + error.message)
    }
  }

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      location: '',
      start_date: '',
      duration_months: '',
      duration_days: '',
      total_days: '',
      end_date: '',
      contract_number: '',
      status: 'planning',
      budget: '',
      extension_count: 0,
      extension_date: ''
    })
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    let newFormData = {
      ...formData,
      [name]: value
    }

    // Tự động tính toán khi thay đổi duration_months hoặc duration_days
    if (name === 'duration_months' && value) {
      const months = parseInt(value)
      const days = months * 30
      newFormData.total_days = days
      newFormData.duration_days = days
    } else if (name === 'duration_days' && value) {
      const days = parseInt(value)
      newFormData.total_days = days
      newFormData.duration_months = Math.round(days / 30)
    } else if (name === 'total_days' && value) {
      const days = parseInt(value)
      newFormData.duration_days = days
      newFormData.duration_months = Math.round(days / 30)
    }

    // Tự động tính ngày hoàn thành khi có start_date và total_days
    if ((name === 'start_date' || name === 'duration_months' || name === 'duration_days' || name === 'total_days')) {
      const startDate = name === 'start_date' ? value : newFormData.start_date
      const totalDays = newFormData.total_days || 0
      
      if (startDate && totalDays > 0) {
        const start = new Date(startDate)
        const end = new Date(start)
        end.setDate(end.getDate() + parseInt(totalDays))
        newFormData.end_date = end.toISOString().split('T')[0]
      }
    }

    setFormData(newFormData)
  }

  // Filter projects with useMemo for performance
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const matchesSearch = 
        project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.location?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [projects, searchTerm, statusFilter])

  // Advanced pagination for Projects
  const [projPage, setProjPage] = useState(1)
  const [projPageSize, setProjPageSize] = useState(25)
  const totalProj = filteredProjects.length
  const projStart = (projPage - 1) * projPageSize
  const projEnd = Math.min(projStart + projPageSize, totalProj)
  const displayedProjects = useMemo(() => filteredProjects.slice(projStart, projEnd), [filteredProjects, projStart, projEnd])
  useEffect(() => { setProjPage(1) }, [searchTerm, statusFilter])

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý dự án</h1>
        <div className="flex gap-2">
          <ExcelImportButton
            onImport={handleImport}
            templateData={[{
              'Mã dự án': 'DA001',
              'Tên dự án': 'Ví dụ: Cầu Mỹ Thuận 2',
              'Mô tả': 'Mô tả chi tiết dự án',
              'Địa điểm': 'Vĩnh Long - Tiền Giang',
              'Trạng thái': 'planning/active/completed/cancelled',
              'Ngày bắt đầu': 'YYYY-MM-DD',
              'Số ngày thực hiện': '730',
              'Thời gian (tháng)': '24',
              'Số hợp đồng': 'HĐ-2024-001',
              'Số lần gia hạn': '0',
              'Ngày gia hạn': 'YYYY-MM-DD',
              'Ngân sách': '500000000000'
            }]}
            templateName="MauImportDuAn"
          >
            <DocumentArrowUpIcon className="w-5 h-5" />
            Import Excel
          </ExcelImportButton>
          
          <ExcelExportButton
            data={handleExport()}
            filename="DanhSachDuAn"
            disabled={filteredProjects.length === 0}
          >
            <DocumentArrowDownIcon className="w-5 h-5" />
            Export Excel
          </ExcelExportButton>
          
          {profile?.role === 'manager' && (
            <button
              onClick={() => {
                setEditingProject(null)
                resetForm()
                setShowModal(true)
              }}
              className="btn-primary flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              Thêm dự án
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid gap-4 grid-autofit-240">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm dự án..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <FunnelIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="planning">Đang lên kế hoạch</option>
              <option value="active">Đang thực hiện</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-end text-sm text-gray-600">
            Tổng: <span className="font-semibold ml-1">{filteredProjects.length}</span> dự án
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 [&>thead>tr>th]:text-center [&>thead>tr>th]:align-middle [&>tbody>tr>td]:align-middle [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mã dự án
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tên dự án
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Địa điểm
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ngày bắt đầu
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ngày hoàn thành
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Số ngày TH
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Số lần GH
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                    Không tìm thấy dự án nào
                  </td>
                </tr>
              ) : (
                displayedProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{project.code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{project.name}</div>
                      <div className="text-sm text-gray-500 line-clamp-1">{project.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{project.location}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(project.start_date)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(project.end_date)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {project.total_days ? `${project.total_days} ngày` : '-'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {project.duration_months ? `(${project.duration_months} tháng)` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {project.extension_count || 0}
                      </div>
                      {project.extension_date && (
                        <div className="text-xs text-gray-500">
                          {formatDate(project.extension_date)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getProjectStatusColor(project.status)}`}>
                        {getProjectStatusText(project.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative inline-block text-left">
                        <button
                          ref={(el) => { if (el) actionBtnRefs.current[project.id] = el }}
                          onClick={(e) => { e.stopPropagation(); setOpenActionMenuId(prev => prev === project.id ? null : project.id) }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          title="Thao tác"
                        >
                          <EllipsisVerticalIcon className="h-5 w-5" />
                        </button>
                        <PortalDropdown
                          open={openActionMenuId === project.id}
                          onClose={() => setOpenActionMenuId(null)}
                          anchorRef={{ current: actionBtnRefs.current[project.id] }}
                          width={220}
                        >
                          <div className="py-1 text-sm">
                            <div className="px-3 py-2 text-gray-500 uppercase tracking-wide text-[11px]">Thao tác</div>
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 inline-flex items-center gap-2"
                              onClick={() => { setOpenActionMenuId(null); openDocs(project) }}
                            >
                              <EyeIcon className="h-4 w-4"/> Xem biên bản họp
                            </button>
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 inline-flex items-center gap-2"
                              onClick={() => { setOpenActionMenuId(null); handleEdit(project) }}
                            >
                              <PencilIcon className="h-4 w-4"/> Sửa
                            </button>
                            {profile?.role === 'manager' && (
                              <button
                                className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-700 inline-flex items-center gap-2"
                                onClick={() => { setOpenActionMenuId(null); handleDelete(project) }}
                              >
                                <TrashIcon className="h-4 w-4"/> Xóa
                              </button>
                            )}
                          </div>
                        </PortalDropdown>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
            <div className="p-3 border-t border-gray-100">
              <Pagination
                total={totalProj}
                page={projPage}
                pageSize={projPageSize}
                onChange={({ page, pageSize }) => { setProjPage(page); setProjPageSize(pageSize) }}
              />
            </div>
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingProject ? 'Sửa dự án' : 'Thêm dự án mới'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingProject(null)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mã dự án <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="VD: DA001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trạng thái
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="planning">Đang lên kế hoạch</option>
                    <option value="active">Đang thực hiện</option>
                    <option value="completed">Hoàn thành</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên dự án <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập tên dự án"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Mô tả chi tiết dự án"
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <VoiceInput
                    placeholder="🎤 Nhập giọng nói"
                    onTranscript={(text) => {
                      setFormData({ 
                        ...formData, 
                        description: formData.description 
                          ? formData.description + ' ' + text 
                          : text 
                      })
                    }}
                    className="w-full justify-center"
                  />
                  <div className="w-full">
                    <OCRInput
                      onTextExtracted={(text) => {
                        setFormData({ 
                          ...formData, 
                          description: formData.description 
                            ? formData.description + '\n\n' + text 
                            : text 
                        })
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Địa điểm
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="VD: Hà Nội"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ngày bắt đầu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thời hạn (tháng)
                  </label>
                  <input
                    type="number"
                    name="duration_months"
                    value={formData.duration_months}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="VD: 12"
                  />
                  <p className="text-xs text-gray-500 mt-1">Sẽ tự động quy đổi ra số ngày (x30)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số ngày thực hiện
                  </label>
                  <input
                    type="number"
                    name="total_days"
                    value={formData.total_days}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="VD: 365"
                  />
                  <p className="text-xs text-gray-500 mt-1">Hoặc nhập trực tiếp số ngày</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ngày hoàn thành dự kiến
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                    placeholder="Tự động tính"
                  />
                  <p className="text-xs text-gray-500 mt-1">Tự động: Ngày bắt đầu + Số ngày TH</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số lần gia hạn HĐ
                  </label>
                  <input
                    type="number"
                    name="extension_count"
                    value={formData.extension_count}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="VD: 0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ngày gia hạn HĐ
                  </label>
                  <input
                    type="date"
                    name="extension_date"
                    value={formData.extension_date}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Ngày gia hạn gần nhất (nếu có)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ngân sách (VNĐ)
                  </label>
                  <input
                    type="number"
                    name="budget"
                    value={formData.budget}
                    onChange={handleChange}
                    min="0"
                    step="1000000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="VD: 10000000000"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingProject(null)
                    resetForm()
                  }}
                  className="btn-secondary"
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  {editingProject ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {showDocsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Biên bản họp · {docsProject?.name}
              </h3>
              <button
                onClick={() => {
                  setShowDocsModal(false)
                  setDocsProject(null)
                  setDocs([])
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            {/* Upload form */}
            <form onSubmit={handleUploadDoc} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Tiêu đề biên bản (tùy chọn)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 items-center">
                <input
                  id="projectDocFile"
                  type="file"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  accept="application/pdf"
                  className="hidden"
                />
                <label htmlFor="projectDocFile" className="btn-secondary cursor-pointer whitespace-nowrap">Chọn tệp</label>
                {docFile && (
                  <span className="text-sm text-gray-600 truncate max-w-[220px]" title={docFile.name}>{docFile.name}</span>
                )}
                <button type="submit" className="btn-primary whitespace-nowrap">Tải lên</button>
              </div>
            </form>

            {/* Search & Sort */}
            <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 relative">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={async (e) => { setDocSearch(e.target.value); if (docsProject) { await loadDocs(docsProject.id) } }}
                  placeholder="Tìm kiếm tiêu đề/tên file..."
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="relative">
                <select
                  value={docSort}
                  onChange={async (e) => { setDocSort(e.target.value); if (docsProject) { await loadDocs(docsProject.id) } }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="meeting_desc">Sắp xếp: Ngày họp mới → cũ</option>
                  <option value="meeting_asc">Sắp xếp: Ngày họp cũ → mới</option>
                  <option value="created_desc">Tạo mới → cũ</option>
                  <option value="created_asc">Tạo cũ → mới</option>
                </select>
              </div>
            </div>

            {/* List */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 [&>thead>tr>th]:text-center [&>thead>tr>th]:align-middle [&>tbody>tr>td]:align-middle [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tiêu đề</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày họp</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tệp</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {docsLoading ? (
                      <tr><td colSpan="4" className="px-6 py-6 text-center"><LoadingSpinner small /></td></tr>
                    ) : docs.length === 0 ? (
                      <tr><td colSpan="4" className="px-6 py-6 text-center text-gray-500">Chưa có biên bản</td></tr>
                    ) : (
                      docs.map((d) => (
                        <tr key={d.id}>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{d.title || d.file_name}</div>
                            {d.description && <div className="text-sm text-gray-500 line-clamp-1">{d.description}</div>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">{d.meeting_date || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <a href={d.file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{d.file_name}</a>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex justify-end gap-2">
                              <a href={d.file_url} target="_blank" rel="noreferrer" className="btn-secondary">Xem/Tải</a>
                              {(profile?.role === 'manager' || profile?.id === d.uploaded_by) && (
                                <button onClick={() => handleDeleteDoc(d)} className="btn-danger">Xóa</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectsPage
