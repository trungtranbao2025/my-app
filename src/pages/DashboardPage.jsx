import React, { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { 
  ChartBarIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentArrowUpIcon,
  PaperClipIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  TrashIcon,
  ClipboardDocumentCheckIcon,
  ArchiveBoxArrowDownIcon,
  FolderArrowDownIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase'
// Removed reportsApi heavy multi calls; replaced by single dashboard_overview RPC
import { useAuth } from '../contexts/AuthContext'
import { formatDate, getProjectStatusColor, getProjectStatusText } from '../utils/helpers'
import TaskStatusPill from '../components/TaskStatusPill'
import LoadingSkeleton from '../components/LoadingSkeleton'
import Tooltip from '../components/Tooltip'
import { useNotifications } from '../contexts/NotificationContext'
import { projectsApi, projectDocsApi, tasksApi, progressApi } from '../lib/api'
import { buildProgressSummary } from '../utils/progressSummary'

// Helpers reused from ProgressPage for progress summary
const computeTimeProgress = (start_date, due_date) => {
  try {
    if (!start_date || !due_date) return 0
    const s = new Date(start_date)
    const d = new Date(due_date)
    const now = new Date()
    if (isNaN(s) || isNaN(d) || d <= s) return 0
    const total = d.getTime() - s.getTime()
    const done = Math.min(Math.max(now.getTime() - s.getTime(), 0), total)
    return Math.round((done / total) * 100)
  } catch {
    return 0
  }
}
const getDaysRemainingSimple = (dueDate) => {
  try {
    if (!dueDate) return null
    const due = new Date(dueDate)
    const today = new Date()
    due.setHours(0,0,0,0)
    today.setHours(0,0,0,0)
    const diff = Math.ceil((due - today) / (1000*60*60*24))
    return diff
  } catch { return null }
}
const stripAreaTagFromTitle = (title) => String(title || '').replace(/\s*\[(?:KV|Khu\s*vuc|Khu\s*vực)\s*:\s*[^\]]+\]\s*/i, '').trim()
const parseAreaTagFromTitle = (title) => {
  if (!title) return ''
  const m = String(title).match(/\[(?:KV|Khu\s*vuc|Khu\s*vực)\s*:\s*([^\]]+)\]/i)
  return m ? m[1].trim() : ''
}
const getTaskArea = (t) => (t?.area || t?.khu_vuc || t?.zone || parseAreaTagFromTitle(t?.title) || '')
const getBaseManpower = (t) => {
  const mp = Number(t?.manpower)
  if (!isNaN(mp) && mp >= 0) return mp
  const count = (t?.additional_assignees?.length || 0) + (t?.assigned_to ? 1 : 0)
  return count
}

const DashboardPage = () => {
  const { profile } = useAuth()
  const { refresh: refreshNotifications } = useNotifications()
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    upcomingTasks: 0
  })
  const [overdueTasks, setOverdueTasks] = useState([])
  const [upcomingTasks, setUpcomingTasks] = useState([])
  const [allTasks, setAllTasks] = useState([])
  // Details modal state
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsTitle, setDetailsTitle] = useState('')
  const [detailsItems, setDetailsItems] = useState([])
  const [detailsKind, setDetailsKind] = useState('projects') // 'projects' | 'all' | 'completed' | 'upcoming' | 'overdue'
  const [detailsProjects, setDetailsProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [openSummary, setOpenSummary] = useState(null) // 'all'|'completed'|'in_progress'|'nearly_due'|'overdue'|null
  // Progress summary data source (must mirror ProgressPage)
  const SELECTED_PROJECT_KEY = 'progress_selected_project_id'
  const [selectedProgressProjectId, setSelectedProgressProjectId] = useState(() => {
    try { return localStorage.getItem(SELECTED_PROJECT_KEY) || '' } catch { return '' }
  })
  const [progressItems, setProgressItems] = useState([])
  const [progressLoading, setProgressLoading] = useState(false)
  // Removed reminder pending counter and actions

  // Toggle between content types
  // 'minutes' (Biên bản họp) | 'reports' (Báo cáo định kỳ) | 'tech' (Thư kỹ thuật) | 'incoming' (Công văn đến) | 'outgoing' (Công văn đi) | 'legal' (Hồ sơ pháp lý)
  const [contentType, setContentType] = useState('minutes')

  // Projects and Documents (Meeting Minutes)
  const [allProjects, setAllProjects] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docs, setDocs] = useState([])
  const [docsActivated, setDocsActivated] = useState(false)
  const [docSearch, setDocSearch] = useState('')
  const [docSort, setDocSort] = useState('meeting_desc')
  const [docFilterProject, setDocFilterProject] = useState('')
  const [docFromDate, setDocFromDate] = useState('')
  const [docToDate, setDocToDate] = useState('')
  const [upProjectId, setUpProjectId] = useState('')
  const [upTitle, setUpTitle] = useState('')
  const [upDate, setUpDate] = useState('')
  const [upFile, setUpFile] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)

  // Reports (Periodic reports for tasks)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsActivated, setReportsActivated] = useState(false)
  const [reports, setReports] = useState([])
  // Selection for batch download (tài liệu & báo cáo)
  const [selectedIds, setSelectedIds] = useState(new Set())
  // Upload states for reports
  const [upReportProjectId, setUpReportProjectId] = useState('')
  const [upReportTaskId, setUpReportTaskId] = useState('')
  const [upReportFile, setUpReportFile] = useState(null)
  const [upProjectTasks, setUpProjectTasks] = useState([])

  // Debounce for filter/search changes
  useEffect(() => {
    const t = setTimeout(() => {
      if (contentType === 'reports') {
        loadReports({})
      } else {
        loadDocs({})
      }
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, docSearch, docFilterProject, docFromDate, docToDate, docSort])

  // Clear selection when switching content type
  useEffect(() => { setSelectedIds(new Set()) }, [contentType])

  useEffect(() => {
    loadDashboardData()
    // Preload projects and documents for meeting minutes section
    loadProjectsAndDocs()
  }, [])

  // When projects list is available, ensure a selected project for progress summary
  useEffect(() => {
    if (!allProjects || allProjects.length === 0) return
    if (selectedProgressProjectId && allProjects.some(p => p.id === selectedProgressProjectId)) return
    const fallback = allProjects[0]?.id || ''
    setSelectedProgressProjectId(fallback)
    try { localStorage.setItem(SELECTED_PROJECT_KEY, fallback) } catch {}
  }, [allProjects])

  // Load progress items for the selected project
  useEffect(() => {
    const run = async () => {
      if (!selectedProgressProjectId) { setProgressItems([]); return }
      try {
        setProgressLoading(true)
        const rows = await progressApi.getByProject(selectedProgressProjectId)
        setProgressItems(Array.isArray(rows) ? rows : [])
      } catch (e) {
        console.error('loadProgressItems error:', e)
        setProgressItems([])
      } finally { setProgressLoading(false) }
    }
    run()
  }, [selectedProgressProjectId])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('dashboard_overview')
      if (error) throw error
      const overview = data || {}
      // Fallback: also load all tasks to compute upcoming/overdue details for the modal and counts
      const tasks = await tasksApi.getAll().catch(() => [])
      setAllTasks(tasks)

      // Helpers
      const startOfToday = new Date(); startOfToday.setHours(0,0,0,0)
      const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
      const inDays = (due) => {
        if (!due) return null
        const dd = new Date(due)
        dd.setHours(0,0,0,0)
        return Math.floor((dd - startOfToday) / (1000*60*60*24))
      }
      const isCompleted = (t) => (t.status === 'completed' || t.is_completed)
      const overdueList = (tasks || []).filter(t => !isCompleted(t) && t.due_date && inDays(t.due_date) < 0)
      const upcomingList = (tasks || []).filter(t => !isCompleted(t) && t.due_date) 
        .filter(t => {
          const d = inDays(t.due_date)
          return d >= 0 && d <= 2
        })

      setStats({
        totalProjects: overview?.projects?.total ?? 0,
        totalTasks: (tasks || []).length || overview?.tasks?.total || 0,
        completedTasks: (tasks || []).filter(isCompleted).length || overview?.tasks?.completed || 0,
        overdueTasks: overdueList.length || overview?.tasks?.overdue || 0,
        upcomingTasks: upcomingList.length
      })
      // Overdue tasks list
      setOverdueTasks(overdueList)
      // Upcoming tasks list (within 7 days)
  setUpcomingTasks(upcomingList)
      // Reminder scheduler removed
    } catch (e) {
      console.error('Error loading dashboard overview:', e)
      toast.error('Không thể tải dữ liệu tổng quan')
    } finally {
      setLoading(false)
    }
  }

  // Progress summary (counts + lists) derived from allTasks
  const progressSummary = useMemo(() => buildProgressSummary(progressItems), [progressItems])

  const computeItemsByKind = async (kind) => {
    if (kind === 'projects') {
      if (!detailsProjects || detailsProjects.length === 0) {
        try {
          const rows = await projectsApi.getAllFull()
          setDetailsProjects(rows || [])
          return rows || []
        } catch {
          return allProjects || []
        }
      }
      return detailsProjects
    }
    if (kind === 'all') return allTasks || []
    if (kind === 'completed') return (allTasks || []).filter(t => t.status === 'completed' || t.is_completed)
    if (kind === 'upcoming') return upcomingTasks
    if (kind === 'overdue') return overdueTasks
    return []
  }

  const titleByKind = (kind) => ({
    projects: 'Dự án đang theo dõi',
    all: 'Tất cả công việc',
    completed: 'Công việc đã hoàn thành',
    upcoming: 'Công việc sắp đến hạn (≤ 2 ngày)',
    overdue: 'Công việc quá hạn'
  }[kind] || '')

  const openDetails = async (kind) => {
    const items = await computeItemsByKind(kind)
    setDetailsKind(kind)
    setDetailsItems(items)
    setDetailsTitle(titleByKind(kind))
    setDetailsOpen(true)
  }

  const loadProjectsAndDocs = async () => {
    try {
      const projects = await projectsApi.getAll()
      setAllProjects(projects || [])
      // Do not load docs initially; wait for search/filter activation
    } catch (e) {
      console.error('Error loading projects/docs:', e)
    }
  }

  const changeProgressProject = (id) => {
    setSelectedProgressProjectId(id)
    try { localStorage.setItem(SELECTED_PROJECT_KEY, id || '') } catch {}
  }

  const hasCriteria = ({ projectId, search, fromDate, toDate }) => {
    const s = (search || '').trim()
    return Boolean(s || projectId || fromDate || toDate)
  }

  const loadDocs = async ({
    projectId = docFilterProject,
    search = docSearch,
    fromDate = docFromDate,
    toDate = docToDate,
    sort = docSort
  } = {}) => {
    try {
      if (!hasCriteria({ projectId, search, fromDate, toDate })) {
        setDocs([])
        setDocsActivated(false)
        return
      }
      setDocsActivated(true)
      setDocsLoading(true)
      const category = contentType === 'minutes' ? 'minutes'
        : contentType === 'tech' ? 'tech'
        : contentType === 'incoming' ? 'incoming'
        : contentType === 'outgoing' ? 'outgoing'
        : contentType === 'legal' ? 'legal'
        : undefined
      const data = await projectDocsApi.searchAll({ projectId: projectId || undefined, category, search, fromDate: fromDate || undefined, toDate: toDate || undefined, sort, limit: 100 })
      setDocs(data || [])
    } catch (e) {
      console.error('loadDocs error:', e)
      toast.error('Không thể tải tài liệu')
    } finally {
      setDocsLoading(false)
    }
  }

  const handleUploadDoc = async (e) => {
    e?.preventDefault?.()
    if (!upProjectId) { toast.error('Vui lòng chọn dự án'); return }
    if (!upFile) { toast.error('Vui lòng chọn file'); return }
    try {
      const category = contentType === 'minutes' ? 'minutes'
        : contentType === 'tech' ? 'tech'
        : contentType === 'incoming' ? 'incoming'
        : contentType === 'outgoing' ? 'outgoing'
        : contentType === 'legal' ? 'legal'
        : null
      await projectDocsApi.upload(upProjectId, upFile, {
        title: upTitle || upFile.name,
        meetingDate: upDate || null,
        category: category || undefined
      })
      const label = contentType === 'minutes' ? 'biên bản họp'
        : contentType === 'tech' ? 'thư kỹ thuật'
        : contentType === 'incoming' ? 'công văn đến'
        : contentType === 'outgoing' ? 'công văn đi'
        : contentType === 'legal' ? 'hồ sơ pháp lý'
        : 'tài liệu'
      toast.success(`Đã tải lên ${label}`)
      setUpFile(null); setUpTitle(''); setUpDate('')
      // Refresh list respecting current filters
      await loadDocs({})
    } catch (e) {
      console.error(e)
      toast.error('Tải lên thất bại: ' + (e.message || ''))
    }
  }

  const loadReports = async ({
    projectId = docFilterProject,
    search = docSearch,
    fromDate = docFromDate,
    toDate = docToDate,
    sort = docSort === 'created_asc' || docSort === 'created_desc' ? docSort : 'created_desc'
  } = {}) => {
    try {
      if (!hasCriteria({ projectId, search, fromDate, toDate })) {
        setReports([])
        setReportsActivated(false)
        return
      }
      setReportsActivated(true)
      setReportsLoading(true)
      const data = await tasksApi.searchAllReports({ projectId: projectId || undefined, search, fromDate: fromDate || undefined, toDate: toDate || undefined, sort, limit: 100 })
      setReports(data || [])
    } catch (e) {
      console.error('loadReports error:', e)
      toast.error('Không thể tải báo cáo định kỳ')
    } finally {
      setReportsLoading(false)
    }
  }

  // Upload report (PDF) for a selected task
  const handleUploadReport = async (e) => {
    e?.preventDefault?.()
    if (!upReportProjectId) { toast.error('Vui lòng chọn dự án'); return }
    if (!upReportTaskId) { toast.error('Vui lòng chọn công việc'); return }
    if (!upReportFile) { toast.error('Vui lòng chọn file'); return }
    try {
      await tasksApi.uploadPdfReport(upReportTaskId, upReportFile)
      toast.success('Đã tải lên báo cáo')
      setUpReportFile(null); setUpReportTaskId('')
      await loadReports({})
    } catch (e) {
      console.error(e)
      toast.error('Tải lên thất bại: ' + (e.message || ''))
    }
  }

  // Load tasks when selecting a project (for report upload)
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        if (!upReportProjectId) { setUpProjectTasks([]); return }
        const tasks = await tasksApi.getByProject(upReportProjectId)
        setUpProjectTasks(tasks || [])
      } catch (e) {
        console.error('Error loading tasks for project:', e)
        setUpProjectTasks([])
      }
    }
    fetchTasks()
  }, [upReportProjectId])

  const handleDeleteDoc = async (doc) => {
    if (!window.confirm('Xóa tài liệu này?')) return
    try {
      await projectDocsApi.delete(doc)
      toast.success('Đã xóa')
      await loadDocs({})
    } catch (e) {
      console.error(e)
      toast.error('Không thể xóa')
    }
  }

  // Build download URL for Supabase public files (adds ?download=filename)
  const buildDownloadUrl = (url, filename) => {
    if (!url) return '#'
    try {
      const u = new URL(url)
      if (!u.searchParams.has('download')) {
        u.searchParams.set('download', filename || '')
      }
      return u.toString()
    } catch {
      const sep = url.includes('?') ? '&' : '?'
      return `${url}${sep}download=${encodeURIComponent(filename || '')}`
    }
  }

  // ===== Batch download helpers =====
  const sanitize = (name) => String(name || 'file').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim()
  const contentLabel = (type) => (
    type === 'minutes' ? 'bien-ban-hop' :
    type === 'reports' ? 'bao-cao-dinh-ky' :
    type === 'tech' ? 'thu-ky-thuat' :
    type === 'incoming' ? 'cong-van-den' :
    type === 'outgoing' ? 'cong-van-di' :
    type === 'legal' ? 'ho-so-phap-ly' : 'tai-lieu'
  )
  const getVisibleItems = () => (contentType === 'reports' ? (reports || []) : (docs || []))
  const isAllVisibleSelected = () => {
    const items = getVisibleItems()
    if (!items || items.length === 0) return false
    return items.every(it => selectedIds.has(it.id))
  }
  const toggleSelectAllVisible = () => {
    const items = getVisibleItems()
    if (!items || items.length === 0) return
    const allSelected = isAllVisibleSelected()
    const next = new Set(selectedIds)
    if (allSelected) {
      items.forEach(it => next.delete(it.id))
    } else {
      items.forEach(it => next.add(it.id))
    }
    setSelectedIds(next)
  }
  const toggleSelectOne = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }
  const clearSelection = () => setSelectedIds(new Set())

  const downloadSelectedAsZip = async () => {
    const itemsMap = new Map(getVisibleItems().map(d => [d.id, d]))
    const selected = [...selectedIds].map(id => itemsMap.get(id)).filter(Boolean)
    if (selected.length === 0) { toast.error('Chưa chọn tài liệu nào'); return }
    try {
      const zip = new JSZip()
      const root = zip.folder(contentLabel(contentType))
      let added = 0
      for (const it of selected) {
        const url = it.file_url
        const name = sanitize(it.file_name || it.task?.title || `file-${it.id}`)
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Tải tệp thất bại: ${name}`)
        const blob = await res.blob()
        root.file(name, blob)
        added++
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')
      saveAs(blob, `${contentLabel(contentType)}-${stamp}.zip`)
      toast.success(`Đã đóng gói ${added} tệp`)
    } catch (e) {
      console.error(e)
      toast.error('Không thể tạo gói tải xuống')
    }
  }

  const downloadAllVisibleAsZip = async () => {
    const items = getVisibleItems()
    if (!items || items.length === 0) { toast.error('Không có tệp để tải'); return }
    try {
      const zip = new JSZip()
      const root = zip.folder(contentLabel(contentType))
      let added = 0
      for (const it of items) {
        const url = it.file_url
        const name = sanitize(it.file_name || it.task?.title || `file-${it.id}`)
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Tải tệp thất bại: ${name}`)
        const blob = await res.blob()
        root.file(name, blob)
        added++
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')
      saveAs(blob, `${contentLabel(contentType)}-tat-ca-${stamp}.zip`)
      toast.success(`Đã đóng gói ${added} tệp`)
    } catch (e) {
      console.error(e)
      toast.error('Không thể tạo gói tải xuống')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Tổng quan</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LoadingSkeleton type="card" count={4} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LoadingSkeleton type="list" count={5} />
          <LoadingSkeleton type="list" count={5} />
        </div>
      </div>
    )
  }

  const StatCard = ({ title, value, icon: Icon, color, description, onClick, tooltip }) => {
    const content = (
      <button type="button" onClick={onClick} className="card text-left hover:shadow-lg transition shadow-sm border border-gray-100/60">
        <div className="flex items-center">
          <div className={`flex-shrink-0 ${color}`}>
            <Icon className="h-6 w-6 text-white p-1 rounded-lg" />
          </div>
          <div className="ml-3">
            <p className="text-xs font-medium text-gray-500">{title}</p>
            <p className="text-xl font-semibold text-gray-900">{value}</p>
            {description && (
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </button>
    )
    return tooltip ? <Tooltip text={tooltip}>{content}</Tooltip> : content
  }

  return (
    <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
        <div className="px-4 py-5 sm:px-6">
          <h1 className="text-xl font-bold text-white">
            Chào mừng, {profile?.full_name}!
          </h1>
          <p className="mt-1 text-sm text-blue-100">
            Tổng quan hoạt động dự án và công việc của bạn
          </p>
        </div>
      </div>

      {/* Tổng hợp tiến độ (như trang Tiến độ) */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-cyan-600" />
            Tổng hợp tiến độ
          </h2>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Dự án:</label>
            <select className="input select min-w-[220px]" value={selectedProgressProjectId} onChange={(e)=>changeProgressProject(e.target.value)}>
              {(allProjects||[]).map(p => (
                <option key={p.id} value={p.id}>{p.name || p.title || p.code || p.id}</option>
              ))}
            </select>
            <Tooltip text="Tổng hợp trạng thái tiến độ theo dự án được chọn; nhấn thẻ để xem chi tiết."><InformationCircleIcon className="w-5 h-5 text-gray-400" /></Tooltip>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Tooltip text="Tất cả công việc">
          <button onClick={()=>setOpenSummary(prev=> prev==='all'? null : 'all')} className={`text-left w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow ${openSummary==='all'?'ring-2 ring-cyan-500':''}`} title="Tất cả tasks">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Tổng công việc</div>
                <div className="text-2xl font-semibold text-gray-900">{progressSummary.counts.total}</div>
                <div className="text-xs text-gray-400 mt-1">Tất cả tasks</div>
              </div>
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-sky-50 text-sky-600"><ChartBarIcon className="h-5 w-5"/></div>
            </div>
          </button>
          </Tooltip>
          <Tooltip text="Công việc đã hoàn thành">
          <button onClick={()=>setOpenSummary(prev=> prev==='completed'? null : 'completed')} className={`text-left w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow ${openSummary==='completed'?'ring-2 ring-cyan-500':''}`} title="Đã hoàn thành">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Hoàn thành</div>
                <div className="text-2xl font-semibold text-emerald-600">{progressSummary.counts.completed}</div>
                <div className="text-xs text-emerald-600 mt-1">% ước tính</div>
              </div>
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600"><CheckCircleIcon className="h-5 w-5"/></div>
            </div>
          </button>
          </Tooltip>
          <Tooltip text="Đang thực hiện">
          <button onClick={()=>setOpenSummary(prev=> prev==='in_progress'? null : 'in_progress')} className={`text-left w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow ${openSummary==='in_progress'?'ring-2 ring-cyan-500':''}`} title="Đang thực hiện">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Đang thực hiện</div>
                <div className="text-2xl font-semibold text-amber-600">{progressSummary.counts.in_progress}</div>
                <div className="text-xs text-gray-500 mt-1">Đang xử lý</div>
              </div>
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600"><ClockIcon className="h-5 w-5"/></div>
            </div>
          </button>
          </Tooltip>
          <Tooltip text="Sắp đến hạn (≤ 2 ngày)">
          <button onClick={()=>setOpenSummary(prev=> prev==='nearly_due'? null : 'nearly_due')} className={`text-left w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow ${openSummary==='nearly_due'?'ring-2 ring-cyan-500':''}`} title="Sắp đến hạn (≤ 2 ngày)">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Sắp đến hạn</div>
                <div className="text-2xl font-semibold text-orange-600">{progressSummary.counts.nearly_due}</div>
                <div className="text-xs text-gray-500 mt-1">≤ 2 ngày</div>
              </div>
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-orange-50 text-orange-600"><ExclamationTriangleIcon className="h-5 w-5"/></div>
            </div>
          </button>
          </Tooltip>
          <Tooltip text="Công việc trễ hạn">
          <button onClick={()=>setOpenSummary(prev=> prev==='overdue'? null : 'overdue')} className={`text-left w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow ${openSummary==='overdue'?'ring-2 ring-cyan-500':''}`} title="Trễ hạn">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Trễ hạn</div>
                <div className="text-2xl font-semibold text-rose-600">{progressSummary.counts.overdue}</div>
                <div className="text-xs text-rose-600 mt-1">Cần xử lý</div>
              </div>
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-rose-50 text-rose-600"><ExclamationTriangleIcon className="h-5 w-5"/></div>
            </div>
          </button>
          </Tooltip>
        </div>

        {openSummary && (
          <div className="mt-3 bg-white rounded-lg shadow border border-gray-200">
            <div className="p-3 flex items-center justify-between">
              <div className="font-semibold">Chi tiết: {openSummary==='all'?'Tất cả': openSummary==='completed'?'Hoàn thành': openSummary==='in_progress'?'Đang thực hiện': openSummary==='nearly_due'?'Sắp đến hạn':'Trễ hạn'}</div>
              <button className="btn-secondary" onClick={()=>setOpenSummary(null)}>Đóng</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full w-full table-auto divide-y divide-gray-200 border border-gray-200 [&>thead>tr>th]:text-left [&>thead>tr>th]:align-middle [&>tbody>tr>td]:align-middle [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">STT</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Khu vực</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Nội dung</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Hạn hoàn thành</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">% thực tế</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Nhân công</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Y/c tăng cường</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {progressSummary.lists[openSummary].map((t, idx) => {
                    const timePct = computeTimeProgress(t.start_date, t.due_date)
                    const baseManpower = getBaseManpower(t)
                    const currentManpower = baseManpower
                    const actualPct = Number(t.progress_percent || 0)
                    const needManpowerNum = timePct > actualPct
                      ? Math.round((timePct / Math.max(actualPct, 1)) * 1.3 * Math.max(currentManpower, 0))
                      : 0
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-700">{idx+1}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{getTaskArea(t) || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 whitespace-normal break-words">{stripAreaTagFromTitle(t.title)}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{t.due_date ? t.due_date : '-'}</td>
                        <td className="px-3 py-2"><TaskStatusPill task={t} /></td>
                        <td className="px-3 py-2 text-sm text-gray-700">{t.progress_percent || 0}%</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{currentManpower}</td>
                        <td className="px-3 py-2 text-sm">
                          <span className={needManpowerNum > 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}>{needManpowerNum}</span>
                        </td>
                        <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                          <a href="#/progress" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Mở tiến độ</a>
                        </td>
                      </tr>
                    )
                  })}
                  {progressSummary.lists[openSummary].length === 0 && (
                    <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-500">Không có công việc</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

  {/* Stats Grid - Tổng hợp công việc */}
  <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardDocumentCheckIcon className="w-5 h-5 text-indigo-600" />
            Tổng hợp công việc
          </h2>
          <Tooltip text="Chỉ số tổng quan; bấm để xem chi tiết danh sách."><InformationCircleIcon className="w-5 h-5 text-gray-400" /></Tooltip>
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          title="Tổng dự án"
          value={stats.totalProjects}
          icon={ChartBarIcon}
          color="bg-blue-500"
          description="Dự án đang theo dõi"
          onClick={() => openDetails('projects')}
          tooltip="Danh sách dự án đang theo dõi"
        />
        <StatCard
          title="Tổng công việc"
          value={stats.totalTasks}
          icon={ClockIcon}
          color="bg-indigo-500"
          description="Công việc trong hệ thống"
          onClick={() => openDetails('all')}
          tooltip="Tất cả công việc của bạn"
        />
        <StatCard
          title="Hoàn thành"
          value={stats.completedTasks}
          icon={CheckCircleIcon}
          color="bg-green-500"
          description="Công việc đã hoàn thành"
          onClick={() => openDetails('completed')}
          tooltip="Các công việc đã hoàn thành"
        />
        <StatCard
          title="Sắp đến hạn"
          value={stats.upcomingTasks}
          icon={CalendarIcon}
          color="bg-orange-500"
          description="Trong 2 ngày tới"
          onClick={() => openDetails('upcoming')}
          tooltip="Công việc đến hạn trong 2 ngày"
        />
        <StatCard
          title="Quá hạn"
          value={stats.overdueTasks}
          icon={ExclamationTriangleIcon}
          color="bg-red-500"
          description="Cần xử lý ngay"
          onClick={() => openDetails('overdue')}
          tooltip="Công việc đã trễ hạn"
        />
        </div>
      </div>

      {/* Các vùng dữ liệu chi tiết (quá hạn / sắp đến hạn / sự kiện) đã được ẩn theo yêu cầu.
          Sự kiện sắp tới chỉ gửi thông báo tới nhân sự vào đúng ngày qua hộp tin nhắn. */}

      {/* Documents & Reports: Upload + Advanced Search */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {contentType === 'minutes' ? 'Biên bản họp' :
             contentType === 'reports' ? 'Báo cáo định kỳ' :
             contentType === 'tech' ? 'Thư kỹ thuật' :
             contentType === 'incoming' ? 'Công văn đến' :
             contentType === 'outgoing' ? 'Công văn đi' :
             contentType === 'legal' ? 'Hồ sơ pháp lý' : 'Tài liệu'}
          </h2>
          <div className="w-60">
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="minutes">Biên bản họp</option>
              <option value="reports">Báo cáo định kỳ</option>
              <option value="tech">Thư kỹ thuật</option>
              <option value="incoming">Công văn đến</option>
              <option value="outgoing">Công văn đi</option>
              <option value="legal">Hồ sơ pháp lý</option>
            </select>
          </div>
        </div>

        {/* Upload form - single row full width, no horizontal scrollbar */}
        {contentType !== 'reports' ? (
          <form onSubmit={handleUploadDoc} className="mb-4">
            <div className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-3 min-w-0">
                <select
                  value={upProjectId}
                  onChange={(e) => setUpProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Chọn dự án để tải lên</option>
                  {allProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.code ? `${p.code} · ${p.name}` : p.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-4 min-w-0">
                <div className="relative">
                  <input
                    type="text"
                    value={upTitle}
                    onChange={(e) => setUpTitle(e.target.value)}
                    placeholder={contentType === 'minutes' ? 'Tiêu đề biên bản (tùy chọn)' : 'Tiêu đề (tùy chọn)'}
                    className="w-full h-11 pl-3 pr-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="col-span-2 min-w-0">
                <div className="relative">
                  <CalendarIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={upDate}
                    onChange={(e) => setUpDate(e.target.value)}
                    className="w-full h-11 pl-10 pr-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {/* Column 4: Choose file + filename */}
              <div className="col-span-2 min-w-0 flex items-center gap-3">
                <input
                  id="upFileInput"
                  type="file"
                  onChange={(e) => setUpFile(e.target.files?.[0] || null)}
                  accept="application/pdf"
                  className="hidden"
                />
                <label htmlFor="upFileInput" className="btn-secondary cursor-pointer whitespace-nowrap inline-flex items-center gap-2 shrink-0">
                  <PaperClipIcon className="w-4 h-4" /> Chọn tệp
                </label>
                {upFile && (
                  <span className="text-sm text-gray-600 truncate min-w-0" title={upFile.name}>{upFile.name}</span>
                )}
              </div>
              {/* Column 5: Upload button */}
              <div className="col-span-1 flex justify-end">
                <button type="submit" className="btn-primary whitespace-nowrap flex items-center gap-2 shrink-0"><DocumentArrowUpIcon className="w-4 h-4" /> Tải lên</button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleUploadReport} className="mb-4">
            <div className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-3 min-w-0">
                <select
                  value={upReportProjectId}
                  onChange={(e) => { setUpReportProjectId(e.target.value); setUpReportTaskId('') }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Chọn dự án để tải lên</option>
                  {allProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.code ? `${p.code} · ${p.name}` : p.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-5 min-w-0">
                <select
                  value={upReportTaskId}
                  onChange={(e) => setUpReportTaskId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={!upReportProjectId}
                >
                  <option value="">{upReportProjectId ? 'Chọn công việc' : 'Chọn dự án trước'}</option>
                  {upProjectTasks.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
              {/* Choose file + filename */}
              <div className="col-span-3 min-w-0 flex items-center gap-3">
                <input
                  id="upReportFileInput"
                  type="file"
                  onChange={(e) => setUpReportFile(e.target.files?.[0] || null)}
                  accept="application/pdf"
                  className="hidden"
                />
                <label htmlFor="upReportFileInput" className="btn-secondary cursor-pointer whitespace-nowrap inline-flex items-center gap-2 shrink-0">
                  <PaperClipIcon className="w-4 h-4" /> Chọn tệp
                </label>
                {upReportFile && (
                  <span className="text-sm text-gray-600 truncate min-w-0" title={upReportFile.name}>{upReportFile.name}</span>
                )}
              </div>
              {/* Upload button */}
              <div className="col-span-1 flex justify-end">
                <button type="submit" className="btn-primary whitespace-nowrap flex items-center gap-2 shrink-0"><DocumentArrowUpIcon className="w-4 h-4" /> Tải lên</button>
              </div>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 mb-3">
          <div className="lg:col-span-2 relative">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              value={docSearch}
              onChange={(e) => { const val = e.target.value; setDocSearch(val) }}
              placeholder="Tìm tiêu đề/tên file/tên dự án..."
              className="pl-10 w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="relative">
              <FunnelIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <select
                value={docFilterProject}
                onChange={(e) => { const v = e.target.value; setDocFilterProject(v) }}
                className="pl-10 w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả dự án</option>
                {allProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.code ? `${p.code} · ${p.name}` : p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div className="relative">
              <CalendarIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={docFromDate}
                onChange={(e) => { const v = e.target.value; setDocFromDate(v) }}
                className="w-full h-11 pl-10 pr-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <div className="relative">
              <CalendarIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={docToDate}
                onChange={(e) => { const v = e.target.value; setDocToDate(v) }}
                className="w-full h-11 pl-10 pr-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <select
              value={docSort}
              onChange={(e) => { const v = e.target.value; setDocSort(v) }}
              className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {contentType !== 'reports' ? (
                <>
                  <option value="meeting_desc">Ngày họp mới → cũ</option>
                  <option value="meeting_asc">Ngày họp cũ → mới</option>
                  <option value="created_desc">Tạo mới → cũ</option>
                  <option value="created_asc">Tạo cũ → mới</option>
                </>
              ) : (
                <>
                  <option value="created_desc">Ngày tạo mới → cũ</option>
                  <option value="created_asc">Ngày tạo cũ → mới</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Actions for selection & batch download */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-600">Đã chọn: <span className="font-medium">{selectedIds.size}</span></div>
          <div className="flex items-center gap-2">
            <Tooltip text={isAllVisibleSelected() ? 'Bỏ chọn tất cả mục đang hiển thị' : 'Chọn tất cả mục đang hiển thị'}>
              <button type="button" onClick={toggleSelectAllVisible} className="btn-secondary inline-flex items-center gap-1.5">
                <CheckCircleIcon className="w-4 h-4" /> {isAllVisibleSelected() ? 'Bỏ chọn tất cả' : 'Chọn tất cả hiển thị'}
              </button>
            </Tooltip>
            <Tooltip text="Xóa lựa chọn hiện tại">
              <button type="button" onClick={clearSelection} className="btn-secondary inline-flex items-center gap-1.5">
                <ClockIcon className="w-4 h-4" /> Bỏ chọn
              </button>
            </Tooltip>
            <Tooltip text="Đóng gói toàn bộ danh sách đang hiển thị thành một tệp ZIP">
              <button type="button" onClick={downloadAllVisibleAsZip} className="btn-secondary inline-flex items-center gap-1.5">
                <ArchiveBoxArrowDownIcon className="w-4 h-4" /> Tải tất cả hiển thị (.zip)
              </button>
            </Tooltip>
            <Tooltip text="Đóng gói các mục đang chọn thành một tệp ZIP">
              <button type="button" onClick={downloadSelectedAsZip} disabled={selectedIds.size===0} className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-50">
                <FolderArrowDownIcon className="w-4 h-4" /> Tải đã chọn (.zip)
              </button>
            </Tooltip>
          </div>
        </div>

        {/* List */}
        {contentType !== 'reports' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-gray-200 border border-gray-200 [&>thead>tr>th]:text-center [&>thead>tr>th]:align-middle [&>tbody>tr>td]:align-middle [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-center w-[44px]">
                    <input type="checkbox" checked={isAllVisibleSelected()} onChange={toggleSelectAllVisible} />
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[22%]">Dự án</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[28%]">Tiêu đề</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">{contentType === 'minutes' ? 'Ngày họp' : 'Ngày VB'}</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[26%]">Tệp</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {!docsActivated ? (
                  <tr><td colSpan="6" className="px-6 py-6 text-center text-gray-500">Nhập từ khóa hoặc chọn bộ lọc để tìm tài liệu</td></tr>
                ) : docsLoading ? (
                  <tr><td colSpan="6" className="px-6 py-6 text-center text-gray-500">Đang tải...</td></tr>
                ) : (docs || []).length === 0 ? (
                  <tr><td colSpan="6" className="px-6 py-6 text-center text-gray-500">Chưa có tài liệu</td></tr>
                ) : (
                  docs.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-4 text-center align-middle">
                        <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleSelectOne(d.id)} />
                      </td>
                      <td className="px-6 py-4 align-middle text-left">
                        <div className="text-sm font-medium text-gray-900 break-words w-full" title={d.project?.code ? `${d.project.code} · ${d.project?.name}` : (d.project?.name || '-')}>{d.project?.code ? `${d.project.code} · ${d.project.name}` : (d.project?.name || '-')}</div>
                      </td>
                      <td className="px-6 py-4 align-middle text-left">
                        <div className="break-words w-full">
                          <button type="button" className="font-medium text-primary-700 hover:underline break-words" onClick={() => setPreviewDoc(d)} title={d.title || d.file_name}>
                            {d.title || d.file_name}
                          </button>
                        </div>
                        {d.description && <div className="text-xs text-gray-500 break-words w-full">{d.description}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-center">{d.meeting_date || '-'}</td>
                      <td className="px-6 py-4 align-middle text-left">
                        <a href={d.file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all block w-full" title={d.file_name}>{d.file_name}</a>
                      </td>
                      <td className="px-6 py-4 align-middle text-center">
                        <div className="inline-flex justify-center items-center gap-2 whitespace-nowrap">
                          <a href={buildDownloadUrl(d.file_url, d.file_name)} download={d.file_name} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50" title="Tải xuống">
                            <ArrowDownTrayIcon className="w-4 h-4" /> <span>Tải</span>
                          </a>
                          {(profile?.role === 'manager' || profile?.id === d.uploaded_by) && (
                            <button onClick={() => handleDeleteDoc(d)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700" title="Xóa">
                              <TrashIcon className="w-4 h-4" /> <span>Xóa</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-gray-200 border border-gray-200 [&>thead>tr>th]:text-center [&>thead>tr>th]:align-middle [&>tbody>tr>td]:align-middle [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-center w-[44px]">
                    <input type="checkbox" checked={isAllVisibleSelected()} onChange={toggleSelectAllVisible} />
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[22%]">Dự án</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[26%]">Công việc</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[28%]">Tệp</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">Ngày tạo</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {!reportsActivated ? (
                  <tr><td colSpan="6" className="px-6 py-6 text-center text-gray-500">Nhập từ khóa hoặc chọn bộ lọc để tìm báo cáo</td></tr>
                ) : reportsLoading ? (
                  <tr><td colSpan="6" className="px-6 py-6 text-center text-gray-500">Đang tải...</td></tr>
                ) : (reports || []).length === 0 ? (
                  <tr><td colSpan="6" className="px-6 py-6 text-center text-gray-500">Chưa có báo cáo</td></tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-4 text-center align-middle">
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelectOne(r.id)} />
                      </td>
                      <td className="px-6 py-4 align-middle text-left">
                        <div className="text-sm font-medium text-gray-900 break-words w-full" title={r.task?.project?.code ? `${r.task?.project?.code} · ${r.task?.project?.name}` : (r.task?.project?.name || '-')}>{r.task?.project?.code ? `${r.task.project.code} · ${r.task.project.name}` : (r.task?.project?.name || '-')}</div>
                      </td>
                      <td className="px-6 py-4 align-middle text-left">
                        <div className="break-words w-full">
                          <button type="button" className="font-medium text-primary-700 hover:underline break-words" onClick={() => setPreviewDoc(r)} title={r.task?.title || '-'}>
                            {r.task?.title || '-'}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle text-left">
                        <a href={r.file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all block w-full" title={r.file_name}>{r.file_name}</a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-center">{r.created_at?.slice(0,10) || '-'}</td>
                      <td className="px-6 py-4 align-middle text-center">
                        <div className="inline-flex justify-center items-center gap-2 whitespace-nowrap">
                          <a href={buildDownloadUrl(r.file_url, r.file_name)} download={r.file_name} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50" title="Tải xuống">
                            <ArrowDownTrayIcon className="w-4 h-4" /> <span>Tải</span>
                          </a>
                          {(profile?.role === 'manager' || profile?.id === r.uploaded_by) && (
                            <button onClick={() => {
                              if (!window.confirm('Xóa báo cáo này?')) return
                              tasksApi.deleteTaskReport(r).then(() => { toast.success('Đã xóa'); loadReports({}) }).catch(err => { console.error(err); toast.error('Không thể xóa') })
                            }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700" title="Xóa">
                              <TrashIcon className="w-4 h-4" /> <span>Xóa</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Preview Modal */}
        {previewDoc && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border w-full max-w-5xl shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold text-gray-900">
                  Xem trước: {previewDoc.title || previewDoc.task?.title || previewDoc.file_name}
                </h3>
                <button onClick={() => setPreviewDoc(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
              </div>
              <div className="h-[70vh] border rounded-md overflow-hidden">
                <iframe
                  title="Preview"
                  src={previewDoc.file_url}
                  className="w-full h-full"
                />
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <a href={previewDoc.file_url} target="_blank" rel="noreferrer" className="btn-secondary">Mở tab</a>
                <button className="btn-primary" onClick={() => setPreviewDoc(null)}>Đóng</button>
              </div>
            </div>
          </div>
        )}
        {/* Details Modal for stat cards */}
        {detailsOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-gray-700/50 backdrop-blur-[2px]" />
            <div className="absolute inset-0 p-1 sm:p-2 lg:p-3">
              <div className="w-full h-full bg-white rounded-2xl shadow-2xl ring-1 ring-black/10 flex flex-col overflow-hidden">
              {/* Header with icon tabs */}
              <div className="flex items-center justify-between px-4 py-3 border-b bg-white sticky top-0">
                <div className="flex items-center gap-2">
                  <button onClick={async () => { const i = await computeItemsByKind('projects'); setDetailsKind('projects'); setDetailsItems(i); setDetailsTitle(titleByKind('projects')) }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border ${detailsKind==='projects' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-600 hover:bg-gray-50 border-transparent'}`}
                          title="Dự án đang theo dõi">
                    <ChartBarIcon className="w-4 h-4" />
                    <span>Dự án</span>
                  </button>
                  <button onClick={async () => { const i = await computeItemsByKind('all'); setDetailsKind('all'); setDetailsItems(i); setDetailsTitle(titleByKind('all')) }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border ${detailsKind==='all' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-gray-600 hover:bg-gray-50 border-transparent'}`}
                          title="Tổng công việc">
                    <ClockIcon className="w-4 h-4" />
                    <span>Tổng CV</span>
                  </button>
                  <button onClick={async () => { const i = await computeItemsByKind('completed'); setDetailsKind('completed'); setDetailsItems(i); setDetailsTitle(titleByKind('completed')) }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border ${detailsKind==='completed' ? 'bg-green-50 text-green-700 border-green-200' : 'text-gray-600 hover:bg-gray-50 border-transparent'}`}
                          title="Hoàn thành">
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>Hoàn thành</span>
                  </button>
                  <button onClick={async () => { const i = await computeItemsByKind('upcoming'); setDetailsKind('upcoming'); setDetailsItems(i); setDetailsTitle(titleByKind('upcoming')) }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border ${detailsKind==='upcoming' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'text-gray-600 hover:bg-gray-50 border-transparent'}`}
                          title="Sắp đến hạn">
                    <CalendarIcon className="w-4 h-4" />
                    <span>Sắp đến hạn</span>
                  </button>
                  <button onClick={async () => { const i = await computeItemsByKind('overdue'); setDetailsKind('overdue'); setDetailsItems(i); setDetailsTitle(titleByKind('overdue')) }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border ${detailsKind==='overdue' ? 'bg-red-50 text-red-700 border-red-200' : 'text-gray-600 hover:bg-gray-50 border-transparent'}`}
                          title="Quá hạn">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    <span>Quá hạn</span>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-900">{detailsTitle}</h3>
                  <button onClick={() => setDetailsOpen(false)} className="text-gray-500 hover:text-gray-700 text-xl">&times;</button>
                </div>
              </div>
              {/* Body */}
              <div className="flex-1 overflow-auto p-4">
                {detailsKind === 'projects' ? (
                  <table className="min-w-full divide-y divide-gray-200 border border-gray-200 [&>thead>tr>th]:text-center [&>thead>tr>th]:align-middle [&>tbody>tr>td]:align-middle [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Mã dự án</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Tên dự án</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Địa điểm</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Ngày bắt đầu</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Ngày hoàn thành</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Số ngày TH</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Số lần GH</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {(!detailsItems || detailsItems.length === 0) ? (
                        <tr><td colSpan="8" className="px-4 py-6 text-center text-gray-500">Không có dữ liệu</td></tr>
                      ) : (
                        detailsItems.map(p => (
                          <tr key={p.id}>
                            <td className="px-4 py-2 text-left">{p.code}</td>
                            <td className="px-4 py-2 text-left">
                              <div className="text-sm font-medium text-gray-900">{p.name}</div>
                              {p.description && <div className="text-xs text-gray-500 line-clamp-1">{p.description}</div>}
                            </td>
                            <td className="px-4 py-2 text-left">{p.location || '-'}</td>
                            <td className="px-4 py-2 text-center">{formatDate(p.start_date)}</td>
                            <td className="px-4 py-2 text-center">{formatDate(p.end_date)}</td>
                            <td className="px-4 py-2 text-center">{p.total_days ? `${p.total_days} ngày` : '-'}</td>
                            <td className="px-4 py-2 text-center">{p.extension_count || 0}</td>
                            <td className="px-4 py-2 text-center">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getProjectStatusColor(p.status)}`}>
                                {getProjectStatusText(p.status)}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="min-w-full table-fixed divide-y divide-gray-200 border border-gray-200 [&>thead>tr>th]:text-center [&>thead>tr>th]:align-middle [&>tbody>tr>td]:align-middle [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider w-[36%]">Công việc</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider w-[22%]">Dự án</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider w-[14%]">Đến hạn</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider w-[14%]">Trạng thái</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider w-[14%]">Phụ trách</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {(!detailsItems || detailsItems.length === 0) ? (
                        <tr><td colSpan="5" className="px-4 py-6 text-center text-gray-500">Không có dữ liệu</td></tr>
                      ) : (
                        detailsItems.map(t => (
                          <tr key={t.id}>
                            <td className="px-4 py-2 align-top text-left">
                              <div className="text-sm font-medium text-gray-900 break-words whitespace-pre-wrap">{t.title}</div>
                              {t.description && <div className="text-xs text-gray-500 break-words whitespace-pre-wrap mt-0.5">{t.description}</div>}
                            </td>
                            <td className="px-4 py-2 align-middle text-left">
                              <div className="text-sm text-gray-900 break-words">{t.project?.code ? `${t.project.code} · ${t.project.name}` : (t.project?.name || '-')}</div>
                            </td>
                            <td className="px-4 py-2 text-center align-middle">{t.due_date ? formatDate(t.due_date) : '-'}</td>
                            <td className="px-4 py-2 text-center align-middle"><TaskStatusPill task={t} size="compact" /></td>
                            <td className="px-4 py-2 align-middle text-left">
                              <div className="text-sm text-gray-900">{t.assigned_to?.full_name || 'Chưa phân công'}</div>
                              {Array.isArray(t.additional_assignees) && t.additional_assignees.length > 0 && (
                                <div className="text-xs text-gray-600">+ {t.additional_assignees.length} người phối hợp</div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Quick Actions removed per request */}
    </div>
  )
}

export default DashboardPage
