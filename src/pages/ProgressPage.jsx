import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

const { projectsApi, progressApi, projectDocsApi } = api

import { formatDate } from '../utils/helpers'
import LoadingSpinner from '../components/LoadingSpinner'
import TaskStatusPill from '../components/TaskStatusPill'
import { ExcelService } from '../utils/excelService'
import PortalDropdown from '../components/PortalDropdown'
import PdfLayerViewer from '../components/PdfLayerViewer'
import { supabase } from '../lib/supabase'
import SiteDocsFromPdfWizard from '../components/documents/SiteDocsFromPdfWizard'
import TooltipIcon from '../components/TooltipIcon'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
  EyeIcon,
  FunnelIcon,
  ArrowPathIcon,
  EllipsisVerticalIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FireIcon,
  PaperClipIcon,
  MapPinIcon,
  TagIcon,
  CloudArrowUpIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { buildProgressSummary } from '../utils/progressSummary'

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
  } catch {
    return null
  }
}

const autoStatusByDueDate = (dueDate) => {
  const dr = getDaysRemainingSimple(dueDate)
  if (dr === null) return 'in_progress'
  if (dr < 0) return 'overdue'
  if (dr <= 2) return 'nearly_due'
  return 'in_progress'
}

const SELECTED_PROJECT_KEY = 'progress_selected_project_id'
const MANPOWER_OVERRIDES_KEY = 'progress_manpower_overrides'

// Generic helpers to parse/inject [KV: ...] tags in titles (used for tasks when DB has no area column)
const parseAreaTagFromTitle = (title) => {
  if (!title) return ''
  const m = String(title).match(/\[(?:KV|Khu\s*vuc|Khu\s*vực)\s*:\s*([^\]]+)\]/i)
  return m ? m[1].trim() : ''
}
const injectAreaTagToTitle = (title, area) => {
  const base = String(title || '').replace(/\s*\[(?:KV|Khu\s*vuc|Khu\s*vực)\s*:\s*[^\]]+\]\s*/i, '').trim()
  return area ? `[KV: ${area}] ${base}` : base
}
// Remove any [KV: ...] tag to get the plain task title for display
const stripAreaTagFromTitle = (title) => {
  return String(title || '').replace(/\s*\[(?:KV|Khu\s*vuc|Khu\s*vực)\s*:\s*[^\]]+\]\s*/i, '').trim()
}
const getTaskArea = (t) => (t?.area || t?.khu_vuc || t?.zone || parseAreaTagFromTitle(t?.title) || '')

// Compute base manpower flexibly: prefer numeric manpower on progress items,
// otherwise fall back to counting task assignees when using tasksApi models
const getBaseManpower = (t) => {
  const mp = Number(t?.manpower)
  if (!isNaN(mp) && mp >= 0) return mp
  const count = (t?.additional_assignees?.length || 0) + (t?.assigned_to ? 1 : 0)
  return count
}

const ProgressPage = () => {
  const { profile } = useAuth()
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    try { return localStorage.getItem(SELECTED_PROJECT_KEY) || '' } catch { return '' }
  })
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  // Parse status from URL (e.g., /progress?status=overdue) for deep-linking from dashboard
  useEffect(() => {
    try {
      const hash = typeof window !== 'undefined' ? window.location.hash || '' : ''
      const q = hash.includes('?') ? hash.substring(hash.indexOf('?') + 1) : (typeof window !== 'undefined' ? window.location.search?.slice(1) : '')
      if (q) {
        const params = new URLSearchParams(q)
        const s = params.get('status')
        if (s && ['all','in_progress','nearly_due','overdue','completed'].includes(s)) {
          setStatusFilter(s)
          // scroll later to table when UI rendered
          setTimeout(() => { try { tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch {} }, 150)
        }
      }
    } catch {}
  }, [])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [taskForm, setTaskForm] = useState({ title: '', area: '', start_date: '', due_date: '', progress_percent: 0, manpower: '' })

  // Local overrides for current manpower per task (persisted in localStorage)
  const [manpowerOverrides, setManpowerOverrides] = useState(() => {
    try {
      const raw = localStorage.getItem(MANPOWER_OVERRIDES_KEY)
      const obj = raw ? JSON.parse(raw) : {}
      return (obj && typeof obj === 'object') ? obj : {}
    } catch {
      return {}
    }
  })

  const saveManpowerOverride = (taskId, value) => {
    try {
      setManpowerOverrides(prev => {
        const v = Number(value)
        const next = { ...prev }
        if (!isNaN(v) && v >= 0) next[taskId] = v
        else delete next[taskId]
        try { localStorage.setItem(MANPOWER_OVERRIDES_KEY, JSON.stringify(next)) } catch {}
        return next
      })
    } catch {}
  }

  // Excel preview states
  const PREVIEW_LIMIT = 200
  // Export preview
  const [showExportPreview, setShowExportPreview] = useState(false)
  const [exportType, setExportType] = useState('excel') // 'excel' | 'pdf'
  const [exportRows, setExportRows] = useState([])
  const [exportColumns, setExportColumns] = useState([])
  const [exportSelectedCols, setExportSelectedCols] = useState(new Set())
  const [exportSelectedRows, setExportSelectedRows] = useState(new Set())
  // Import preview
  const [showImportPreview, setShowImportPreview] = useState(false)
  const [importRows, setImportRows] = useState([])
  const [importHeaders, setImportHeaders] = useState([])
  const [importSelectedCols, setImportSelectedCols] = useState(new Set())
  const [importSelectedRows, setImportSelectedRows] = useState(new Set())
  const [pendingImportFileName, setPendingImportFileName] = useState('')

  // Site plans (PDF)
  const [siteDocs, setSiteDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docSearch, setDocSearch] = useState('')
  const [docAreaFilter, setDocAreaFilter] = useState('all')
  const [docFile, setDocFile] = useState(null)
  const [docArea, setDocArea] = useState('')
  const [showLayerViewer, setShowLayerViewer] = useState(false)
  const [layerDocs, setLayerDocs] = useState([])
  const [docTitle, setDocTitle] = useState('')
  const [editingDoc, setEditingDoc] = useState(null)
  const [openActionMenuId, setOpenActionMenuId] = useState(null)
  const actionBtnRefs = React.useRef({})
  // Dropdown cho bảng bản vẽ (PDF theo khu vực)
  const [openDocMenuId, setOpenDocMenuId] = useState(null)
  const docBtnRefs = React.useRef({})
  // Tổng kết xung đột từ PdfLayerViewer
  const [conflictCount, setConflictCount] = useState(0)
  // Bản vẽ phối hợp đã lưu từ Viewer (lưu vào project_drawings)
  const [composedRows, setComposedRows] = useState([])
  const [composedLoading, setComposedLoading] = useState(false)
  const [openComposedMenuId, setOpenComposedMenuId] = useState(null)
  const composedBtnRefs = React.useRef({})

  // Action menu for summary details table
  const [openSummaryActionId, setOpenSummaryActionId] = useState(null)
  const summaryActionRefs = React.useRef({})

  // Close action dropdown on outside click or Escape
  useEffect(() => {
  const handleDocClick = () => { setOpenActionMenuId(null); setOpenDocMenuId(null) }
  const handleKey = (e) => { if (e.key === 'Escape') { setOpenActionMenuId(null); setOpenDocMenuId(null) } }
    document.addEventListener('mousedown', handleDocClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDocClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  // Close summary detail action dropdowns on outside click / Escape
  useEffect(() => {
    const handleClick = () => setOpenSummaryActionId(null)
    const handleKey = (e) => { if (e.key === 'Escape') setOpenSummaryActionId(null) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  // Close composed dropdowns on outside click / Escape
  useEffect(() => {
    const handleClick = () => setOpenComposedMenuId(null)
    const handleKey = (e) => { if (e.key === 'Escape') setOpenComposedMenuId(null) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const data = await projectsApi.getAll()
        setProjects(data || [])

        // Preserve current or saved selection on reload if still accessible
        const saved = (() => { try { return localStorage.getItem(SELECTED_PROJECT_KEY) } catch { return null } })()
        const desired = selectedProjectId || saved || ''
        if (desired && (data || []).some(p => p.id === desired)) {
          setSelectedProjectId(desired)
        } else if (!desired && data && data.length) {
          // No saved selection -> default to first project once
          setSelectedProjectId(data[0].id)
          try { localStorage.setItem(SELECTED_PROJECT_KEY, data[0].id) } catch {}
        } else if (desired && !(data || []).some(p => p.id === desired)) {
          // Saved selection no longer accessible -> fallback
          const fallback = data && data.length ? data[0].id : ''
          setSelectedProjectId(fallback)
          try { localStorage.setItem(SELECTED_PROJECT_KEY, fallback) } catch {}
        }
      } catch (e) {
        console.error(e)
        toast.error('Không thể tải danh sách dự án')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const changeProject = (id) => {
    setSelectedProjectId(id)
    try { localStorage.setItem(SELECTED_PROJECT_KEY, id || '') } catch {}
  }

  useEffect(() => {
    if (!selectedProjectId) return
    loadTasks(selectedProjectId)
    loadSiteDocs(selectedProjectId)
    loadComposedDrawings(selectedProjectId)
  }, [selectedProjectId])

  // Reload composed drawings when area filter changes
  useEffect(() => {
    if (!selectedProjectId) return
    loadComposedDrawings(selectedProjectId)
  }, [docAreaFilter])

  const loadTasks = async (projectId) => {
    try {
      setTasksLoading(true)
      const data = await progressApi.getByProject(projectId)
      const sorted = (data || []).slice().sort((a,b) => {
        const ai = a.order_index
        const bi = b.order_index
        if (ai != null && bi != null) return ai - bi
        if (ai != null) return -1
        if (bi != null) return 1
        const ad = new Date(a.created_at || a.start_date || 0).getTime()
        const bd = new Date(b.created_at || b.start_date || 0).getTime()
        return ad - bd
      })
      setTasks(sorted)
    } catch (e) {
      if (e?.code === 'PROGRESS_TABLE_MISSING') {
        console.error('Bảng progress_items chưa tồn tại. Vui lòng chạy create-progress-items.sql trong Supabase.')
        toast.error('Chưa khởi tạo bảng tiến độ độc lập. Vui lòng chạy create-progress-items.sql')
        setTasks([])
      } else {
        console.error(e)
        toast.error('Không thể tải bảng tiến độ')
      }
    } finally {
      setTasksLoading(false)
    }
  }

  const loadSiteDocs = async (projectId) => {
    try {
      setDocsLoading(true)
      const data = await projectDocsApi.list(projectId, { search: docSearch, sort: 'created_desc', category: 'site_plan' })
      setSiteDocs(data || [])
    } catch (e) {
      console.error(e)
      toast.error('Không thể tải mặt bằng thi công')
    } finally {
      setDocsLoading(false)
    }
  }

  // Load multi-discipline docs for overlay viewer
  const loadLayerDocs = async (projectId) => {
    try {
      const cats = ['arch', 'electrical', 'water', 'pccc', 'hvac', 'site_plan']
      const all = []
      for (const c of cats) {
        const data = await projectDocsApi.list(projectId, { category: c, sort: 'created_desc' })
        for (const d of (data || [])) all.push(d)
      }
      setLayerDocs(all)
    } catch (e) {
      console.error(e)
      toast.error('Không thể tải bản vẽ nhiều hệ')
    }
  }

  // Load bản vẽ phối hợp đã lưu (từ project_drawings)
  const loadComposedDrawings = async (projectId) => {
    try {
      setComposedLoading(true)
      const { data, error } = await supabase.rpc('list_project_drawings_overview', {
        p_project_id: projectId,
        p_q: null,
        p_area: docAreaFilter !== 'all' ? docAreaFilter : null,
        p_category: 'Phối hợp'
      })
      if (error) throw error
      setComposedRows(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally { setComposedLoading(false) }
  }

  const getStoragePathFromPublicUrl = (url) => {
    try {
      const u = new URL(url)
      const path = u.pathname
      const marker = '/object/public/project-drawings/'
      const i = path.indexOf(marker)
      if (i >= 0) return decodeURIComponent(path.slice(i + marker.length))
      const alt = '/project-drawings/'
      const j = path.indexOf(alt)
      if (j >= 0) return decodeURIComponent(path.slice(j + alt.length))
      return null
    } catch { return null }
  }

  const updateComposedMeta = async (row, { title, area, nameOverride }) => {
    try {
      const newTitle = (title ?? row.title ?? row.name ?? '').toString().trim()
      const newArea = (area ?? row.area ?? '').toString().trim() || null
      if (!newTitle) return toast.error('Vui lòng nhập tiêu đề')
      const newName = (nameOverride || `${newArea || row.area || ''} Bản vẽ phối hợp`).trim()
      const { error } = await supabase.from('project_drawings')
        .update({ title: newTitle, name: newName, area: newArea })
        .eq('id', row.id)
      if (error) throw error
      toast.success('Đã cập nhật bản vẽ phối hợp')
      if (selectedProjectId) await loadComposedDrawings(selectedProjectId)
    } catch (e) { console.error(e); toast.error('Không thể cập nhật') }
  }

  const updateComposedStandard = async (row, title, name) => {
    try {
      const { error } = await supabase.from('project_drawings')
        .update({ title: (title||'Bản vẽ phối hợp').trim(), name: (name||`${row.area||''} Bản vẽ phối hợp`).trim() })
        .eq('id', row.id)
      if (error) throw error
      toast.success('Đã đặt lại tên chuẩn')
      if (selectedProjectId) await loadComposedDrawings(selectedProjectId)
    } catch (e) { console.error(e); toast.error('Không thể cập nhật tên') }
  }

  const deleteComposed = async (row) => {
    if (!window.confirm('Xóa bản vẽ phối hợp này?')) return
    try {
      const path = getStoragePathFromPublicUrl(row.file_url)
      if (path) { try { await supabase.storage.from('project-drawings').remove([path]) } catch {} }
      const { error } = await supabase.from('project_drawings').delete().eq('id', row.id)
      if (error) throw error
      toast.success('Đã xóa')
      if (selectedProjectId) await loadComposedDrawings(selectedProjectId)
    } catch (e) { console.error(e); toast.error('Không thể xóa') }
  }

  const filteredTasks = useMemo(() => {
    let list = tasks
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(t => (t.title || '').toLowerCase().includes(s))
    }
    if (statusFilter !== 'all') {
      list = list.filter(t => {
        const isCompleted = t.is_completed === true || t.status === 'completed' || (t.progress_percent != null && Number(t.progress_percent) >= 100)
        const dr = getDaysRemainingSimple(t.due_date)
        if (statusFilter === 'completed') return isCompleted
        if (statusFilter === 'overdue') return !isCompleted && dr !== null && dr < 0
        if (statusFilter === 'nearly_due') return !isCompleted && dr !== null && dr >= 0 && dr <= 2
        if (statusFilter === 'in_progress') return !isCompleted && dr !== null && dr > 2
        return true
      })
    }
    // Always ensure final display preserves order_index order
    return list.slice().sort((a,b) => {
      const ai = a.order_index
      const bi = b.order_index
      if (ai != null && bi != null) return ai - bi
      if (ai != null) return -1
      if (bi != null) return 1
      const ad = new Date(a.created_at || a.start_date || 0).getTime()
      const bd = new Date(b.created_at || b.start_date || 0).getTime()
      return ad - bd
    })
  }, [tasks, search, statusFilter])

  // Detect which area-like column exists in tasks table to update the correct field
  const areaKey = useMemo(() => {
    const candidates = ['area', 'khu_vuc', 'zone']
    for (const t of tasks) {
      for (const k of candidates) {
        if (Object.prototype.hasOwnProperty.call(t || {}, k)) return k
      }
    }
    return null
  }, [tasks])

  const openNewTask = () => {
    setEditingTask(null)
    setTaskForm({ title: '', area: '', start_date: '', due_date: '', progress_percent: 0, manpower: '' })
    setShowTaskModal(true)
  }

  const openEditTask = (task) => {
    setEditingTask(task)
  const baseManpower = getBaseManpower(task)
    const override = manpowerOverrides?.[task.id]
    setTaskForm({
      title: task.title || '',
      area: getTaskArea(task),
      start_date: task.start_date || '',
      due_date: task.due_date || '',
      progress_percent: task.progress_percent || 0,
      manpower: (override != null ? override : baseManpower).toString()
    })
    setShowTaskModal(true)
  }

  const saveTask = async (e) => {
    e?.preventDefault?.()
    if (!selectedProjectId) return toast.error('Chưa chọn dự án')
    if (!taskForm.title.trim()) return toast.error('Vui lòng nhập nội dung công việc')
    try {
      const payload = {
        project_id: selectedProjectId,
        title: taskForm.title.trim(),
        progress_percent: Number(taskForm.progress_percent) || 0,
      }
      // ensure no stray area-like keys leak when schema lacks them
      if (!areaKey) {
        delete payload.area; delete payload.khu_vuc; delete payload.zone
      }
      // set area-like field dynamically based on existing schema
      if (taskForm.area && String(taskForm.area).trim()) {
        if (areaKey) {
          payload[areaKey] = String(taskForm.area).trim()
        } else {
          // No area column in DB -> inject into title with [KV: ...]
          payload.title = injectAreaTagToTitle(payload.title, String(taskForm.area).trim())
        }
      } else {
        if (areaKey) {
          // Allow clearing when column exists
          payload[areaKey] = null
        } else {
          // Remove any existing area tag when clearing
          payload.title = injectAreaTagToTitle(payload.title, '')
        }
      }
      // default dates to satisfy NOT NULL
      const today = new Date().toISOString().split('T')[0]
      payload.start_date = taskForm.start_date || today
      payload.due_date = taskForm.due_date || payload.start_date

      if (editingTask) {
        // Persist manpower as part of progress item
        const mp = Number(taskForm.manpower)
        if (!isNaN(mp)) payload.manpower = mp
        const updated = await progressApi.update(editingTask.id, payload)
        setTasks(prev => prev.map(t => (t.id === editingTask.id ? { ...t, ...updated } : t)))
        // Persist manpower override if provided
        if (taskForm.manpower !== '' && !isNaN(Number(taskForm.manpower))) {
          saveManpowerOverride(editingTask.id, Number(taskForm.manpower))
        } else {
          saveManpowerOverride(editingTask.id, NaN)
        }
        toast.success('Đã cập nhật công việc')
      } else {
        const mp = Number(taskForm.manpower)
        if (!isNaN(mp)) payload.manpower = mp
        const created = await progressApi.create(payload)
        setTasks(prev => [created, ...prev])
        if (taskForm.manpower !== '' && !isNaN(Number(taskForm.manpower))) {
          saveManpowerOverride(created.id, Number(taskForm.manpower))
        }
        toast.success('Đã thêm công việc')
      }
      setShowTaskModal(false)
      setEditingTask(null)
    } catch (e) {
      console.error(e)
      toast.error('Lưu công việc thất bại')
    }
  }

  const deleteTask = async (task) => {
    if (!window.confirm('Xóa công việc này?')) return
    try {
  await progressApi.delete(task.id)
      setTasks(prev => prev.filter(t => t.id !== task.id))
      toast.success('Đã xóa công việc')
    } catch (e) {
      console.error(e)
      toast.error('Không thể xóa')
    }
  }

  // Ensure Inter/Roboto fonts are available for html2canvas rendering
  const loadInterRobotoFonts = async () => {
    try {
      if (document.getElementById('ibst-fonts')) return
      const pre = document.createElement('link')
      pre.rel = 'preconnect'
      pre.href = 'https://fonts.gstatic.com'
      pre.crossOrigin = 'anonymous'
      pre.id = 'ibst-fonts-pre'
      document.head.appendChild(pre)
      const link = document.createElement('link')
      link.id = 'ibst-fonts'
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Roboto:wght@400;500;700&display=swap'
      document.head.appendChild(link)
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready
      } else {
        await new Promise(r => setTimeout(r, 400))
      }
    } catch {}
  }

  const exportTasksToPdfVisual = async (rowsWithTasks, selectedCols) => {
    await loadJsPdfLibs()
    await loadInterRobotoFonts()
    const { jsPDF } = window.jspdf
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const margin = 32
    const pageWidth = doc.internal.pageSize.getWidth()
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-99999px'
    container.style.top = '0'
    container.style.width = `${pageWidth - margin*2}px`
    container.className = 'export-pdf-container font-serif'

    const projName = selectedProject ? (selectedProject.code ? `${selectedProject.code} - ${selectedProject.name}` : selectedProject.name) : ''
    const today = new Date()
    const dateStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`

    container.innerHTML = `
      <div style="padding:${margin}px ${margin}px ${margin/2}px ${margin}px; font-family: 'Inter', 'Roboto', 'Segoe UI', Arial, sans-serif;">
        <div style="font-weight:700; font-size:18px; color:#0B5394;">BẢNG TIẾN ĐỘ</div>
        <div style="font-size:12px; color:#374151; margin-top:4px;">${projName}</div>
        <div style="font-size:11px; color:#6B7280;">Ngày xuất: ${dateStr}</div>
      </div>
      <div style="padding:0 ${margin}px ${margin}px ${margin}px; font-family: 'Inter', 'Roboto', 'Segoe UI', Arial, sans-serif;">
        <div style="border:1px solid #E5E7EB; border-radius:12px; overflow:hidden; background:#FFFFFF;">
          <table style="width:100%; border-collapse:separate; border-spacing:0;">
            <thead style="background:#FFFFFF;">
              <tr>
                ${selectedCols.map(h=>`<th style="border-bottom:1px solid #E5E7EB; padding:10px 8px; font-size:11px; text-transform:uppercase; color:#0B5394; text-align:center;">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rowsWithTasks.map((row,idx)=>{
              const t = row.__task
              const timePct = computeTimeProgress(t.start_date, t.due_date)
              const actualPct = Number(t.progress_percent || 0)
              const dr = getDaysRemainingSimple(t.due_date)
              const isCompleted = t.is_completed === true || t.status === 'completed' || (t.progress_percent != null && Number(t.progress_percent) >= 100)
              const status = isCompleted ? 'completed' : (dr===null ? 'in_progress' : (dr<0 ? 'overdue' : (dr<=2 ? 'nearly_due' : 'in_progress')))
              const statusLabel = status === 'completed' ? 'HOÀN THÀNH' : status === 'overdue' ? 'TRỄ HẠN' : status === 'nearly_due' ? 'SẮP ĐẾN HẠN' : 'ĐANG THỰC HIỆN'
              const daysBadge = (status==='overdue' && typeof dr==='number') ? `TRỄ ${Math.abs(dr)}` : (status==='nearly_due' ? (typeof dr==='number' ? `${dr}` : '') : '')
                const pillColor = status==='overdue' ? '#FEE2E2' : status==='nearly_due' ? '#DBEAFE' : status==='completed' ? '#DCFCE7' : '#EFF6FF'
                const pillText = status==='overdue' ? '#DC2626' : status==='nearly_due' ? '#1D4ED8' : status==='completed' ? '#065F46' : '#1E3A8A'
              const manpower = getBaseManpower(t)
              const need = timePct > actualPct ? Math.round((timePct / Math.max(actualPct, 1)) * 1.3 * Math.max(manpower, 0)) : 0

              const cellFor = (key) => {
                switch(key){
                  case 'STT': return String(row['STT'])
                  case 'Khu vực': return String(getTaskArea(t) || '')
                  case 'Nội dung công việc': return String(t.title || '')
                  case 'Ngày bắt đầu': return String(t.start_date || '')
                  case 'Hạn hoàn thành': return String(t.due_date || '')
                  case 'Trạng thái': return `
                      <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-start;">
                        <span style="display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:10px; background:${pillColor}; color:${pillText}; font-weight:700; font-size:11px;">
                          <span style="font-size:18px; line-height:1;">•</span> ${statusLabel}
                          ${daysBadge ? `<span style='margin-left:6px; font-weight:700;'>${daysBadge}</span>` : ''}
                        </span>
                        <div style="position:relative; height:8px; background:#E5E7EB; border-radius:999px; width:200px; overflow:hidden;">
                          <div style="position:absolute; left:0; top:0; bottom:0; width:${Math.max(0, Math.min(100, timePct))}%; background:#93C5FD;"></div>
                          <div style="position:absolute; left:0; top:0; bottom:0; width:${Math.max(0, Math.min(100, actualPct))}%; background:#2563EB;"></div>
                        </div>
                      </div>`
                  case '% theo thời gian': return `${timePct}%`
                  case '% thực tế': return `${t.progress_percent || 0}%`
                  case 'Nhân công': return String(manpower)
                    case 'Yêu cầu tăng cường': return String(need)
                  default: return String(row[key] ?? '')
                }
              }

                return `<tr>
                  ${selectedCols.map(c => `<td style=\"border-bottom:1px solid #E5E7EB; padding:10px 8px; font-size:12px; vertical-align:top;\">${cellFor(c)}</td>`).join('')}
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    document.body.appendChild(container)
    await new Promise((resolve) => {
      doc.html(container, {
        x: 0, y: 0, width: pageWidth,
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#FFFFFF' },
        callback: () => { resolve() }
      })
    })
    doc.save('bao-cao-tien-do.pdf')
    document.body.removeChild(container)
  }

    // Site plans helpers
    const parseAreaFromTitle = (title) => {
      if (!title) return ''
      const m = String(title).match(/\[(?:KV|Khu\s*vuc|Khu\s*vực)\s*:\s*([^\]]+)\]/i)
      return m ? m[1].trim() : ''
    }
    const buildTitleWithArea = (title, area) => {
      const base = String(title || '').replace(/\s*\[(?:KV|Khu\s*vuc|Khu\s*vực)\s*:\s*[^\]]+\]\s*/i, '').trim()
      return area ? `[KV: ${area}] ${base}` : base
    }

    const areas = useMemo(() => {
      const set = new Set()
      for (const d of siteDocs) {
        const a = parseAreaFromTitle(d.title)
        if (a) set.add(a)
      }
      return Array.from(set)
    }, [siteDocs])

    // Khu vực lấy từ cột "Khu vực" của bảng công việc (ưu tiên dùng cho dropdown tải PDF)
    const taskAreas = useMemo(() => {
      const set = new Set()
      for (const t of tasks) {
        const a = getTaskArea(t)
        if (a) set.add(a)
      }
      return Array.from(set).sort((a,b)=>a.localeCompare(b))
    }, [tasks])

    const filteredDocs = useMemo(() => {
      let list = siteDocs
      if (docSearch.trim()) {
        const s = docSearch.toLowerCase()
        list = list.filter(d => (d.title || '').toLowerCase().includes(s) || (d.file_name || '').toLowerCase().includes(s))
      }
      if (docAreaFilter !== 'all') {
        list = list.filter(d => parseAreaFromTitle(d.title) === docAreaFilter)
      }
      return list
    }, [siteDocs, docSearch, docAreaFilter])

    const uploadSiteDoc = async (e) => {
      e?.preventDefault?.()
      if (!selectedProjectId) return toast.error('Chưa chọn dự án')
      if (!docFile) return toast.error('Vui lòng chọn file PDF')
      try {
        const title = buildTitleWithArea(docTitle || docFile.name, docArea)
        const res = await projectDocsApi.upload(selectedProjectId, docFile, { title, category: 'site_plan' })
        setSiteDocs(prev => [res, ...prev])
        setDocFile(null); setDocTitle(''); setDocArea('')
        toast.success('Đã tải lên mặt bằng')
      } catch (e) {
        console.error(e)
        toast.error('Tải lên thất bại')
      }
    }

    const updateDocMeta = async (doc, { title, area }) => {
      try {
        const newTitle = buildTitleWithArea(title ?? doc.title, area ?? parseAreaFromTitle(doc.title))
        const updated = await projectDocsApi.update(doc.id, { title: newTitle })
        setSiteDocs(prev => prev.map(d => (d.id === doc.id ? { ...d, ...updated } : d)))
        toast.success('Đã cập nhật tài liệu')
      } catch (e) {
        console.error(e)
        toast.error('Không thể cập nhật')
      }
    }

  const deleteDoc = async (doc) => {
    if (!window.confirm('Xóa mặt bằng này?')) return
    try {
      await projectDocsApi.delete(doc)
      if (selectedProjectId) await loadSiteDocs(selectedProjectId)
      toast.success('Đã xóa')
    } catch (e) {
      console.error(e)
      const msg = e?.message || e?.error_description || 'Không thể xóa'
      toast.error(msg)
    }
  }

  const exportSiteDocs = async () => {
    try {
      const rows = filteredDocs.map((d, idx) => ({
        'STT': idx + 1,
        'Khu vực': parseAreaFromTitle(d.title),
        'Tiêu đề': d.title,
        'Tên file': d.file_name,
        'URL': d.file_url
      }))
      ExcelService.exportToExcel(rows, 'mat-bang-thi-cong', { sheetName: 'Site plans' })
    } catch (e) {
      console.error(e)
      toast.error('Không thể xuất Excel')
    }
  }

  const selectedProject = useMemo(() => (projects || []).find(p => p.id === selectedProjectId) || null, [projects, selectedProjectId])

  const statusLabelForExport = (t) => {
    const isCompleted = t.is_completed === true || t.status === 'completed' || (t.progress_percent != null && Number(t.progress_percent) >= 100)
    if (isCompleted) return 'Hoàn thành'
    const dr = getDaysRemainingSimple(t.due_date)
    if (dr === null) return 'Không xác định'
    if (dr < 0) return 'Quá hạn'
    if (dr <= 2) return 'Sắp đến hạn'
    return 'Đang thực hiện'
  }

  const buildExportRows = () => {
    return filteredTasks.map((t, idx) => {
      const timePct = computeTimeProgress(t.start_date, t.due_date)
      const baseManpower = getBaseManpower(t)
      const currentManpower = manpowerOverrides?.[t.id] != null ? manpowerOverrides[t.id] : baseManpower
      const actualPct = Number(t.progress_percent || 0)
      const needManpowerNum = timePct > actualPct
        ? Math.round((timePct / Math.max(actualPct, 1)) * 1.3 * Math.max(currentManpower, 0))
        : 0
      return {
        '__task': t,
        'STT': idx + 1,
        'Khu vực': getTaskArea(t) || '',
        'Nội dung công việc': t.title || '',
        'Ngày bắt đầu': t.start_date || '',
        'Hạn hoàn thành': t.due_date || '',
        'Trạng thái': statusLabelForExport(t),
        '% theo thời gian': timePct,
        '% thực tế': t.progress_percent || 0,
        'Nhân công': currentManpower,
        'Yêu cầu tăng cường': needManpowerNum
      }
    })
  }

  const openExportPreview = (type = 'excel') => {
    try {
      setExportType(type)
      const rows = buildExportRows()
      const colsRaw = rows.length ? Object.keys(rows[0]) : []
      const cols = colsRaw.filter(k => !k.startsWith('__'))
      setExportRows(rows)
      setExportColumns(cols)
      setExportSelectedCols(new Set(cols))
      const allIdx = new Set()
      rows.slice(0, PREVIEW_LIMIT).forEach((_, i) => allIdx.add(i))
      setExportSelectedRows(allIdx)
      setShowExportPreview(true)
    } catch (e) {
      console.error(e)
      toast.error('Không thể chuẩn bị dữ liệu xuất')
    }
  }

  const confirmExport = async () => {
    try {
      const selectedCols = Array.from(exportSelectedCols)
      const filtered = exportRows
        .filter((_, i) => exportSelectedRows.has(i))
        .map(r => Object.fromEntries(Object.entries(r).filter(([k]) => selectedCols.includes(k))))
      if (!filtered.length) return toast('Chưa chọn dữ liệu để xuất')
      if (exportType === 'pdf') {
        const selectedIdx = exportRows
          .map((_, i) => i)
          .filter(i => exportSelectedRows.has(i))
        const rowsWithTasks = selectedIdx.map(i => exportRows[i])
        await exportTasksToPdfVisual(rowsWithTasks, selectedCols)
      } else {
        ExcelService.exportToExcel(filtered, 'bang-tien-do', { sheetName: 'Tien do' })
      }
      setShowExportPreview(false)
    } catch (e) {
      console.error(e)
      toast.error(exportType === 'pdf' ? 'Xuất PDF thất bại' : 'Xuất Excel thất bại')
    }
  }

  const onImportFileChange = async (e) => {
    try {
      const file = e.target.files?.[0]
      if (!file) return
      const { data, headers } = await ExcelService.readExcelFile(file)
      setPendingImportFileName(file.name)
      setImportRows(data || [])
      setImportHeaders(headers || (data[0] ? Object.keys(data[0]) : []))
      setImportSelectedCols(new Set(headers || (data[0] ? Object.keys(data[0]) : [])))
      const rowIdx = new Set()
      ;(data || []).slice(0, PREVIEW_LIMIT).forEach((_, i) => rowIdx.add(i))
      setImportSelectedRows(rowIdx)
      setShowImportPreview(true)
    } catch (e) {
      console.error(e)
      toast.error('Không thể đọc file Excel')
    } finally {
      // allow re-selecting same file next time
      try { e.target.value = '' } catch {}
    }
  }

  const confirmImport = async () => {
    try {
      const selectedRows = importRows.filter((_, i) => importSelectedRows.has(i))
      if (!selectedRows.length) return toast('Chưa chọn dữ liệu để nhập')
      const selCols = new Set(Array.from(importSelectedCols))
      const filteredRows = selectedRows.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => selCols.has(k))))

      const created = []
      for (const row of filteredRows) {
        const title = row['Nội dung công việc'] || row['Ten cong viec'] || row['Title']
        if (!title) continue
        const startDate = row['Ngày bắt đầu'] || row['Start Date']
        const dueDate = row['Hạn hoàn thành'] || row['Due Date']
        const progress = Number(row['% thực tế'] || row['Progress'] || 0)

        const today = new Date().toISOString().split('T')[0]
        const payload = {
          project_id: selectedProjectId,
          title: String(title).trim(),
          start_date: startDate || today,
          due_date: dueDate || (startDate || today),
          status: autoStatusByDueDate(dueDate || (startDate || today)),
          progress_percent: isNaN(progress) ? 0 : progress
        }
        if (!areaKey) { delete payload.area; delete payload.khu_vuc; delete payload.zone }
        const importedArea = row['Khu vực'] || row['Khu vuc'] || row['Area'] || row['Zone']
        if (importedArea) {
          if (areaKey) payload[areaKey] = String(importedArea).trim()
          else payload.title = injectAreaTagToTitle(payload.title, String(importedArea).trim())
        }
        const importedMpRaw = row['Nhân công'] || row['Nhan cong'] || row['Manpower']
        const importedMp = Number(importedMpRaw)
        if (!isNaN(importedMp)) payload.manpower = importedMp
        const res = await progressApi.create(payload)
        created.push(res)
      }
      if (created.length) {
        setTasks(prev => [...created, ...prev])
        toast.success(`Đã nhập ${created.length} công việc`)
      } else {
        toast('Không có công việc hợp lệ sau khi lọc')
      }
      setShowImportPreview(false)
    } catch (e) {
      console.error(e)
      toast.error('Nhập Excel thất bại')
    }
  }

  // Task summary cards: counts + expandable details (shared with Dashboard)
  // NOTE: Hooks must be declared before any early returns to keep the hook order stable across renders.
  const summary = useMemo(() => buildProgressSummary(tasks), [tasks])

  // Quick-jump from summary cards to main table
  const tableRef = React.useRef(null)
  const handleSummaryClick = (type) => {
    setStatusFilter(type)
  }

  if (loading) return <LoadingSpinner message="Đang tải..." />

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium min-w-max">Chọn dự án:</label>
          <select
            className="input select"
            value={selectedProjectId}
            onChange={(e) => changeProject(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code ? `${p.code} - ${p.name}` : p.name}</option>
            ))}
          </select>
          <button onClick={() => { if (selectedProjectId) { loadTasks(selectedProjectId); loadSiteDocs(selectedProjectId) } }} className="btn-secondary inline-flex items-center gap-2">
            <ArrowPathIcon className="h-4 w-4" /> Tải lại
          </button>
        </div>
      </div>

      {/* Tổng hợp công việc (dashboard) */}
      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Tổng */}
          <button onClick={()=>handleSummaryClick('all')} className={`text-left w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow ${statusFilter==='all'?'ring-2 ring-cyan-500':''}`} title="Tất cả tasks">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Tổng công việc</div>
                <div className="text-2xl font-semibold text-gray-900">{summary.counts.total}</div>
                <div className="text-xs text-gray-400 mt-1">Tất cả tasks</div>
              </div>
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-sky-50 text-sky-600"><ChartBarIcon className="h-5 w-5"/></div>
            </div>
          </button>
          {/* Hoàn thành */}
          <button onClick={()=>handleSummaryClick('completed')} className={`text-left w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow ${statusFilter==='completed'?'ring-2 ring-cyan-500':''}`} title="Đã hoàn thành">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Hoàn thành</div>
                <div className="text-2xl font-semibold text-emerald-600">{summary.counts.completed}</div>
                <div className="text-xs text-emerald-600 mt-1">% ước tính</div>
              </div>
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600"><CheckCircleIcon className="h-5 w-5"/></div>
            </div>
          </button>
          {/* Đang thực hiện */}
          <button onClick={()=>handleSummaryClick('in_progress')} className={`text-left w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow ${statusFilter==='in_progress'?'ring-2 ring-cyan-500':''}`} title="Đang thực hiện">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Đang thực hiện</div>
                <div className="text-2xl font-semibold text-amber-600">{summary.counts.in_progress}</div>
                <div className="text-xs text-gray-500 mt-1">Đang xử lý</div>
              </div>
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600"><ClockIcon className="h-5 w-5"/></div>
            </div>
          </button>
          {/* Sắp đến hạn */}
          <button onClick={()=>handleSummaryClick('nearly_due')} className={`text-left w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow ${statusFilter==='nearly_due'?'ring-2 ring-cyan-500':''}`} title="Sắp đến hạn (≤ 2 ngày)">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Sắp đến hạn</div>
                <div className="text-2xl font-semibold text-orange-600">{summary.counts.nearly_due}</div>
                <div className="text-xs text-gray-500 mt-1">≤ 2 ngày</div>
              </div>
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-orange-50 text-orange-600"><ExclamationTriangleIcon className="h-5 w-5"/></div>
            </div>
          </button>
          {/* Trễ hạn */}
          <button onClick={()=>handleSummaryClick('overdue')} className={`text-left w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow ${statusFilter==='overdue'?'ring-2 ring-cyan-500':''}`} title="Trễ hạn">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Trễ hạn</div>
                <div className="text-2xl font-semibold text-rose-600">{summary.counts.overdue}</div>
                <div className="text-xs text-rose-600 mt-1">Cần xử lý</div>
              </div>
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-rose-50 text-rose-600"><FireIcon className="h-5 w-5"/></div>
            </div>
          </button>
        </div>

        {/* Chi tiết inline đã được thay bằng lọc nhanh & cuộn xuống bảng chính */}
      </div>

      {/* Bảng tiến độ */}
  <div ref={tableRef} className="bg-white rounded-lg shadow border border-gray-200 mb-8">
        <div className="p-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <button onClick={openNewTask} className="btn-primary inline-flex items-center gap-2"><PlusIcon className="h-4 w-4"/> Thêm đầu việc</button>
            <button onClick={()=>openExportPreview('excel')} className="btn-secondary inline-flex items-center gap-2"><DocumentArrowDownIcon className="h-4 w-4"/> Xuất Excel</button>
            <button onClick={()=>openExportPreview('pdf')} className="btn-secondary inline-flex items-center gap-2"><DocumentArrowDownIcon className="h-4 w-4"/> Xuất PDF</button>
            <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer">
              <DocumentArrowUpIcon className="h-4 w-4"/> Nhập Excel
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onImportFileChange} />
            </label>
            {/* Đã gỡ nút chèn đầu/cuối để gom vào menu thao tác một nút */}
          </div>
          <div className="flex items-center gap-2">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Tìm công việc..." className="input"/>
            <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="input select">
              <option value="all">Tất cả trạng thái</option>
              <option value="in_progress">Đang thực hiện</option>
              <option value="nearly_due">Sắp đến hạn</option>
              <option value="overdue">Quá hạn</option>
              <option value="completed">Hoàn thành</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full w-full table-auto divide-y divide-gray-200 border border-gray-200 [&>thead>tr>th]:text-center [&>thead>tr>th]:align-middle [&>tbody>tr>td]:align-middle [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">STT</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Khu vực</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Nội dung công việc</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày bắt đầu</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Hạn hoàn thành</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">% theo thời gian</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">% thực tế</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Nhân công</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Y/c tăng cường</th>
                <th className="px-3 py-2"/>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tasksLoading ? (
                <tr><td colSpan={11} className="p-6"><LoadingSpinner message="Đang tải công việc..."/></td></tr>
              ) : (
                filteredTasks.map((t, idx) => {
                  const timePct = computeTimeProgress(t.start_date, t.due_date)
                  const baseManpower = getBaseManpower(t)
                  const currentManpower = manpowerOverrides?.[t.id] != null ? manpowerOverrides[t.id] : baseManpower
                  const actualPct = Number(t.progress_percent || 0)
                  const needManpowerNum = timePct > actualPct
                    ? Math.round((timePct / Math.max(actualPct, 1)) * 1.3 * Math.max(currentManpower, 0))
                    : 0
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm text-gray-700">{idx + 1}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{getTaskArea(t) || '-'}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-left align-middle whitespace-normal break-words leading-relaxed">
                        {getTaskArea(t) ? (
                          <>
                            <span className="font-semibold text-blue-700">{getTaskArea(t)}</span>{' '}
                          </>
                        ) : null}
                        <span>{stripAreaTagFromTitle(t.title)}</span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">{formatDate(t.start_date)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{formatDate(t.due_date)}</td>
                      <td className="px-3 py-2">
                        <TaskStatusPill task={t} />
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">{timePct}%</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{t.progress_percent || 0}%</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{currentManpower}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={needManpowerNum > 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}>{needManpowerNum}</span>
                      </td>
                      <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                        <div className="relative inline-block text-left">
                          <button
                            ref={(el) => { if (el) actionBtnRefs.current[t.id] = el }}
                            onClick={(e) => { e.stopPropagation(); setOpenActionMenuId(prev => prev === t.id ? null : t.id) }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            title="Thao tác"
                          >
                            <EllipsisVerticalIcon className="h-5 w-5" />
                          </button>
                          <PortalDropdown
                            open={openActionMenuId === t.id}
                            onClose={() => setOpenActionMenuId(null)}
                            anchorRef={{ current: actionBtnRefs.current[t.id] }}
                            width={208}
                          >
                            <div className="py-1 text-sm">
                              <div className="px-3 py-2 text-gray-500 uppercase tracking-wide text-[11px]">Thao tác</div>
                              <button className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 inline-flex items-center gap-2" onClick={() => setOpenActionMenuId(null)}>
                                <EyeIcon className="h-4 w-4"/> Xem
                              </button>
                              {/* Simplified: remove copy/cut/paste, insert, and move actions */}
                              <div className="my-1 h-px bg-gray-100" />
                              <button onClick={() => { setOpenActionMenuId(null); openEditTask(t) }} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-blue-700 inline-flex items-center gap-2"><PencilIcon className="h-4 w-4"/>Sửa</button>
                              <button onClick={() => { setOpenActionMenuId(null); deleteTask(t) }} className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-700 inline-flex items-center gap-2"><TrashIcon className="h-4 w-4"/>Xóa</button>
                            </div>
                          </PortalDropdown>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
              {(!tasksLoading && filteredTasks.length === 0) && (
                <tr><td colSpan={11} className="px-3 py-6 text-center text-sm text-gray-500">Chưa có đầu việc</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mặt bằng thi công (PDF theo khu vực) */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Mặt bằng thi công (PDF theo khu vực)</h2>
            <TooltipIcon label="Tải mặt bằng theo khu vực. Có thể tách nhiều trang từ 1 PDF ngay bên dưới.">
              <InformationCircleIcon className="h-5 w-5 text-gray-400"/>
            </TooltipIcon>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input value={docSearch} onChange={(e)=>setDocSearch(e.target.value)} placeholder="Tìm theo tiêu đề/tên file..." className="input pl-9"/>
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"/>
            </div>
             <select value={docAreaFilter} onChange={(e)=>setDocAreaFilter(e.target.value)} className="input select">
               <option value="all">Tất cả khu vực</option>
               {areas.map(a => <option key={a} value={a}>{a}</option>)}
             </select>
             {/* Ẩn nút Xuất Excel theo yêu cầu */}
             <button
               onClick={async()=>{ if (selectedProjectId) { await loadLayerDocs(selectedProjectId); setShowLayerViewer(true) } }}
               className="btn-secondary inline-flex items-center"
               title="Xem chồng lớp PDF"
               aria-label="Xem chồng lớp PDF"
             >
               <EyeIcon className="h-5 w-5"/>
             </button>
             {/* Đã ẩn chú dẫn xung đột theo yêu cầu */}
          </div>
        </div>

        <div className="px-4 pb-4">
          <form onSubmit={uploadSiteDoc} className="grid md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                File PDF
                <TooltipIcon label="Chọn tệp PDF mặt bằng thi công">
                  <PaperClipIcon className="h-4 w-4 text-gray-400"/>
                </TooltipIcon>
              </label>
              <div className="flex items-center gap-2">
                <input id="site-doc-file" type="file" accept="application/pdf" onChange={(e)=>setDocFile(e.target.files?.[0]||null)} className="sr-only" />
                <label htmlFor="site-doc-file" className="btn-secondary cursor-pointer inline-flex items-center gap-2" title="Chọn file PDF">
                  <PaperClipIcon className="h-4 w-4"/> Chọn tệp
                </label>
                {docFile && (
                  <span className="text-sm text-gray-600 truncate max-w-[220px]" title={docFile.name}>{docFile.name}</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                Khu vực
                <TooltipIcon label="Chọn khu vực tương ứng bản vẽ">
                  <MapPinIcon className="h-4 w-4 text-gray-400"/>
                </TooltipIcon>
              </label>
              <select value={docArea} onChange={(e)=>setDocArea(e.target.value)} className="input select">
                <option value="">Chọn khu vực</option>
                {taskAreas.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                Tiêu đề
                <TooltipIcon label="Đặt tiêu đề hiển thị cho tài liệu">
                  <TagIcon className="h-4 w-4 text-gray-400"/>
                </TooltipIcon>
              </label>
              <input value={docTitle} onChange={(e)=>setDocTitle(e.target.value)} placeholder="Tên tài liệu" className="input" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary inline-flex items-center gap-2" title="Tải PDF lên dự án">
                <CloudArrowUpIcon className="h-4 w-4"/>Tải lên
              </button>
              <button type="button" onClick={()=>{setDocFile(null);setDocArea('');setDocTitle('')}} className="btn-secondary inline-flex items-center gap-2" title="Làm mới biểu mẫu">
                <ArrowPathIcon className="h-4 w-4"/>Làm mới
              </button>
            </div>
          </form>
         </div>
 
         {/* Wizard: Tách PDF nhiều bản vẽ thành nhiều tài liệu (site_plan) */}
         <div className="px-4 pb-4">
           <SiteDocsFromPdfWizard
             projectId={selectedProjectId}
             areaOptions={taskAreas}
             onInserted={(rows)=>{ if (Array.isArray(rows) && rows.length) setSiteDocs(prev => [...rows, ...prev]) }}
           />
         </div>

        <div className="overflow-x-auto">
          <table className="min-w-full w-full table-auto divide-y divide-gray-200 border border-gray-200 [&>thead>tr>th]:text-left [&>thead>tr>th]:align-middle [&>tbody>tr>td]:align-middle [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STT</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Khu vực</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiêu đề</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên file</th>
                <th className="px-3 py-2"/>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {docsLoading ? (
                <tr><td colSpan={5} className="p-6"><LoadingSpinner message="Đang tải tài liệu..."/></td></tr>
              ) : (
                filteredDocs.map((d, idx) => (
                  <tr key={d.id}>
                    <td className="px-3 py-2 text-sm text-gray-700">{idx + 1}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 text-left">{parseAreaFromTitle(d.title) || '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-left whitespace-normal break-words">{stripAreaTagFromTitle(d.title)}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 text-left whitespace-normal break-words">{d.file_name}</td>
                    <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                      <div className="relative inline-block text-left">
                        <button
                          ref={(el) => { if (el) docBtnRefs.current[d.id] = el }}
                          onClick={(e) => { e.stopPropagation(); setOpenDocMenuId(prev => prev === d.id ? null : d.id) }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          title="Thao tác"
                        >
                          <EllipsisVerticalIcon className="h-5 w-5" />
                        </button>
                        <PortalDropdown
                          open={openDocMenuId === d.id}
                          onClose={() => setOpenDocMenuId(null)}
                          anchorRef={{ current: docBtnRefs.current[d.id] }}
                          width={208}
                        >
                          <div className="py-1 text-sm">
                            <div className="px-3 py-2 text-gray-500 uppercase tracking-wide text-[11px]">Thao tác</div>
                            <a href={d.file_url} target="_blank" rel="noreferrer" onClick={() => setOpenDocMenuId(null)} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 inline-flex items-center gap-2">
                              <EyeIcon className="h-4 w-4"/> Mở
                            </a>
                            <div className="my-1 h-px bg-gray-100" />
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenDocMenuId(null); const curArea = parseAreaFromTitle(d.title); const newArea = window.prompt('Nhập khu vực', curArea) ?? curArea; const baseTitle = d.title.replace(/\s*\[(?:KV|Khu\s*vuc|Khu\s*vực)\s*:\s*[^\]]+\]\s*/i, ''); const newTitleOnly = window.prompt('Tiêu đề', baseTitle.trim()) ?? baseTitle; updateDocMeta(d, { title: newTitleOnly, area: newArea }) }} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-blue-700 inline-flex items-center gap-2"><PencilIcon className="h-4 w-4"/>Sửa</button>
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenDocMenuId(null); deleteDoc(d) }} className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-700 inline-flex items-center gap-2"><TrashIcon className="h-4 w-4"/>Xóa</button>
                          </div>
                        </PortalDropdown>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {/* Drag-and-drop end zone removed */}
              {(!docsLoading && filteredDocs.length === 0) && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">Chưa có tài liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bản vẽ phối hợp đã lưu */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="text-base font-semibold">Bản vẽ phối hợp đã lưu</div>
          <div className="text-sm text-gray-500">{composedRows.length} mục</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-3 py-2 text-center w-16">STT</th>
                <th className="px-3 py-2 text-center">KHU VỰC</th>
                <th className="px-3 py-2 text-left">TIÊU ĐỀ</th>
                <th className="px-3 py-2 text-center">TÊN FILE</th>
                <th className="px-3 py-2 text-center w-16">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {composedLoading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Đang tải…</td></tr>
              ) : (
                (composedRows || []).map((r, idx) => {
                  const fileName = r.name || r.file_name || r.source_file_name || (r.file_url ? decodeURIComponent(r.file_url.split('/').pop() || '') : '')
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-3 py-2 text-center">{idx+1}</td>
                      <td className="px-3 py-2 text-center">{r.area || '—'}</td>
                      <td className="px-3 py-2">{r.title || 'Bản vẽ phối hợp'}</td>
                      <td className="px-3 py-2 text-center">{fileName || '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="relative inline-block" ref={el => { composedBtnRefs.current[r.id] = el }}>
                          <button onClick={(e)=>{ e.stopPropagation(); setOpenComposedMenuId(openComposedMenuId===r.id?null:r.id) }} className="p-2 rounded hover:bg-gray-100">
                            <EllipsisVerticalIcon className="h-5 w-5 text-gray-600"/>
                          </button>
                          <PortalDropdown anchorRef={{ current: composedBtnRefs.current[r.id] }} open={openComposedMenuId===r.id} onClose={()=>setOpenComposedMenuId(null)} width={208}>
                            <div className="py-1">
                              <a href={r.file_url || '#'} target="_blank" rel="noreferrer" className="w-full text-left px-3 py-2 hover:bg-gray-50 inline-flex items-center gap-2">Mở</a>
                              <button onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setOpenComposedMenuId(null); const newArea = window.prompt('Nhập khu vực', r.area || '') ?? r.area; const baseTitle = (r.title || r.name || '').trim(); const suggested = 'Bản vẽ phối hợp'; const newTitle = window.prompt('Tiêu đề', suggested) ?? suggested; const computedName = `${(newArea||r.area||'').trim()} Bản vẽ phối hợp`.trim(); updateComposedMeta(r, { title: newTitle, area: newArea, nameOverride: computedName }) }} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-blue-700 inline-flex items-center gap-2">Sửa</button>
                              <button onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setOpenComposedMenuId(null); const area = (r.area||'').trim(); const newTitle = 'Bản vẽ phối hợp'; const newName = `${area} Bản vẽ phối hợp`.trim(); updateComposedStandard(r, newTitle, newName) }} className="w-full text-left px-3 py-2 hover:bg-gray-50 inline-flex items-center gap-2">Đặt lại tên chuẩn</button>
                              <button onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setOpenComposedMenuId(null); deleteComposed(r) }} className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-700 inline-flex items-center gap-2">Xóa</button>
                            </div>
                          </PortalDropdown>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
              {(!composedLoading && (composedRows||[]).length === 0) && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Chưa có bản vẽ phối hợp</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showLayerViewer && (
        <PdfLayerViewer
          layers={(layerDocs || []).map(d => ({
            id: d.id,
            name: (d.category || 'Khác') + ' — ' + (d.title || d.file_name),
            url: d.file_url,
            color: '#0066cc'
          }))}
          projectId={selectedProjectId}
          defaultArea={docAreaFilter !== 'all' ? docAreaFilter : ''}
          areaOptions={taskAreas}
          onClose={() => { setShowLayerViewer(false); if (selectedProjectId) loadComposedDrawings(selectedProjectId) }}
          onConflictsChange={(arr)=> setConflictCount(Array.isArray(arr)? arr.length : 0)}
        />
      )}

      {/* Task modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-lg">
            <div className="p-4 border-b border-gray-100 font-semibold">{editingTask ? 'Sửa đầu việc' : 'Thêm đầu việc'}</div>
            <form onSubmit={saveTask} className="p-4 grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung công việc</label>
                <input value={taskForm.title} onChange={(e)=>setTaskForm({...taskForm, title: e.target.value})} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Khu vực</label>
                <input value={taskForm.area} onChange={(e)=>setTaskForm({...taskForm, area: e.target.value})} className="input" placeholder="VD: Tầng 3 - Khu A" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                  <input type="date" value={taskForm.start_date} onChange={(e)=>setTaskForm({...taskForm, start_date: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hạn hoàn thành</label>
                  <input type="date" value={taskForm.due_date} onChange={(e)=>setTaskForm({...taskForm, due_date: e.target.value})} className="input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">% thực tế</label>
                <input type="number" min="0" max="100" value={taskForm.progress_percent} onChange={(e)=>setTaskForm({...taskForm, progress_percent: e.target.value})} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng nhân công (hiện tại)</label>
                <input
                  type="number"
                  min="0"
                  value={taskForm.manpower}
                  onChange={(e)=>setTaskForm({...taskForm, manpower: e.target.value})}
                  className="input"
                  placeholder="Ví dụ: 3"
                />
                <p className="mt-1 text-xs text-gray-500">Giá trị này sẽ được dùng để tính đề xuất tăng cường nhân công.</p>
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={()=>{setShowTaskModal(false); setEditingTask(null)}} className="btn-secondary">Hủy</button>
                <button type="submit" className="btn-primary">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export Preview Modal */}
      {showExportPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-5xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 font-semibold">{exportType === 'pdf' ? 'Xem trước xuất PDF' : 'Xem trước xuất Excel'}</div>
            <div className="p-4 overflow-auto">
              <div className="mb-3 text-xs text-gray-500">Chọn cột và hàng cần xuất. Hiển thị tối đa {PREVIEW_LIMIT} hàng đầu.</div>
              <div className="overflow-auto border rounded">
                <table className="min-w-full w-full text-sm border border-gray-200 [&>thead>tr>th]:text-left [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-xs">
                        <input type="checkbox" checked={exportColumns.every(c => exportSelectedCols.has(c))}
                          onChange={(e)=>{
                            const all = new Set(exportColumns)
                            setExportSelectedCols(e.target.checked ? all : new Set())
                          }}/>
                      </th>
                      {exportColumns.map(col => (
                        <th key={col} className="px-2 py-2 text-xs whitespace-nowrap">
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={exportSelectedCols.has(col)} onChange={(e)=>{
                              setExportSelectedCols(prev => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(col); else next.delete(col)
                                return next
                              })
                            }}/>
                            {col}
                          </label>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {exportRows.slice(0, PREVIEW_LIMIT).map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1 text-xs">
                          <input type="checkbox" checked={exportSelectedRows.has(idx)}
                            onChange={(e)=>{
                              setExportSelectedRows(prev => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(idx); else next.delete(idx)
                                return next
                              })
                            }}/>
                        </td>
                        {exportColumns.map(col => (
                          <td key={col} className="px-2 py-1 text-xs whitespace-nowrap">{String(row[col] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button className="btn-secondary" onClick={()=>setShowExportPreview(false)}>Hủy</button>
              <button className="btn-primary" onClick={confirmExport}>Xuất</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {showImportPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-5xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 font-semibold">Xem trước nhập Excel</div>
            <div className="px-4 pt-1 text-xs text-gray-500">{pendingImportFileName}</div>
            <div className="p-4 overflow-auto">
              <div className="mb-3 text-xs text-gray-500">Chọn cột và hàng cần nhập. Hiển thị tối đa {PREVIEW_LIMIT} hàng đầu.</div>
              <div className="overflow-auto border rounded">
                <table className="min-w-full w-full text-sm border border-gray-200 [&>thead>tr>th]:text-left [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-xs">
                        <input type="checkbox" checked={importRows.slice(0, PREVIEW_LIMIT).every((_,i)=>importSelectedRows.has(i))}
                          onChange={(e)=>{
                            const next = new Set()
                            if (e.target.checked) importRows.slice(0, PREVIEW_LIMIT).forEach((_, i) => next.add(i))
                            setImportSelectedRows(next)
                          }}/>
                      </th>
                      {importHeaders.map(h => (
                        <th key={h} className="px-2 py-2 text-xs whitespace-nowrap">
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={importSelectedCols.has(h)} onChange={(e)=>{
                              setImportSelectedCols(prev => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(h); else next.delete(h)
                                return next
                              })
                            }}/>
                            {h}
                          </label>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {importRows.slice(0, PREVIEW_LIMIT).map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1 text-xs">
                          <input type="checkbox" checked={importSelectedRows.has(idx)}
                            onChange={(e)=>{
                              setImportSelectedRows(prev => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(idx); else next.delete(idx)
                                return next
                              })
                            }}/>
                        </td>
                        {importHeaders.map(h => (
                          <td key={h} className="px-2 py-1 text-xs whitespace-nowrap">{String((row || {})[h] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button className="btn-secondary" onClick={()=>setShowImportPreview(false)}>Hủy</button>
              <button className="btn-primary" onClick={confirmImport}>Nhập</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default ProgressPage
