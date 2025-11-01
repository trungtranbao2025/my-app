import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  FunnelIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
  PaperAirplaneIcon,
  CheckIcon,
  XMarkIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  Squares2X2Icon,
  EllipsisVerticalIcon,
  EyeIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'
import { InformationCircleIcon } from '@heroicons/react/24/outline'
import MultiSelectChips from '../components/MultiSelectChips'
import { 
  CheckCircleIcon as CheckCircleSolid,
  ClockIcon as ClockSolid,
  ExclamationTriangleIcon as ExclamationTriangleSolid,
  FireIcon
} from '@heroicons/react/24/solid'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { 
  formatDate, 
  getTaskStatusColor, 
  getTaskStatusText, 
  getPriorityColor, 
  getPriorityText 
} from '../utils/helpers'
import LoadingSpinner from '../components/LoadingSpinner'
import Pagination from '../components/Pagination'
import ExcelExportButton from '../components/ExcelExportButton'
import ExcelImportButton from '../components/ExcelImportButton'
import VoiceInput from '../components/VoiceInput'
import OCRInput from '../components/OCRInput'
import SelectiveOCRInput from '../components/SelectiveOCRInput'
import ProposalBadge from '../components/ProposalBadge'
import { createTaskReminders, updateTaskReminders, deleteTaskReminders, createTaskRemindersForUsersSameSchedule } from '../utils/reminderScheduler'
import { getMyPendingRemindersCount, runReminderSchedulerNow } from '../utils/remindersHealth'
import { hasReminderPreferences, ensureDefaultReminderPreferences } from '../utils/remindersSetup'
import ExcelService from '../utils/excelService'
import PortalDropdown from '../components/PortalDropdown'
import { supabase } from '../lib/supabase'

// Destructure APIs from default export for cleaner code
const { tasksApi, projectsApi, usersApi, taskProposalsApi } = api

const TasksPage = () => {
  const { profile } = useAuth()
  const { notifications } = useNotifications()
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [proposals, setProposals] = useState([])
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  // Báo cáo PDF qua script bên ngoài: đã gỡ phần modal/upload trong UI
  const [showProposalModal, setShowProposalModal] = useState(false)
  const [showApprovalsModal, setShowApprovalsModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  // Multi-assignees UI state
  const [additionalAssignees, setAdditionalAssignees] = useState([]) // array of user IDs
  const [assigneeCounts, setAssigneeCounts] = useState({}) // taskId => number of additional assignees
  const [comparisonDate, setComparisonDate] = useState(new Date().toISOString().split('T')[0])
  const [openActionMenuId, setOpenActionMenuId] = useState(null)
  const actionBtnRefs = React.useRef({})
  const tableRef = React.useRef(null)
  // Reminders UI state
  const [hasReminderPrefs, setHasReminderPrefs] = useState(false)
  const [pendingReminderCount, setPendingReminderCount] = useState(0)
  const [checkingReminders, setCheckingReminders] = useState(false)
  // Ensure we only auto-create reminder preferences once per mount
  const ensuredReminderPrefsRef = useRef(false)

  // Voice input de-dup helpers
  const lastVoiceTitleRef = React.useRef('')
  const lastVoiceDescRef = React.useRef('')
  const lastVoiceProposalTitleRef = React.useRef('')
  const lastVoiceProposalDescRef = React.useRef('')

  const appendVoiceDedup = (existing, fragment, lastRef, separator = ' ') => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const current = clean(existing)
    const next = clean(fragment)
    if (!next) return existing || ''
    // Skip if exact same as last or already ends with the same fragment
    if (next === lastRef.current) return existing || ''
    if (current && (current.endsWith(next) || current.toLowerCase().endsWith(next.toLowerCase()))) {
      lastRef.current = next
      return existing || ''
    }
    lastRef.current = next
    return existing ? `${existing}${separator}${fragment}` : fragment
  }

  const handleSummaryClick = (type) => {
    // Map click on summary card to status filter and scroll to table
    const next = type || 'all'
    setStatusFilter(next)
    // Giữ nguyên vị trí cuộn theo yêu cầu: không tự động cuộn nữa
  }

  // State for completion report modal
  const [completionReportState, setCompletionReportState] = useState({
    task: null,
    file: null,
    showModal: false,
  })

  

  // Close action dropdown on outside click or Escape
  useEffect(() => {
    const handleDocClick = () => setOpenActionMenuId(null)
    const handleKey = (e) => { if (e.key === 'Escape') setOpenActionMenuId(null) }
    document.addEventListener('mousedown', handleDocClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDocClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [tasksData, projectsData, usersData, proposalsData, approvalsData] = await Promise.all([
        tasksApi.getAll(),
        projectsApi.getAll(),
        usersApi.getAll(),
        taskProposalsApi.getAll().catch(() => []),
        profile?.id ? taskProposalsApi.getPendingForApproval(profile.id).catch(() => []) : Promise.resolve([])
      ])
      
      console.log('Tasks loaded:', tasksData?.length, 'tasks')
      console.log('Proposals loaded:', proposalsData?.length, 'proposals')
      console.log('Pending approvals:', approvalsData?.length)
      
      setTasks(tasksData || [])
      setProjects(projectsData || [])
      setUsers(usersData || [])
      setProposals(proposalsData || [])
      setPendingApprovals(approvalsData || [])

      // Use embedded multi_assignee_count from RPC (map to state structure if needed)
      const countsMap = {}
      for (const t of tasksData || []) {
        if (typeof t.multi_assignee_count === 'number') countsMap[t.id] = t.multi_assignee_count
      }
      setAssigneeCounts(countsMap)
    } catch (error) {
      if (error.code === '42P17') {
        console.warn('Bỏ qua lỗi recursion RLS khi load tasks – hiển thị danh sách rỗng tạm thời')
      } else {
        console.error('Error loading data:', error)
        toast.error('Không thể tải dữ liệu: ' + error.message)
      }
      setTasks([])
      setProjects([])
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [profile?.id]) // Dependency on profile.id

  // Load reminder preferences and pending count; auto-create defaults on first visit
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!profile?.id) return
      setCheckingReminders(true)
      try {
        let hp = await hasReminderPreferences(profile.id)
        if (!hp && !ensuredReminderPrefsRef.current) {
          try {
            await ensureDefaultReminderPreferences(profile.id)
            ensuredReminderPrefsRef.current = true
            hp = true
            // Optional UX: inform once
            toast.success('Đã bật nhắc việc mặc định cho tài khoản của bạn')
          } catch (e) {
            console.warn('ensureDefaultReminderPreferences failed:', e)
          }
        }
        const pc = await getMyPendingRemindersCount(profile.id)
        if (!cancelled) {
          setHasReminderPrefs(!!hp)
          setPendingReminderCount(pc)
        }
      } catch (_) {
        if (!cancelled) {
          setHasReminderPrefs(false)
          setPendingReminderCount(0)
        }
      } finally {
        if (!cancelled) setCheckingReminders(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [profile?.id])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    assigned_to: '',
    priority: 'medium',
    start_date: '',
    due_date: '',
    self_assessment_percent: 0,
    task_type: 'one_time',
    recurrence_frequency: 'weekly',
    recurrence_interval: 1,
    recurrence_end_date: '',
    recurrence_weekday: '', // 0=CN, 1=Thứ 2, ... 6=Thứ 7 (theo Postgres DOW)
    recurrence_month_day: '',
    recurrence_quarter: '',
    recurrence_quarter_month_index: ''
  })
  const [proposalFormData, setProposalFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    proposed_assignee: '',
    priority: 'medium',
    start_date: '',
    due_date: '',
    notes: ''
  })

  // Helper: Get user's role in a specific project
  const getUserRoleInProject = (projectId) => {
    if (!profile || !projectId) return null
    
    // Global manager can do everything
    if (profile.role === 'manager') {
      return 'manager'
    }

    // Find user's membership in this project
    const membership = profile.project_members?.find(
      pm => pm.project?.id === projectId
    )
    
    return membership?.system_role_in_project || null
  }

  // Quick reminder feature removed

  // Helper: Check if user can view project
  const canViewProject = (projectId) => {
    if (!profile) return false
    
    // Global manager can view all
    if (profile.role === 'manager') return true
    
    // Check if user is member of this project
    return profile.project_members?.some(pm => pm.project?.id === projectId) || false
  }

  // Helper: Check if user can create task in project
  const canCreateTask = (projectId) => {
    const role = getUserRoleInProject(projectId)
    // Manager and Admin can create tasks for anyone
    // User can create tasks for themselves
    return role === 'manager' || role === 'admin' || role === 'user'
  }

  // Helper: Check if user can assign task to others
  const canAssignToOthers = (projectId) => {
    const role = getUserRoleInProject(projectId)
    // Only Manager and Admin can assign to others
    return role === 'manager' || role === 'admin'
  }

  // Helper: Check if user needs to propose task (user role proposing to higher levels)
  const needsProposal = (projectId, targetUserId) => {
    if (!projectId || !targetUserId || !profile) return false
    
    const userRole = getUserRoleInProject(projectId)
    const targetUser = users.find(u => u.id === targetUserId)
    if (!targetUser) return false
    
    const targetMembership = targetUser.project_members?.find(pm => pm.project?.id === projectId)
    if (!targetMembership) return true // Not a member, needs approval
    
    const targetRole = targetMembership.system_role_in_project || 'user'
    
    // User can directly assign to themselves or same level
    if (userRole === 'user' && targetUserId === profile.id) return false
    
    // User proposing to admin/manager needs approval
    if (userRole === 'user' && (targetRole === 'admin' || targetRole === 'manager')) return true
    
    // User proposing to another user needs approval if not self
    if (userRole === 'user' && targetRole === 'user' && targetUserId !== profile.id) return true
    
    return false
  }

  // Helper: Get approver for proposal
  const getApprover = (projectId) => {
    if (!projectId) return null
    
    const project = projects.find(p => p.id === projectId)
    if (!project) return null
    
    // Find manager or admin of the project
    const members = users.filter(u => 
      u.project_members?.some(pm => 
        pm.project?.id === projectId && 
        (pm.system_role_in_project === 'manager' || pm.system_role_in_project === 'admin')
      )
    )
    
    // Prefer manager, then admin
    const manager = members.find(u => 
      u.project_members?.some(pm => 
        pm.project?.id === projectId && pm.system_role_in_project === 'manager'
      )
    )
    
    if (manager) return manager.id
    
    const admin = members.find(u => 
      u.project_members?.some(pm => 
        pm.project?.id === projectId && pm.system_role_in_project === 'admin'
      )
    )
    
    return admin?.id || null
  }

  // Helper: Get maximum role user can assign
  const getMaxAssignableRole = (projectId) => {
    const userRole = getUserRoleInProject(projectId)
    
    // Role hierarchy: manager > admin > user
    const roleHierarchy = {
      'manager': 3,
      'admin': 2,
      'user': 1
    }
    
    return {
      role: userRole,
      level: roleHierarchy[userRole] || 0
    }
  }

  // Helper: Check if can assign specific user to task
  const canAssignUser = (projectId, targetUserId) => {
    if (!projectId || !targetUserId || !profile) return false

    const userRole = getUserRoleInProject(projectId)
    const targetUser = users.find(u => u.id === targetUserId)
    if (!targetUser) return false

    // Only allow selecting users who are already members of the chosen project
    const targetMembership = targetUser.project_members?.find(
      pm => pm.project?.id === projectId
    )
    if (!targetMembership) return false

    const targetRole = targetMembership.system_role_in_project || 'user'

    // Global / project manager: can assign any member of the project (manager/admin/user)
    if (userRole === 'manager') return true

    // Can always assign to themselves if they are a member
    if (targetUserId === profile.id) return true

    // Admin can assign to members with role <= admin (admin or user)
    if (userRole === 'admin') {
      return targetRole === 'user' || targetRole === 'admin'
    }

    // Regular user: only themselves
    return targetUserId === profile.id
  }

  // Keep co-assignees valid when project or main assignee changes
  useEffect(() => {
    setAdditionalAssignees(prev => {
      if (!formData.project_id) return []
      return (prev || []).filter(uid => uid !== formData.assigned_to && canAssignUser(formData.project_id, uid))
    })
  }, [formData.project_id, formData.assigned_to, users])

  // Helper: Check if user can edit task
  const canEditTask = (task) => {
    if (!task) return false
    
    const role = getUserRoleInProject(task.project_id)
    
    // Manager/Admin can edit all tasks in their project
    if (role === 'manager' || role === 'admin') return true
    
    // Regular user can only edit their own tasks
    if (role === 'user' && task.assigned_to === profile?.id) return true
    
    return false
  }

  // Helper: Check if user can delete task
  const canDeleteTask = (task) => {
    if (!task) return false
    
    const role = getUserRoleInProject(task.project_id)
    
    // Only managers can delete
    return role === 'manager'
  }

  // Helper: Calculate progress percent based on dates
  const calculateProgressPercent = (startDate, dueDate) => {
    if (!startDate || !dueDate) return 0
    
    const start = new Date(startDate)
    const due = new Date(dueDate)
    const comparison = new Date(comparisonDate)
    
    // Reset time to start of day
    start.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    comparison.setHours(0, 0, 0, 0)
    
    const totalDays = Math.ceil((due - start) / (1000 * 60 * 60 * 24))
    const elapsedDays = Math.ceil((comparison - start) / (1000 * 60 * 60 * 24))
    
    if (totalDays <= 0) return 0
    
    const progressPercent = Math.round((elapsedDays / totalDays) * 100)
    // Trả về giá trị thực để phát hiện quá hạn
    return progressPercent
  }

  // Helper: Calculate days remaining based on comparison date
  const getDaysRemaining = (dueDate, isCompleted) => {
    if (isCompleted || !dueDate) return null
    
    const due = new Date(dueDate)
    const comparison = new Date(comparisonDate)
    
    // Reset time to start of day for accurate day calculation
    due.setHours(0, 0, 0, 0)
    comparison.setHours(0, 0, 0, 0)
    
    const diffTime = due - comparison
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays
  }

  // Helper: Get status info based on days remaining
  const getStatusInfo = (task) => {
    // Check if task is completed (ưu tiên is_completed do trigger cập nhật tự động status)
    const isCompleted = task.is_completed === true || task.status === 'completed' || (task.progress_percent != null && Number(task.progress_percent) >= 100)
    if (isCompleted) {
      return {
        label: 'Hoàn thành',
        color: 'bg-green-500',
        textColor: 'text-green-700',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        daysRemaining: null
      }
    }
    
    const daysRemaining = getDaysRemaining(task.due_date, isCompleted)
    
    if (daysRemaining === null) {
      return {
        label: 'Chưa có hạn',
        color: 'bg-gray-400',
        textColor: 'text-gray-700',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        daysRemaining: null
      }
    }
    
    if (daysRemaining < 0) {
      return {
        label: 'Trễ hạn',
        color: 'bg-red-500',
        textColor: 'text-red-700',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        daysRemaining
      }
    }
    // Nearly due when remaining days <= 2
    if (daysRemaining <= 2) {
      return {
        label: 'Sắp đến hạn',
        color: 'bg-orange-500',
        textColor: 'text-orange-700',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        daysRemaining
      }
    }
    
    return {
      label: 'Đang thực hiện',
      color: 'bg-yellow-500',
      textColor: 'text-yellow-700',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      daysRemaining
    }
  }

  // Helper: Render days remaining bar chart
  const renderDaysBar = (daysRemaining) => {
    if (daysRemaining === null) return null
    
    const maxDays = 30
    const absRemaining = Math.abs(daysRemaining)
    const percentage = Math.min((absRemaining / maxDays) * 100, 100) // 0-100% of full width
    
    if (daysRemaining < 0) {
      // Negative days - full red bar filling from 0 to left
      return (
        <div className="flex items-center h-2">
          <div className="flex-1 flex justify-end bg-gray-100 rounded-l h-2 relative overflow-hidden">
            <div 
              className="h-full bg-gradient-to-l from-red-600 to-red-400 rounded-l transition-all duration-300"
              style={{ width: `${percentage}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent"></div>
            </div>
          </div>
          <div className="w-px h-3 bg-gray-700"></div>
          <div className="flex-1 bg-gray-100 rounded-r h-2"></div>
        </div>
      )
    }
    
    if (daysRemaining === 0) {
      // Zero days - marker at center
      return (
        <div className="flex items-center h-2">
          <div className="flex-1 bg-gray-100 rounded-l h-2"></div>
          <div className="w-1 h-3 bg-orange-500 rounded-sm animate-pulse shadow"></div>
          <div className="flex-1 bg-gray-100 rounded-r h-2"></div>
        </div>
      )
    }
    
    // Positive days - full yellow/green bar filling from 0 to right
    const barColor = daysRemaining <= 7 
      ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' 
      : 'bg-gradient-to-r from-green-400 to-green-600'
    
    return (
      <div className="flex items-center h-2">
        <div className="flex-1 bg-gray-100 rounded-l h-2"></div>
        <div className="w-px h-3 bg-gray-700"></div>
        <div className="flex-1 bg-gray-100 rounded-r h-2 relative overflow-hidden">
          <div 
            className={`h-full ${barColor} rounded-r transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent"></div>
          </div>
        </div>
      </div>
    )
  }

  // Helper: Toggle task completion
  const handleToggleComplete = async (task) => {
    const isCurrentlyCompleted = task.is_completed === true || task.status === 'completed' || (task.progress_percent != null && Number(task.progress_percent) >= 100)

    // NEW: For recurring tasks, require a report on completion
    if (!isCurrentlyCompleted && task.task_type === 'recurring') {
      setCompletionReportState({ task, file: null, showModal: true })
      return
    }

    console.log('Toggle completion:', {
      taskId: task.id,
      currentStatus: task.status,
      is_completed: task.is_completed,
      isCurrentlyCompleted,
      willChangeTo: isCurrentlyCompleted ? 'uncomplete' : 'complete'
    })

    try {
      if (isCurrentlyCompleted) {
        // Bỏ hoàn thành: chỉ đổi is_completed=false (trigger sẽ tự cập nhật status)
        const updateData = { is_completed: false }
        console.log('Sending update (uncomplete):', updateData)
        const result = await tasksApi.update(task.id, updateData)
        // Sau khi mở lại công việc, tạo lại nhắc việc theo cài đặt người dùng
        try {
          const extra = await projectsApi.getAssignees(task.id)
          const ids = (extra || []).map(u => u.id)
          const allUserIds = [task.assigned_to?.id || task.assigned_to, ...ids].filter(Boolean)
          // Dùng trạng thái mới (không hoàn thành) để lên lịch lại
          const reopenedTask = { ...task, is_completed: false, status: result?.status || 'in_progress' }
          await createTaskRemindersForUsersSameSchedule(reopenedTask, allUserIds)
        } catch (e) {
          console.warn('Re-schedule reminders after uncomplete failed:', e)
        }
        toast.success('Đã bỏ đánh dấu hoàn thành')
      } else {
        // Đánh dấu hoàn thành
        // - Với công việc định kỳ (recurring): đã xử lý ở trên bằng modal nộp báo cáo
        // - Với công việc đột xuất (one_time): set trạng thái completed ngay để checkbox phản ánh đúng
        if ((task.task_type || 'one_time') === 'one_time') {
          console.log('Completing one-time task via tasksApi.complete')
          const result = await tasksApi.complete(task.id)
          console.log('Complete result from API:', result)
        } else {
          // Phòng trường hợp các loại khác: fallback set is_completed=true
          const updateData = { is_completed: true, self_assessment_percent: 100 }
          console.log('Sending update (complete):', updateData)
          const result = await tasksApi.update(task.id, updateData)
          console.log('Update result from API:', result)
        }
        // Khi hoàn thành, xóa các nhắc việc chưa gửi để tránh thông báo trễ
        try { await deleteTaskReminders(task.id) } catch (e) { console.warn('deleteTaskReminders on complete failed:', e) }
        toast.success('Đã đánh dấu hoàn thành')
      }
      console.log('Update successful, reloading data...')
      await loadData()
      console.log('Data reloaded')
    } catch (error) {
      console.error('Error toggling completion:', error)
      // Friendly hint for legacy reminders schema (is_sent vs sent)
      const msg = String(error?.message || '')
      if ((error?.code === '42703' || /column .* does not exist/i.test(msg)) && /task_reminders.*is_sent/i.test(msg)) {
        toast.error('Lỗi cơ sở dữ liệu: thiếu cột is_sent trong task_reminders. Vui lòng chạy file HOTFIX-2025-10-30-fix-reminder-sent-column.sql (hoặc fix-reminder-settings-schema.sql) trong Supabase để chuẩn hóa schema.')
      } else {
        toast.error('Lỗi: ' + (error?.message || 'Không thể cập nhật'))
      }
    }
  }

  const handleCompletionReportSubmit = async () => {
    const { task, file } = completionReportState
    if (!task || !file) {
      toast.error('Vui lòng chọn file báo cáo PDF.')
      return
    }

    try {
      // 1. Upload the report file
      // Prefer bucket 'task-reports' (dash). Fallback to 'project-docs' if missing.
      const sanitize = (name) => String(name)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
      const safeName = sanitize(file.name)
      const filePath = `${task.project_id}/${task.id}/${Date.now()}-${safeName}`

      const primaryBucket = 'task-reports'
      const fallbackBucket = 'project-docs'
      let bucketUsed = primaryBucket
      let upErr = null
      try {
        const res = await supabase.storage
          .from(primaryBucket)
          .upload(filePath, file, { upsert: false, contentType: file.type || 'application/pdf' })
        upErr = res.error
        if (upErr) throw upErr
      } catch (e) {
        const msg = String(e?.message || e)
        if (/bucket .* not found|does not exist/i.test(msg)) {
          // fallback when primary bucket is missing
          const res2 = await supabase.storage
            .from(fallbackBucket)
            .upload(filePath, file, { upsert: false, contentType: file.type || 'application/pdf' })
          if (res2.error) {
            throw new Error("Lỗi tải file: Bucket 'task-reports' chưa tồn tại. Vui lòng tạo bucket hoặc chạy file CREATE-TASK-REPORTS-BUCKET.md / create-task-reports-storage.sql trong Supabase. Chi tiết: " + res2.error.message)
          }
          bucketUsed = fallbackBucket
        } else {
          throw new Error('Lỗi tải file: ' + msg)
        }
      }

      // 1b. Insert DB record into task_attachments so triggers/policies can validate PDF presence
      const { data: pub } = supabase.storage.from(bucketUsed).getPublicUrl(filePath)
      const fileUrl = pub?.publicUrl || `${bucketUsed}/${filePath}`
      const { data: userRes } = await supabase.auth.getUser()
      const uploaderId = userRes?.user?.id || null
      const { error: insErr } = await supabase
        .from('task_attachments')
        .insert([{
          task_id: task.id,
          project_id: task.project_id || null,
          file_name: file.name,
          file_url: fileUrl,
          file_size: file.size || null,
          file_type: 'application/pdf',
          uploaded_by: uploaderId
        }])
      if (insErr) {
        throw new Error('Lỗi ghi bản ghi báo cáo vào cơ sở dữ liệu: ' + insErr.message)
      }

      // 2. Mark the task as completed (ensure visible status/progress for list views)
      const today = new Date().toISOString().slice(0,10)
      const updateData = { 
        is_completed: true,
        status: 'completed',
        progress_percent: 100,
        completed_date: today,
        self_assessment_percent: 100 
      }
      try {
        await tasksApi.update(task.id, updateData)
      } catch (e) {
        // Some environments return 406 (PGRST116) if return=representation yields 0 rows post-update
        if (e?.code === 'PGRST116') {
          console.warn('Update returned no row (PGRST116); treating as success and reloading...')
        } else {
          throw e
        }
      }

      // 3. Clean up reminders
      try {
        await deleteTaskReminders(task.id)
      } catch (e) {
        console.warn('deleteTaskReminders on complete failed:', e)
      }

      toast.success('Đã hoàn thành công việc và tải lên báo cáo.')
      setCompletionReportState({ task: null, file: null, showModal: false })
      await loadData()
    } catch (error) {
      console.error('Error submitting completion report:', error)
      toast.error(`Lỗi: ${error.message}`)
    }
  }

  // Helper: Update self assessment
  const handleSelfAssessmentChange = async (task, newValue) => {
    const value = parseInt(newValue) || 0
    
    try {
      await tasksApi.update(task.id, {
        self_assessment_percent: value
      })
      
      loadData()
    } catch (error) {
      console.error('Error updating self assessment:', error)
      toast.error('Lỗi: ' + error.message)
    }
  }

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime: Reload when proposal notifications arrive
  useEffect(() => {
    const proposalNotifications = notifications.filter(n => 
      n.type === 'proposal' || n.type === 'success' || n.type === 'error'
    )
    if (proposalNotifications.length > 0) {
      // Reload data to get latest proposals and tasks
      loadData()
    }
  }, [notifications, loadData])

  // Báo cáo PDF: đã chuyển sang script ngoại (reportlab). Gỡ helpers UI nội bộ.

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!formData.title.trim()) {
      toast.error('Vui lòng nhập tên công việc')
      return
    }
    if (!formData.project_id) {
      toast.error('Vui lòng chọn dự án')
      return
    }
    if (!formData.assigned_to) {
      toast.error('Vui lòng chọn người thực hiện')
      return
    }

    // Permission check
    if (!canCreateTask(formData.project_id)) {
      toast.error('Bạn không có quyền tạo công việc trong dự án này')
      return
    }

    // Check if needs proposal
    if (needsProposal(formData.project_id, formData.assigned_to)) {
      toast('Công việc này cần phê duyệt. Vui lòng gửi đề xuất.')
      // Switch to proposal form
      setProposalFormData({
        ...formData,
        proposed_assignee: formData.assigned_to,
        notes: ''
      })
      setShowModal(false)
      setShowProposalModal(true)
      return
    }

    // Check if user can assign to others
    if (formData.assigned_to !== profile.id && !canAssignToOthers(formData.project_id)) {
      toast.error('Bạn chỉ có thể tạo công việc cho chính mình')
      return
    }

    // If editing, check edit permission
    if (editingTask && !canEditTask({ ...editingTask, ...formData })) {
      toast.error('Bạn không có quyền sửa công việc này')
      return
    }

    // Business rule: due_date must be >= start_date
    try {
      const s = formData.start_date ? new Date(formData.start_date) : null
      const d = formData.due_date ? new Date(formData.due_date) : null
      if (s && d && d < s) {
        toast.error('Hạn hoàn thành phải lớn hơn hoặc bằng Ngày bắt đầu')
        return
      }
    } catch (_) {}

    try {
      // Whitelist các trường hợp lệ cho tasks table
      const validFields = [
        'title', 'description', 'project_id', 'assigned_to', 'assigned_by',
        'priority', 'start_date', 'due_date', 'status', 'progress_percent',
        'self_assessment_percent', 'task_type', 'recurrence_frequency',
        'recurrence_interval', 'recurrence_end_date', 'recurrence_weekday',
        'recurrence_month_day', 'recurrence_quarter', 'recurrence_quarter_month_index',
        'notes', 'is_completed', 'completed_date'
      ]
      
      // Chuẩn hóa dữ liệu trước khi gửi
      const rawTaskData = {
        ...formData,
        assigned_by: profile.id,
        self_assessment_percent: Number(formData.self_assessment_percent) || 0,
        recurrence_interval: formData.task_type === 'recurring' ? Number(formData.recurrence_interval) || 1 : null,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString().split('T')[0] : null,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString().split('T')[0] : null,
        recurrence_end_date: formData.task_type === 'recurring' && formData.recurrence_end_date ? new Date(formData.recurrence_end_date).toISOString().split('T')[0] : null,
        recurrence_weekday: formData.task_type === 'recurring' && formData.recurrence_frequency === 'weekly' && formData.recurrence_weekday !== ''
          ? Number(formData.recurrence_weekday) : null,
        recurrence_month_day: formData.task_type === 'recurring' && formData.recurrence_frequency === 'monthly' && formData.recurrence_month_day !== ''
          ? Number(formData.recurrence_month_day) : (formData.task_type === 'recurring' && formData.recurrence_frequency === 'quarterly' && formData.recurrence_month_day !== '' ? Number(formData.recurrence_month_day) : null),
        recurrence_quarter: formData.task_type === 'recurring' && formData.recurrence_frequency === 'quarterly' && formData.recurrence_quarter !== ''
          ? Number(formData.recurrence_quarter) : null,
        recurrence_quarter_month_index: formData.task_type === 'recurring' && formData.recurrence_frequency === 'quarterly' && formData.recurrence_quarter_month_index !== ''
          ? Number(formData.recurrence_quarter_month_index) : null,
        // Đảm bảo giá trị task_type đúng enum Supabase
        task_type: formData.task_type
      }
      
      // Xóa trường lặp lại nếu không phải task định kỳ
      if (formData.task_type !== 'recurring') {
        rawTaskData.recurrence_frequency = null
        rawTaskData.recurrence_interval = null
        rawTaskData.recurrence_end_date = null
        rawTaskData.recurrence_weekday = null
        rawTaskData.recurrence_month_day = null
        rawTaskData.recurrence_quarter = null
        rawTaskData.recurrence_quarter_month_index = null
      }
      
      // Chỉ giữ lại các trường hợp hợp lệ và loại bỏ undefined
      const taskData = {}
      validFields.forEach(field => {
        if (rawTaskData[field] !== undefined) {
          taskData[field] = rawTaskData[field]
        }
      })
      
      let taskId = editingTask?.id
      let updatedTask = null
      
      if (editingTask) {
        updatedTask = await tasksApi.update(editingTask.id, taskData)
        // Persist additional assignees for edit
        const allowed = (additionalAssignees || []).filter(uid => canAssignUser(formData.project_id, uid))
        try { await projectsApi.setAssignees(editingTask.id, allowed) } catch (e) { console.warn('setAssignees failed:', e) }
        
        // Nhắc việc: áp dụng cùng lịch cho tất cả nhân sự (bao gồm người chính)
        if (updatedTask) {
          const allUserIds = [taskData.assigned_to, ...allowed]
          await createTaskRemindersForUsersSameSchedule(updatedTask, allUserIds)
        }
        
  toast.success('Cập nhật công việc thành công')
  // Reload tasks to reflect latest task_type/recurrence values from DB
  await loadData()
      } else {
        taskData.status = 'pending'
  const created = await tasksApi.create(taskData)
        taskId = created?.id
        updatedTask = created
  // Refresh the list so the new task shows correct task_type/recurrence
  await loadData()
        
        // Persist additional assignees for create
        const allowed = (additionalAssignees || []).filter(uid => canAssignUser(formData.project_id, uid))
        if (taskId) { 
          try { await projectsApi.setAssignees(taskId, allowed) } catch (e) { console.warn('setAssignees failed:', e) }
          const allUserIds = [taskData.assigned_to, ...allowed]
          await createTaskRemindersForUsersSameSchedule(updatedTask, allUserIds)
        }
        
        toast.success('Tạo công việc thành công')
      }
      setShowModal(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving task:', error)
      // Nếu gặp lỗi thiếu cột (42703) do schema chưa được cập nhật, hiển thị hướng dẫn cụ thể
      if (error && (error.code === '42703' || /column\s+\"is_custom\"\s+does not exist/i.test(error.message || ''))) {
        toast.error('Lỗi cơ sở dữ liệu: thiếu cột is_custom trong task_reminder_settings. Vui lòng chạy file fix-reminder-settings-schema.sql trong Supabase.')
      } else {
        toast.error('Lỗi: ' + (error.message || error.toString()))
      }
    }
  }

  const handleProposalSubmit = async (e) => {
    e.preventDefault()
    
    if (!proposalFormData.title.trim()) {
      toast.error('Vui lòng nhập tên công việc')
      return
    }
    if (!proposalFormData.project_id) {
      toast.error('Vui lòng chọn dự án')
      return
    }
    if (!proposalFormData.proposed_assignee) {
      toast.error('Vui lòng chọn người thực hiện')
      return
    }

    const approverId = getApprover(proposalFormData.project_id)
    if (!approverId) {
      toast.error('Không tìm thấy người phê duyệt cho dự án này')
      return
    }

    try {
      const proposalData = {
        ...proposalFormData,
        proposed_by: profile.id,
        approver_id: approverId,
        status: 'pending'
      }

      await taskProposalsApi.create(proposalData)
      toast.success('Gửi đề xuất thành công! Chờ phê duyệt.')
      
      setShowProposalModal(false)
      resetProposalForm()
      loadData()
    } catch (error) {
      console.error('Error creating proposal:', error)
      toast.error('Lỗi: ' + error.message)
    }
  }

  const handleApproveProposal = async (proposalId) => {
    try {
      const createdTask = await taskProposalsApi.approve(proposalId)
      toast.success('Đã phê duyệt và tạo công việc!')
      // Tạo nhắc việc tự động theo "Nhắc việc của tôi" cho người thực hiện
      try {
        if (createdTask?.id) {
          const assigneeId = createdTask.assigned_to?.id || createdTask.assigned_to
          const allUserIds = assigneeId ? [assigneeId] : []
          await createTaskRemindersForUsersSameSchedule(createdTask, allUserIds)
        }
      } catch (e) {
        console.warn('Auto reminders after proposal approval failed:', e)
      }
      // Realtime notification will trigger automatically via database trigger
      loadData()
    } catch (error) {
      console.error('Error approving proposal:', error)
      toast.error('Lỗi: ' + error.message)
    }
  }

  const handleRejectProposal = async (proposalId) => {
    const reason = prompt('Lý do từ chối:')
    if (!reason) return

    try {
      await taskProposalsApi.reject(proposalId, reason)
      toast.success('Đã từ chối đề xuất')
      // Realtime notification will trigger automatically via database trigger
      loadData()
    } catch (error) {
      console.error('Error rejecting proposal:', error)
      toast.error('Lỗi: ' + error.message)
    }
  }

  const handleEdit = async (task) => {
    setEditingTask(task)
    setFormData({
      title: task.title,
      description: task.description || '',
      project_id: task.project_id,
      assigned_to: task.assigned_to,
      priority: task.priority,
      start_date: task.start_date || '',
      due_date: task.due_date || '',
      self_assessment_percent: task.self_assessment_percent || 0,
      task_type: task.task_type || 'one_time',
      recurrence_frequency: task.recurrence_frequency || 'weekly',
      recurrence_interval: task.recurrence_interval || 1,
      recurrence_end_date: task.recurrence_end_date || '',
      recurrence_weekday: task.recurrence_weekday !== null && task.recurrence_weekday !== undefined ? task.recurrence_weekday : '',
      recurrence_month_day: task.recurrence_month_day || '',
      recurrence_quarter: task.recurrence_quarter || '',
      recurrence_quarter_month_index: task.recurrence_quarter_month_index || ''
    })
    // Load additional assignees for this task
    try {
      const extra = await projectsApi.getAssignees(task.id)
      const ids = (extra || []).map(u => u.id)
      setAdditionalAssignees(ids)
    } catch (e) {
      console.warn('Cannot load task assignees:', e)
      setAdditionalAssignees([])
    }
    setShowModal(true)
  }

  // ===== Ordering helpers =====
  const getOrderedTasksForProject = (projectId) => {
    const list = tasks.filter(t => t.project_id === projectId)
    // Prefer order_index, fallback to created_at desc
    return list.slice().sort((a, b) => {
      const ai = a.order_index
      const bi = b.order_index
      if (ai != null && bi != null) return ai - bi
      if (ai != null) return -1
      if (bi != null) return 1
      const ad = new Date(a.created_at || a.start_date || 0).getTime()
      const bd = new Date(b.created_at || b.start_date || 0).getTime()
      return bd - ad
    })
  }

  // All insert/move/clipboard features have been removed to simplify the actions menu

  const handleDelete = async (task) => {
    // Check permission
    if (!canDeleteTask(task)) {
      toast.error('Bạn không có quyền xóa công việc này')
      return
    }

    if (!window.confirm('Bạn có chắc muốn xóa công việc này?')) return

    try {
      // Xóa nhắc việc trước khi xóa công việc
      await deleteTaskReminders(task.id)
      
      await tasksApi.delete(task.id)
      toast.success('Xóa công việc thành công')
      loadData()
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error('Lỗi khi xóa: ' + error.message)
    }
  }

  // Export tasks to Excel
  const handleExport = () => {
    const exportData = filteredTasks.map(t => ({
      'Tên công việc': t.title,
      'Mô tả': t.description || '',
      'Dự án': t.project?.name || '',
      'Người thực hiện': t.assigned_to?.full_name || '',
      'Trạng thái': getTaskStatusText(t.status),
      'Ngày bắt đầu': t.start_date ? formatDate(t.start_date) : '',
      'Hạn hoàn thành': t.due_date ? formatDate(t.due_date) : ''
    }))

    return exportData
  }

  // Import tasks from Excel
  const handleImport = async (data) => {
    try {
      let successCount = 0
      let errorCount = 0
      const rowErrors = []

      // Helpers for robust matching and parsing
      const norm = (v) => String(v || '')
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .toLowerCase().trim()
      const normSimple = (v) => norm(v).replace(/[^a-z0-9]+/g, '')

      const parseProjectRef = (raw) => {
        if (!raw) return { code: '', name: '' }
        const txt = String(raw)
        // Support formats: "CODE - Name" or "Name - CODE"
        if (txt.includes('-')) {
          const [a, b] = txt.split('-').map(s => s.trim())
          // guess which side is code (shorter, no spaces)
          const aIsCode = a && a.length <= 16 && !/\s/.test(a)
          return aIsCode ? { code: a, name: b || '' } : { code: b || '', name: a }
        }
        return { code: txt, name: txt }
      }

      const findProject = (val) => {
        const { code, name } = parseProjectRef(val)
        const nCode = normSimple(code)
        const nName = norm(name)
        return projects.find(p => (
          normSimple(p.code) === nCode ||
          norm(p.name) === nName
        ))
      }

      const parseUserRef = (raw) => {
        if (!raw) return { name: '', email: '' }
        const txt = String(raw)
        const m = txt.match(/^(.*?)(?:\(([^)]+)\))?$/)
        const name = m?.[1]?.trim() || txt
        const email = m?.[2]?.trim() || ''
        return { name, email }
      }

      const findUser = (val) => {
        const { name, email } = parseUserRef(val)
        const nName = norm(name)
        const nEmail = norm(email)
        return users.find(u => (
          (email && norm(u.email) === nEmail) ||
          (name && norm(u.full_name) === nName)
        ))
      }

      const parseExcelDate = (val) => {
        if (!val) return null
        if (val instanceof Date) return val.toISOString().slice(0,10)
        if (typeof val === 'number') {
          try {
            const d = ExcelService.excelDateToJSDate(val)
            return isNaN(d.getTime()) ? null : d.toISOString().slice(0,10)
          } catch { return null }
        }
        // Try Date.parse on string
        const d = new Date(val)
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0,10)
      }

      const vnStatusMap = {
        'dang thuc hien': 'in_progress',
        'dang xu ly': 'in_progress',
        'hoan thanh': 'completed',
        'da hoan thanh': 'completed',
        // Không lưu 'overdue' vào DB; dùng in_progress để hệ thống tự tính trễ hạn theo ngày
        'tre han': 'in_progress',
        'sap den han': 'in_progress',
      }
      
      // Default fallbacks when columns are missing
      const defaultProjectId = (projects.find(p => canCreateTask(p.id)) || {}).id || null
      const defaultAssigneeId = profile?.id || null

      for (const row of data) {
        try {
          // Map Excel columns to task fields
          const taskData = {
            title: (row['Tên công việc'] || row['title'] || '').toString().trim(),
            description: row['Mô tả'] || row['description'] || '',
            project_id: null,
            assigned_to: null,
            priority: 'medium',
            status: 'pending',
            task_type: 'one_time',
            start_date: parseExcelDate(row['Ngày bắt đầu'] || row['start_date'] || null),
            due_date: parseExcelDate(row['Hạn hoàn thành'] || row['due_date'] || null)
          }

          // DB requires start_date/due_date NOT NULL -> set safe defaults
          if (!taskData.start_date) {
            taskData.start_date = new Date().toISOString().slice(0,10)
          }
          if (!taskData.due_date) {
            taskData.due_date = taskData.start_date
          }
          // Ensure due_date >= start_date
          try {
            const s = new Date(taskData.start_date)
            const d = new Date(taskData.due_date)
            if (d < s) taskData.due_date = taskData.start_date
          } catch {}

          // Status mapping (accept vi text)
          const rawStatus = row['Trạng thái'] || row['status']
          if (rawStatus) {
            const ns = norm(rawStatus)
            taskData.status = vnStatusMap[ns] || (['pending','in_progress','completed'].includes(ns) ? ns : 'pending')
          }
          
          // Find project by name
          const projectRef = row['Dự án'] || row['project']
          if (projectRef) {
            const project = findProject(projectRef)
            if (project) taskData.project_id = project.id
          }
          if (!taskData.project_id) taskData.project_id = defaultProjectId
          
          // Find user by name
          const userRef = row['Người thực hiện'] || row['assigned_to']
          if (userRef) {
            const user = findUser(userRef)
            if (user) taskData.assigned_to = user.id
          }
          if (!taskData.assigned_to) taskData.assigned_to = defaultAssigneeId
          
          if (!taskData.title || !taskData.project_id) {
            errorCount++
            rowErrors.push({ row, reason: !taskData.title ? 'Thiếu Tên công việc' : 'Không tìm thấy Dự án khớp (theo mã hoặc tên)' })
            continue
          }
          
          const created = await tasksApi.create(taskData)
          // Áp dụng lịch nhắc việc tự động cho người được giao
          try {
            if (created?.id) {
              const assigneeId = created.assigned_to?.id || created.assigned_to || taskData.assigned_to
              const allUserIds = assigneeId ? [assigneeId] : []
              await createTaskRemindersForUsersSameSchedule(created, allUserIds)
            }
          } catch (e) {
            console.warn('Auto reminders after import failed:', e)
          }
          successCount++
        } catch (error) {
          console.error('Error importing row:', error)
          errorCount++
          rowErrors.push({ row, reason: error?.message || error?.details || error?.hint || 'Lỗi không xác định' })
        }
      }
      
      if (successCount) {
        toast.success(`Import thành công ${successCount} công việc${errorCount > 0 ? `, ${errorCount} lỗi` : ''}`)
      } else {
        const topReasons = Array.from(new Set(rowErrors.map(e => e.reason))).slice(0,2).join('; ')
        toast.error(`Không import được công việc nào${errorCount ? `, ${errorCount} lỗi` : ''}${topReasons ? ` — ${topReasons}` : ''}`)
      }
      if (rowErrors.length) {
        console.warn('Chi tiết lỗi import:', rowErrors)
      }
      loadData()
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Lỗi khi import: ' + error.message)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      project_id: '',
      assigned_to: '',
      priority: 'medium',
      start_date: '',
      due_date: '',
      self_assessment_percent: 0,
      task_type: 'one_time',
      recurrence_frequency: 'weekly',
      recurrence_interval: 1,
      recurrence_end_date: ''
    })
    setAdditionalAssignees([])
    setEditingTask(null)
  }

  const resetProposalForm = () => {
    setProposalFormData({
      title: '',
      description: '',
      project_id: '',
      proposed_assignee: '',
      priority: 'medium',
      start_date: '',
      due_date: '',
      notes: ''
    })
  }

  const handleCloseModal = () => {
    setShowModal(false)
    resetForm()
  }

  // Filter tasks with permission check
  const filteredTasks = tasks.filter(task => {
    // First: Check if user can view this project
    if (!canViewProject(task.project_id)) {
      return false
    }

    // Then apply normal filters
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase())
    // Apply status filter with day-based logic for dynamic buckets
    let matchesStatus = true
    if (statusFilter !== 'all') {
      const isCompleted = task.is_completed || task.status === 'completed'
      const daysRemaining = getDaysRemaining(task.due_date, isCompleted)
      if (statusFilter === 'completed') {
        matchesStatus = isCompleted
      } else if (statusFilter === 'overdue') {
        matchesStatus = daysRemaining !== null && daysRemaining < 0
      } else if (statusFilter === 'nearly_due') {
        matchesStatus = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 2
      } else if (statusFilter === 'in_progress') {
        // Active tasks with more than 2 days remaining
        matchesStatus = daysRemaining !== null && daysRemaining > 2
      } else {
        // Fallback to direct status match for any other filters
        matchesStatus = task.status === statusFilter
      }
    }
    const matchesProject = projectFilter === 'all' || task.project_id === projectFilter
    
  return matchesSearch && matchesStatus && matchesProject
  })

  // Advanced pagination state for Tasks
  const [taskPage, setTaskPage] = useState(1)
  const [taskPageSize, setTaskPageSize] = useState(25)

  // Reset to first page when filters change
  useEffect(() => { setTaskPage(1) }, [searchTerm, statusFilter, projectFilter])

  const totalTaskCount = filteredTasks.length
  const taskStart = (taskPage - 1) * taskPageSize
  const taskEnd = Math.min(taskStart + taskPageSize, totalTaskCount)
  const displayedTasks = filteredTasks.slice(taskStart, taskEnd)

  // Filter projects that user can access
  const accessibleProjects = projects.filter(project => canViewProject(project.id))

  // Get task status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />
      case 'overdue':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
      case 'nearly_due':
        return <ClockIcon className="w-5 h-5 text-yellow-500" />
      default:
        return <ClockIcon className="w-5 h-5 text-blue-500" />
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  // Check if user has access to any project
  const hasAccessToAnyProject = accessibleProjects.length > 0

  // Calculate statistics for dashboard
  const stats = {
    total: filteredTasks.length,
    completed: filteredTasks.filter(t => t.status === 'completed' || t.is_completed).length,
    inProgress: filteredTasks.filter(t => {
      const daysRemaining = getDaysRemaining(t.due_date, t.is_completed || t.status === 'completed')
      return daysRemaining !== null && daysRemaining > 2
    }).length,
    overdue: filteredTasks.filter(t => {
      const daysRemaining = getDaysRemaining(t.due_date, t.is_completed || t.status === 'completed')
      return daysRemaining !== null && daysRemaining < 0
    }).length,
    nearlyDue: filteredTasks.filter(t => {
      const daysRemaining = getDaysRemaining(t.due_date, t.is_completed || t.status === 'completed')
      return daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 2
    }).length
  }

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0


  return (
    <div className="flex flex-col gap-4">
      {/* Modern Header with Glassmorphism - Fixed Height */}
      <header className="flex-shrink-0 backdrop-blur-xl bg-white/80 border-b border-gray-200/50 shadow-sm z-40">
        <div className="py-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Title Section */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/30">
                <ClipboardDocumentListIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">
                  Quản lý công việc
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  Theo dõi và quản lý tiến độ công việc
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <ProposalBadge onClick={() => setShowApprovalsModal(true)} />
              {/* ...no demo cleanup buttons... */}
              {/* Reminders quick control */}
              <button
                onClick={async () => {
                  try {
                    if (!hasReminderPrefs) {
                      await ensureDefaultReminderPreferences(profile?.id)
                      setHasReminderPrefs(true)
                      // Offer to backfill for open tasks assigned to me
                      const myOpen = (tasks || []).filter(t => {
                        const assigneeId = t.assigned_to?.id || t.assigned_to
                        const isCompleted = t.is_completed === true || t.status === 'completed' || (t.progress_percent != null && Number(t.progress_percent) >= 100)
                        return assigneeId === profile?.id && !isCompleted
                      }).slice(0, 50)
                      if (myOpen.length) {
                        if (window.confirm(`Đã bật nhắc việc mặc định. Tạo lịch nhắc cho ${myOpen.length} công việc đang mở của bạn?`)) {
                          let ok = 0, fail = 0
                          for (const task of myOpen) {
                            try { await createTaskReminders(task, profile?.id); ok++ } catch (e) { fail++ }
                          }
                          // Sau khi tạo lịch, chạy bộ gửi ngay để hiển thị thông báo tức thì
                          try { await runReminderSchedulerNow() } catch {}
                          const pc = await getMyPendingRemindersCount(profile?.id)
                          setPendingReminderCount(pc)
                          if (fail > 0) {
                            toast.error(`Không thể tạo nhắc việc cho ${fail}/${myOpen.length} công việc. Có thể do RLS không cho phép INSERT. Hãy chạy file enable-user-insert-task-reminders.sql trong Supabase.`)
                          } else if (ok > 0) {
                            toast.success(`Đã tạo nhắc việc cho ${ok} công việc và chạy gửi ngay.`)
                          }
                        }
                      }
                      toast.success('Đã bật nhắc việc với cài đặt mặc định')
                    } else {
                      // If prefs exist, allow manual run of scheduler to see toasts immediately
                      const res = await runReminderSchedulerNow()
                      if (res.ok) {
                        toast.success(`Đã chạy bộ gửi (${res.via === 'edge' ? 'Edge Function' : 'SQL'})`)
                        const pc = await getMyPendingRemindersCount(profile?.id)
                        setPendingReminderCount(pc)
                      } else {
                        toast.error(res.error || 'Không thể chạy bộ gửi')
                      }
                    }
                  } catch (e) {
                    toast.error(String(e?.message || e))
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm whitespace-nowrap ${hasReminderPrefs ? 'bg-yellow-600 text-white hover:bg-yellow-700' : 'bg-white border border-yellow-300 text-yellow-700 hover:bg-yellow-50'}`}
                title={hasReminderPrefs ? 'Chạy bộ gửi nhắc việc' : 'Bật nhắc việc với cài đặt mặc định'}
              >
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-semibold">
                  {checkingReminders ? '…' : (pendingReminderCount > 99 ? '99+' : pendingReminderCount)}
                </span>
                <span>{hasReminderPrefs ? 'Nhắc việc (Chạy ngay)' : 'Bật nhắc việc'}</span>
              </button>
              
              {proposals.filter(p => p.proposed_by.id === profile?.id).length > 0 && (
                <button
                  onClick={() => setShowProposalModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow whitespace-nowrap"
                >
                  <PaperAirplaneIcon className="w-4 h-4 flex-shrink-0" />
                  <span>Đề xuất của tôi</span>
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                    {proposals.filter(p => p.proposed_by.id === profile?.id).length}
                  </span>
                </button>
              )}

              <ExcelImportButton
                onImport={handleImport}
                templateData={[{
                  'Tên công việc': 'Ví dụ: Thiết kế bản vẽ',
                  'Mô tả': 'Mô tả chi tiết công việc',
                  'Dự án': 'Mã hoặc tên dự án',
                  'Người thực hiện': 'Tên hoặc email người thực hiện',
                  'Trạng thái': 'pending/in_progress/completed',
                  'Ngày bắt đầu': 'YYYY-MM-DD',
                  'Hạn hoàn thành': 'YYYY-MM-DD'
                }]}
                templateName="MauImportCongViec"
              >
                <DocumentArrowUpIcon className="w-4 h-4" />
                Import
              </ExcelImportButton>

              <ExcelExportButton
                data={handleExport()}
                filename="DanhSachCongViec"
                disabled={filteredTasks.length === 0}
              >
                <DocumentArrowDownIcon className="w-4 h-4" />
                Export
              </ExcelExportButton>

              {/* Button: Cài đặt nhắc việc (chỉ hiển thị cho Quản lý) */}
              {profile?.role === 'manager' && (
                <Link
                  to="/reminder-settings"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-300 rounded-xl text-sm font-medium text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow whitespace-nowrap"
                  title="Cấu hình quy tắc nhắc việc"
                >
                  <Cog6ToothIcon className="w-5 h-5 flex-shrink-0" />
                  <span>Cài đặt nhắc việc</span>
                </Link>
              )}

              {accessibleProjects.some(p => canCreateTask(p.id)) && (
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-sm font-semibold text-white hover:from-cyan-600 hover:to-blue-700 transition-all duration-200 shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40 hover:-translate-y-0.5 whitespace-nowrap"
                >
                  <PlusIcon className="w-5 h-5 flex-shrink-0" />
                  <span>Thêm công việc</span>
                </button>
              )}

              {/* Đã gỡ nút chèn đầu/cuối để gom vào menu thao tác một nút */}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area - Flexible with Scroll */}
      <main className="flex-1">
        <div className="py-4 space-y-4">
          {/* No Access Warning */}
          {!hasAccessToAnyProject && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-yellow-900 mb-0.5">
                  Chưa có quyền truy cập
                </h3>
                <p className="text-sm text-yellow-800">
                  Bạn chưa được phân công vào dự án nào. Vui lòng liên hệ quản lý để được phân quyền.
                </p>
              </div>
            </div>
          </div>
        )}

  {/* Statistics Cards - wrap to fit, no horizontal scroll */}
  <div className="grid grid-autofit-200 gap-3 lg:gap-4">
          {/* Total Tasks Card */}
          <button onClick={()=>handleSummaryClick('all')} className="text-left group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-blue-200 hover:-translate-y-1 focus:outline-none">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 mb-1">Tổng công việc</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Squares2X2Icon className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs text-gray-500">Tất cả tasks</span>
                  </div>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl">
                  <ChartBarIcon className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>
          </button>

          {/* Completed Card */}
          <button onClick={()=>handleSummaryClick('completed')} className="text-left group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-green-200 hover:-translate-y-1 focus:outline-none" title="Xem công việc đã hoàn thành">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 mb-1">Hoàn thành</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <ArrowTrendingUpIcon className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-xs font-semibold text-green-600">{completionRate}%</span>
                  </div>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                  <CheckCircleSolid className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </div>
          </button>

          {/* In Progress Card */}
          <button onClick={()=>handleSummaryClick('in_progress')} className="text-left group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-yellow-200 hover:-translate-y-1 focus:outline-none" title="Xem công việc đang thực hiện">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 mb-1">Đang thực hiện</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <ClockSolid className="w-3.5 h-3.5 text-yellow-500" />
                    <span className="text-xs text-gray-500">Đang xử lý</span>
                  </div>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-xl">
                  <ClockIcon className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
            </div>
          </button>

          {/* Nearly Due Card */}
          <button onClick={()=>handleSummaryClick('nearly_due')} className="text-left group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-orange-200 hover:-translate-y-1 focus:outline-none" title="Xem công việc sắp đến hạn">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 mb-1">Sắp đến hạn</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.nearlyDue}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <CalendarDaysIcon className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-xs text-gray-500">≤ 2 ngày</span>
                  </div>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-orange-100 to-red-100 rounded-xl">
                  <ExclamationTriangleSolid className="w-5 h-5 text-orange-600" />
                </div>
              </div>
            </div>
          </button>

          {/* Overdue Card */}
          <button onClick={()=>handleSummaryClick('overdue')} className="text-left group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-red-200 hover:-translate-y-1 focus:outline-none" title="Xem công việc trễ hạn">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 mb-1">Trễ hạn</p>
                  <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <ArrowTrendingDownIcon className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs font-semibold text-red-600">Cần xử lý</span>
                  </div>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-red-100 to-pink-100 rounded-xl">
                  <FireIcon className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </div>
          </button>
        </div>

  {/* Filters Section - Material Design */}
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
              <FunnelIcon className="w-4 h-4 text-purple-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Bộ lọc & Tìm kiếm</h2>
          </div>

          {/* Filters wrap responsively, no horizontal scroll */}
          <div className="grid gap-3 grid-autofit-200">
            {/* Search Input */}
            <div className="relative group">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-cyan-500 transition-colors" />
              <input
                type="text"
                placeholder="Tìm kiếm công việc..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Project Filter */}
            <div className="relative">
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all appearance-none cursor-pointer"
              >
                <option value="all">📁 Tất cả dự án</option>
                {accessibleProjects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.code} - {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all appearance-none cursor-pointer"
              >
                <option value="all">🔄 Tất cả trạng thái</option>
                
                <option value="in_progress">⚡ Đang thực hiện</option>
                <option value="nearly_due">⚠️ Sắp đến hạn</option>
                <option value="overdue">🔥 Quá hạn</option>
                <option value="completed">✅ Hoàn thành</option>
              </select>
            </div>

            {/* Priority Filter */}
            {/* Priority Filter removed by request */}
          </div>

          {/* Summary and Date Picker */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-1 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-200">
                <span className="text-xs font-semibold text-cyan-700">
                  {filteredTasks.length} công việc
                </span>
              </div>
              {stats.overdue > 0 && (
                <div className="px-2.5 py-1 bg-red-50 rounded-lg border border-red-200">
                  <span className="text-xs font-semibold text-red-600">
                    {stats.overdue} trễ hạn
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Mốc so sánh:</span>
              <button
                onClick={() => setComparisonDate(new Date().toISOString().split('T')[0])}
                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
              >
                Hôm nay
              </button>
              <input
                type="date"
                value={comparisonDate}
                onChange={(e) => setComparisonDate(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Tasks Table */}
  <div ref={tableRef} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible">
          <div>
            <table className="w-full table-fixed divide-y divide-gray-200 border border-gray-200 [&>thead>tr>th]:text-center [&>thead>tr>th]:align-middle [&>tbody>tr>td]:align-middle [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <th scope="col" className="w-[28%] sm:w-[26%] md:w-[24%] lg:w-[22%] px-4 py-2.5 text-left text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Công việc
                  </th>
                  <th scope="col" className="w-[10%] md:w-[8%] px-3 py-2.5 text-left text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">
                    Dự án
                  </th>
                  <th scope="col" className="w-[22%] sm:w-[16%] md:w-[14%] px-3 py-2.5 text-left text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Người thực hiện
                  </th>
                  <th scope="col" className="w-[10%] md:w-[8%] px-3 py-2.5 text-left text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">
                    Loại
                  </th>
                  <th scope="col" className="w-[14%] sm:w-[10%] md:w-[8%] px-3 py-2.5 text-left text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Ngày bắt đầu
                  </th>
                  <th scope="col" className="w-[14%] sm:w-[10%] md:w-[8%] px-3 py-2.5 text-left text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Hạn
                  </th>
                  <th scope="col" className="w-[20%] sm:w-[18%] md:w-[16%] px-3 py-2.5 text-left text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th scope="col" className="w-[12%] sm:w-[10%] md:w-[8%] px-3 py-2.5 text-center text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="p-4 bg-gray-100 rounded-full mb-4">
                          <ClipboardDocumentListIcon className="w-12 h-12 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">Không có công việc nào</p>
                        <p className="text-sm text-gray-400 mt-1">Thử thay đổi bộ lọc hoặc thêm công việc mới</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedTasks.map((task) => {
                    const project = task.project || projects.find(p => p.id === task.project_id)
                        const assignee = task.assigned_to && typeof task.assigned_to === 'object' 
                      ? task.assigned_to 
                      : users.find(u => u.id === task.assigned_to)
                    const extraCount = assigneeCounts?.[task.id] || 0
                    const statusInfo = getStatusInfo(task)
                    const canToggleComplete = canEditTask(task)
                    const progressPercent = calculateProgressPercent(task.start_date, task.due_date)
                    
                    return (
                      <tr 
                        key={`${task.id}-${task.status}-${task.self_assessment_percent}`} 
                        className="hover:bg-gradient-to-r hover:from-cyan-50/30 hover:to-blue-50/30 transition-colors duration-150 group"
                      >
                        {/* Task Title */}
                        <td className="px-4 py-2 align-top text-left">
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 mt-0.5">
                              {getStatusIcon(task.status)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900 group-hover:text-cyan-600 transition-colors leading-tight break-words whitespace-pre-wrap">
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="text-[11px] text-gray-500 mt-0.5 leading-tight hidden md:block break-words whitespace-pre-wrap">
                                  {task.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Project */}
                        <td className="px-3 py-2 hidden sm:table-cell">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border border-purple-200 truncate w-full justify-center">
                            {project?.code || 'N/A'}
                          </span>
                        </td>

                        {/* Assignee */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            {/* Main assignee */}
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0">
                              {assignee?.full_name?.charAt(0) || '?'}
                            </div>
                            <span className="text-xs font-medium text-gray-900 truncate max-w-[10ch] sm:max-w-[16ch] md:max-w-[20ch]">
                              {assignee?.full_name || 'Chưa phân công'}
                            </span>
                            {/* Co-assignees avatars */}
                            {Array.isArray(task.additional_assignees) && task.additional_assignees.length > 0 && (
                              <div className="flex items-center -space-x-2 ml-1">
                                {task.additional_assignees.slice(0, 3).map((u, idx) => (
                                  <div
                                    key={`${u.id}-${idx}`}
                                    title={u.full_name}
                                    className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-white"
                                  >
                                    {u.full_name?.charAt(0) || '?'}

                                  </div>
                                ))}
                                {task.additional_assignees.length > 3 && (
                                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex-shrink-0">
                                    +{task.additional_assignees.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Task Type */}
                        <td className="px-3 py-2 hidden md:table-cell">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold truncate w-full justify-center ${
                            task.task_type === 'recurring' 
                              ? 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-200' 
                              : 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border border-orange-200'
                          }`}>
                            {task.task_type === 'recurring' ? '🔄 Định kỳ' : '⚡ Đột xuất'}
                          </span>
                        </td>

                        {/* Start Date */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 text-xs text-gray-900">
                            <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{task.start_date ? formatDate(task.start_date) : '-'}</span>
                          </div>
                        </td>

                        {/* Due Date */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 text-xs text-gray-900">
                            <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{task.due_date ? formatDate(task.due_date) : '-'}</span>
                          </div>
                        </td>

                        {/** Cột Tự đánh giá đã được loại bỏ */}

                        {/* Status & Progress Bar */}
                        <td className="px-3 py-2">
                          <div className={`p-1.5 rounded-xl border-2 transition-all ${statusInfo.bgColor} ${statusInfo.borderColor}`}>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <div className="flex items-center gap-1 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={task.status === 'completed'}
                                  onChange={() => handleToggleComplete(task)}
                                  disabled={!canToggleComplete}
                                  className="w-3 h-3 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
                                  title={canToggleComplete ? "Đánh dấu hoàn thành" : "Không có quyền"}
                                />
                                <div className={`w-1 h-1 ${statusInfo.color} rounded-full animate-pulse flex-shrink-0`}></div>
                                <span className={`text-[10px] sm:text-[11px] font-bold ${statusInfo.textColor} uppercase tracking-tight truncate leading-tight`}>
                                  {statusInfo.label}
                                </span>
                              </div>
                              {statusInfo.daysRemaining !== null && (
                                <span className={`text-[9px] sm:text-[10px] font-extrabold ${statusInfo.textColor} tabular-nums px-1 py-0.5 rounded flex-shrink-0 whitespace-nowrap leading-tight ${
                                  statusInfo.daysRemaining < 0 ? 'bg-red-100' : statusInfo.daysRemaining === 0 ? 'bg-orange-100' : 'bg-yellow-100'
                                }`}>
                                  {statusInfo.daysRemaining === 0 
                                    ? 'NAY' 
                                    : statusInfo.daysRemaining < 0 
                                      ? `TRỄ ${Math.abs(statusInfo.daysRemaining)}` 
                                      : `${statusInfo.daysRemaining}`}
                                </span>
                              )}
                            </div>
                            {statusInfo.daysRemaining !== null && (
                              <div className="bg-white/70 rounded px-1 py-0.5">
                                {renderDaysBar(statusInfo.daysRemaining)}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center">
                            <div className="relative inline-block text-left">
                              <button
                                ref={(el) => { if (el) actionBtnRefs.current[task.id] = el }}
                                onClick={(e) => { e.stopPropagation(); setOpenActionMenuId(prev => prev === task.id ? null : task.id) }}
                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                title="Thao tác"
                              >
                                <EllipsisVerticalIcon className="w-5 h-5" />
                              </button>
                              <PortalDropdown
                                open={openActionMenuId === task.id}
                                onClose={() => setOpenActionMenuId(null)}
                                anchorRef={{ current: actionBtnRefs.current[task.id] }}
                                width={208}
                              >
                                <div className="py-1 text-sm">
                                  <div className="px-3 py-2 text-gray-500 uppercase tracking-wide text-[11px]">Thao tác</div>
                                  <button
                                    onClick={() => { setOpenActionMenuId(null) }}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 inline-flex items-center gap-2"
                                  >
                                    <EyeIcon className="w-4 h-4" /> Xem
                                  </button>
                                  {/* Simplified menu: no insert/move/clipboard actions */}
                                  {canEditTask(task) && (
                                    <>
                                      <div className="my-1 h-px bg-gray-100" />
                                      <button
                                        onClick={() => { setOpenActionMenuId(null); handleEdit(task) }}
                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-blue-700 inline-flex items-center gap-2"
                                      >
                                        <PencilIcon className="w-4 h-4" /> Sửa
                                      </button>
                                    </>
                                  )}
                                  {canDeleteTask(task) && (
                                    <>
                                      <div className="my-1 h-px bg-gray-100" />
                                      <button
                                        onClick={() => { setOpenActionMenuId(null); handleDelete(task) }}
                                        className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-700 inline-flex items-center gap-2"
                                      >
                                        <TrashIcon className="w-4 h-4" /> Xóa
                                      </button>
                                    </>
                                  )}
                                </div>
                              </PortalDropdown>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            <div className="p-3 border-t border-gray-100">
              <Pagination
                total={totalTaskCount}
                page={taskPage}
                pageSize={taskPageSize}
                onChange={({ page, pageSize }) => { setTaskPage(page); setTaskPageSize(pageSize) }}
              />
            </div>
          </div>
        </div>
      </div>
    </main>

      {/* Modal for adding/editing task */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          {/* Modal container widened and made scrollable within viewport */}
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl animate-slideUp flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-6 md:px-8 py-4 md:py-6 flex items-center justify-between sticky top-0 rounded-t-3xl z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <ClipboardDocumentListIcon className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {editingTask ? 'Sửa công việc' : 'Thêm công việc'}
                </h2>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-white" />
              </button>
            </div>
            {/* Scrollable content */}
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto min-h-0">
              <form onSubmit={handleSubmit}>
                {/* Title and Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tên công việc <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                  />
                  <div className="mt-3">
                    <VoiceInput
                      placeholder="🎙️ Nói để nhập tiêu đề"
                      onTranscript={(text) =>
                        setFormData((prev) => ({
                          ...prev,
                          title: appendVoiceDedup(prev.title, text, lastVoiceTitleRef, ' '),
                        }))
                      }
                    />
                  </div>
                </div>
                {/* Description input removed per request; provide selective OCR for title instead */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nhận dạng tiêu đề từ ảnh/PDF (vùng chọn)
                  </label>
                  <SelectiveOCRInput
                    onTextExtracted={(text) =>
                      setFormData((prev) => ({
                        ...prev,
                        title: (text || '').replace(/\s+/g, ' ').trim().slice(0, 150),
                      }))
                    }
                    helpText="Kéo chọn vùng có tiêu đề trên ảnh/PDF rồi bấm Nhận dạng. Kết quả sẽ điền vào ô Tiêu đề."
                  />
                </div>

                {/* Project and Assignee */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Dự án <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.project_id}
                      onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                    >
                      <option value="">Chọn dự án</option>
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.code} - {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Người thực hiện <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.assigned_to}
                      onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                    >
                      <option value="">Chọn người thực hiện</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.full_name} ({user.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Co-assignees (Người cùng thực hiện) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    Người cùng thực hiện
                    <span className="group relative inline-flex items-center">
                      <InformationCircleIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                      <span className="absolute -top-10 right-0 whitespace-nowrap bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition pointer-events-none shadow">
                        Những người này sẽ nhận nhắc việc và có thể cập nhật tiến độ.
                      </span>
                    </span>
                  </label>
                  {(() => {
                    const allowedUsers = users.filter(u => u.id !== formData.assigned_to && canAssignUser(formData.project_id, u.id))
                    const options = allowedUsers.map(u => ({ value: u.id, label: `${u.full_name} (${u.email})` }))
                    return (
                      <MultiSelectChips
                        options={options}
                        value={additionalAssignees}
                        onChange={setAdditionalAssignees}
                        disabled={!formData.project_id}
                        placeholder={formData.project_id ? 'Chọn người cùng thực hiện...' : 'Chọn dự án trước'}
                      />
                    )
                  })()}
                  <p className="text-xs text-gray-500 mt-1">Bạn có thể chọn nhiều người cùng thực hiện.</p>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Ngày bắt đầu
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Hạn hoàn thành
                    </label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                    />
                  </div>
                </div>
                {/* Priority field removed as per request — default still applied in formData */}

                {/* Recurrence settings (hidden by default) */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Loại công việc
                      </label>
                      <select
                        value={formData.task_type}
                        onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                      >
                        <option value="one_time">⚡ Đột xuất (Một lần)</option>
                        <option value="recurring">🔄 Định kỳ</option>
                      </select>
                    </div>
                    {formData.task_type === 'recurring' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Tần suất
                        </label>
                        <select
                          value={formData.recurrence_frequency}
                          onChange={(e) => setFormData({ ...formData, recurrence_frequency: e.target.value })}
                          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                        >
                          <option value="daily">Hàng ngày</option>
                          <option value="weekly">Hàng tuần</option>
                          <option value="monthly">Hàng tháng</option>
                          <option value="quarterly">Hàng quý</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {formData.task_type === 'recurring' && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Khoảng cách
                          </label>
                          <input
                            type="number"
                            value={formData.recurrence_interval}
                            onChange={(e) => setFormData({ ...formData, recurrence_interval: e.target.value })}
                            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                            min="1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Đến ngày
                          </label>
                          <input
                            type="date"
                            value={formData.recurrence_end_date}
                            onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold text-gray-700 transition-all"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-cyan-500/30 hover:shadow-xl"
                  >
                    {editingTask ? 'Cập nhật công việc' : 'Tạo công việc'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal for proposals */}
      {showProposalModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full animate-slideUp">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <PaperAirplaneIcon className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Đề xuất công việc
                </h2>
              </div>
              <button
                onClick={() => setShowProposalModal(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-white" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <form onSubmit={handleProposalSubmit}>
                {/* Title and Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tên công việc <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={proposalFormData.title}
                    onChange={(e) => setProposalFormData({ ...proposalFormData, title: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                  />
                  <div className="mt-3">
                    <VoiceInput
                      placeholder="🎙️ Nói để nhập tiêu đề"
                      onTranscript={(text) =>
                        setProposalFormData((prev) => ({
                          ...prev,
                          title: appendVoiceDedup(prev.title, text, lastVoiceProposalTitleRef, ' '),
                        }))
                      }
                    />
                  </div>
                  <div className="mt-3">
                    <SelectiveOCRInput
                      onTextExtracted={(text) =>
                        setProposalFormData((prev) => ({
                          ...prev,
                          title: (text || '').replace(/\s+/g, ' ').trim().slice(0, 150),
                        }))
                      }
                      helpText="Kéo chọn vùng có tiêu đề trên ảnh/PDF rồi bấm Nhận dạng. Kết quả sẽ điền vào ô Tiêu đề."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Mô tả
                  </label>
                  <textarea
                    value={proposalFormData.description}
                    onChange={(e) => setProposalFormData({ ...proposalFormData, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                    rows="3"
                  ></textarea>
                  {/* Voice helper for proposal description (OCR removed per request to target title) */}
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <VoiceInput
                      placeholder="🎙️ Nói để nhập mô tả"
                      onTranscript={(text) =>
                        setProposalFormData((prev) => ({
                          ...prev,
                          description: appendVoiceDedup(prev.description, text, lastVoiceProposalDescRef, ' '),
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Project and Assignee */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Dự án <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={proposalFormData.project_id}
                      onChange={(e) => setProposalFormData({ ...proposalFormData, project_id: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                    >
                      <option value="">Chọn dự án</option>
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.code} - {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Người được đề xuất <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={proposalFormData.proposed_assignee}
                      onChange={(e) => setProposalFormData({ ...proposalFormData, proposed_assignee: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                    >
                      <option value="">Chọn người thực hiện</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.full_name} ({user.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dates and Priority */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Ngày bắt đầu
                    </label>
                    <input
                      type="date"
                      value={proposalFormData.start_date}
                      onChange={(e) => setProposalFormData({ ...proposalFormData, start_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Độ ưu tiên
                  </label>
                  <select
                    value={proposalFormData.priority}
                    onChange={(e) => setProposalFormData({ ...proposalFormData, priority: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                  >
                    <option value="medium">Trung bình</option>
                    <option value="high">Cao</option>
                    <option value="low">Thấp</option>
                  </select>
                </div>

                </div>

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowProposalModal(false)}
                    className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold text-gray-700 transition-all"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-cyan-500/30 hover:shadow-xl"
                  >
                    Gửi đề xuất
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal for pending approvals */}
      {showApprovalsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full animate-slideUp">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <CheckCircleIcon className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Phê duyệt đề xuất
                </h2>
              </div>
              <button
                onClick={() => setShowApprovalsModal(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-white" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500">
                    Không có đề xuất nào đang chờ phê duyệt.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingApprovals.map(proposal => {
                    const task = tasks.find(t => t.id === proposal.task_id)
                    const assignee = users.find(u => u.id === proposal.proposed_assignee)
                    
                    return (
                      <div key={proposal.id} className="p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                              {assignee?.full_name?.charAt(0) || '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {task?.title}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                Đề xuất bởi {proposal.proposed_by.full_name}
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <span className="text-xs font-semibold text-gray-700 bg-gray-100 rounded-full px-3 py-1">
                              {proposal.status === 'pending' ? 'Đang chờ' : 'Đã phê duyệt'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveProposal(proposal.id)}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg text-sm font-semibold text-white transition-all shadow-sm"
                          >
                            Phê duyệt
                          </button>
                          <button
                            onClick={() => handleRejectProposal(proposal.id)}
                            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-semibold text-white transition-all shadow-sm"
                          >
                            Từ chối
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal for Completion Report */}
      {completionReportState.showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full animate-slideUp">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <DocumentArrowUpIcon className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Nộp Báo cáo Hoàn thành</h2>
              </div>
              <button
                onClick={() => setCompletionReportState({ task: null, file: null, showModal: false })}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-white" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-sm text-gray-700">
                Công việc định kỳ <span className="font-bold">"{completionReportState.task?.title}"</span> yêu cầu nộp file báo cáo PDF khi hoàn thành.
              </p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tải lên file PDF báo cáo <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setCompletionReportState(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setCompletionReportState({ task: null, file: null, showModal: false })}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold text-gray-700 transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleCompletionReportSubmit}
                  disabled={!completionReportState.file}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-green-500/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckIcon className="w-5 h-5 inline-block mr-2" />
                  Xác nhận Hoàn thành
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TasksPage
