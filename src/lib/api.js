import supabaseLib from '../lib/supabase'

const { supabase } = supabaseLib
import { createClient } from '@supabase/supabase-js'

// Ephemeral in-memory storage to avoid touching global session when creating users
class MemoryStorage {
  constructor() { this.store = new Map() }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null }
  setItem(key, value) { this.store.set(key, String(value)) }
  removeItem(key) { this.store.delete(key) }
}

const getEphemeralClient = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Thiếu cấu hình Supabase URL hoặc ANON KEY trong .env')
  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: new MemoryStorage(),
    },
    global: { headers: { 'x-client-info': 'qlda-web-app-ephemeral' } },
  })
}

// Projects API
const projectsApi = {
  // Get all projects (optimized - only basic info)
  getAll: async () => {
    const { data, error } = await supabase.rpc('list_projects_basic')
    if (error) throw error
    return data || []
  },

  // Get all projects with full details (stats, counts, durations)
  getAllFull: async () => {
    const { data, error } = await supabase.rpc('list_projects_full')
    if (error) throw error
    return data || []
  },

  // Multi-assignees helpers
  // Get all additional assignees (profiles) for a task
  getAssignees: async (taskId) => {
    const { data, error } = await supabase
      .from('task_assignees')
      .select(`
        id,
        user:profiles(id, full_name, email)
      `)
      .eq('task_id', taskId)
    if (error) throw error
    // Return array of user objects
    return (data || []).map(r => r.user).filter(Boolean)
  },

  // Get counts of additional assignees for a list of tasks
  getAssigneeCounts: async (taskIds = []) => {
    if (!taskIds.length) return {}
    const { data, error } = await supabase
      .from('task_assignees')
      .select('task_id')
      .in('task_id', taskIds)
    if (error) throw error
    const counts = {}
    for (const row of data || []) {
      counts[row.task_id] = (counts[row.task_id] || 0) + 1
    }
    return counts
  },

  // Set additional assignees for a task (overwrite to exactly match userIds)
  setAssignees: async (taskId, userIds = []) => {
    // Normalize unique and remove falsy ids
    const desired = Array.from(new Set((userIds || []).filter(Boolean)))
    // Read current set
    const { data: cur, error: errCur } = await supabase
      .from('task_assignees')
      .select('user_id')
      .eq('task_id', taskId)
    if (errCur) throw errCur
    const current = new Set((cur || []).map(r => r.user_id))
    // Compute ops
    const toInsert = desired.filter(id => !current.has(id))
    const toDelete = [...current].filter(id => !desired.includes(id))

    if (toInsert.length) {
      const rows = toInsert.map(id => ({ task_id: taskId, user_id: id }))
      const { error: insErr } = await supabase
        .from('task_assignees')
        .insert(rows, { upsert: true })
      if (insErr) throw insErr
    }
    if (toDelete.length) {
      const { error: delErr } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId)
        .in('user_id', toDelete)
      if (delErr) throw delErr
    }
    return { inserted: toInsert.length, deleted: toDelete.length }
  },

  // Get project by ID
  getById: async (id) => {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        manager:profiles!projects_manager_id_fkey(id, full_name, email),
        company:companies(id, name, logo_url),
        project_members(
          id,
          role_in_project,
          position_in_project,
          system_role_in_project,
          user:profiles(id, full_name, email, phone, position)
        ),
        tasks(
          id,
          title,
          status,
          priority,
          progress_percent,
          due_date,
          assigned_to:profiles!tasks_assigned_to_fkey(id, full_name)
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // Create new project
  create: async (projectData) => {
    const { data, error } = await supabase
      .from('projects')
      .insert([projectData])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update project
  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Delete project
  delete: async (id) => {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Add member to project
  addMember: async (projectId, userId, roleInProject, positionInProject = null, systemRoleInProject = 'user') => {
    const { data, error } = await supabase
      .from('project_members')
      .insert([{
        project_id: projectId,
        user_id: userId,
        role_in_project: roleInProject,
        position_in_project: positionInProject,
        system_role_in_project: systemRoleInProject
      }])
      .select()
      .maybeSingle() // tránh 406 khi 0 rows (do RLS/no permission)

    if (error) throw error
    if (!data) throw new Error('NO_PERMISSION_OR_NOT_FOUND')
    return data
  },

  // Update member role in project
  updateMemberRole: async (projectId, userId, roleInProject, positionInProject = null, systemRoleInProject = 'user') => {
    const { data, error } = await supabase
      .from('project_members')
      .update({
        role_in_project: roleInProject,
        position_in_project: positionInProject,
        system_role_in_project: systemRoleInProject
      })
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .select()
      .maybeSingle() // tránh 406 khi 0 rows (do không match hoặc RLS)

    if (error) throw error
    if (!data) throw new Error('NO_PERMISSION_OR_NOT_FOUND')
    return data
  },

  // Remove member from project
  removeMember: async (projectId, userId) => {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)

    if (error) throw error
  },

  // Remove all memberships for a user (when promoted to global manager)
  removeAllMembershipsForUser: async (userId) => {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('user_id', userId)
    if (error) throw error
  },
}

// Tasks API
const tasksApi = {
  // Get all tasks (with permissions)
  getAll: async () => {
    const { data, error } = await supabase.rpc('list_tasks_overview')
    if (error) throw error
    // Map RPC shape to previous shape (assigned_to_user -> assigned_to, etc.)
    const tasks = (data || []).map(t => ({
      ...t,
      assigned_to: t.assigned_to_user || null,
      assigned_by: t.assigned_by_user || null,
      project: t.project || null,
      additional_assignees: Array.isArray(t.additional_assignees) ? t.additional_assignees : []
    }))
    return tasks
  },

  // Get all tasks for a project
  getByProject: async (projectId) => {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assigned_to:profiles!tasks_assigned_to_fkey(id, full_name, email),
        assigned_by:profiles!tasks_assigned_by_fkey(id, full_name, email),
        project:projects(id, name, code),
        task_comments(
          id,
          comment,
          created_at,
          user:profiles(id, full_name)
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Get tasks assigned to user
  getAssignedToUser: async (userId) => {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        project:projects(id, name, code),
        assigned_by:profiles!tasks_assigned_by_fkey(full_name)
      `)
      .eq('assigned_to', userId)
      .order('due_date', { ascending: true })

    if (error) throw error
    return data
  },

  // Create new task
  create: async (taskData) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert([taskData])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update task
  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Complete task
  complete: async (id) => {
    const { data, error } = await supabase
      .from('tasks')
      .update({ 
        is_completed: true,
        status: 'completed',
        progress_percent: 100,
        completed_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Delete task
  delete: async (id) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Count PDF reports attached to a task
  getPdfReportCount: async (taskId) => {
    const { count, error } = await supabase
      .from('task_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('task_id', taskId)
      .eq('file_type', 'application/pdf')
    if (error) throw error
    return count || 0
  },

  // Upload a PDF report to Supabase Storage and record in DB
  uploadPdfReport: async (taskId, file) => {
    if (!file) throw new Error('Chưa chọn file báo cáo (PDF)')
    if (file.type !== 'application/pdf') throw new Error('Vui lòng chọn file PDF')

    const userRes = await supabase.auth.getUser()
    const userId = userRes?.data?.user?.id

    const bucket = 'task-reports'
    // Sanitize filename to avoid Storage "Invalid key" errors
    const sanitize = (name) => String(name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
    const safeName = sanitize(file.name)
    const filePath = `${taskId}/${Date.now()}-${safeName}`

    // Upload to storage bucket
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        contentType: 'application/pdf',
        upsert: false
      })
    if (upErr) throw upErr

    // Build a public URL or keep the storage path
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath)
    const fileUrl = pub?.publicUrl || `${bucket}/${filePath}`

    // Insert DB record
    const { data, error } = await supabase
      .from('task_attachments')
      .insert([{
        task_id: taskId,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        file_type: 'application/pdf',
        uploaded_by: userId
      }])
      .select()
      .single()
    if (error) throw error
    return data
  },

  // List PDF reports for a task (with simple search and sort)
  listTaskReports: async (taskId, { search = '', sort = 'created_desc' } = {}) => {
    let query = supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', taskId)
      .eq('file_type', 'application/pdf')

    if (sort === 'created_asc') query = query.order('created_at', { ascending: true })
    else query = query.order('created_at', { ascending: false })

    if (search && String(search).trim()) {
      query = query.ilike('file_name', `%${search}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  // Delete a task PDF report (soft-delete: keep file in storage for undo)
  deleteTaskReport: async (attachment) => {
    // IMPORTANT: do not remove the physical file immediately to allow restore
    // We keep the object in Storage so that if a manager restores the attachment via History, the link remains valid.
    // Optionally implement archiving to a separate prefix/bucket.

    const { error } = await supabase
      .from('task_attachments')
      .delete()
      .eq('id', attachment.id)
    if (error) throw error
  },

  // Cross-project search/list for task PDF reports (for Dashboard)
  // opts: { projectId?: string, search?: string, fromDate?: string, toDate?: string, sort?: 'created_desc'|'created_asc', limit?: number }
  searchAllReports: async (opts = {}) => {
    const { projectId, search = '', fromDate, toDate, sort = 'created_desc', limit = 100 } = opts || {}

    let query = supabase
      .from('task_attachments')
      .select(`
        *,
        task:tasks(
          id,
          title,
          project_id,
          project:projects(id, name, code)
        )
      `)
      .eq('file_type', 'application/pdf')

    // Date range based on created_at of the report attachment
    if (fromDate) {
      query = query.gte('created_at', fromDate)
    }
    if (toDate) {
      // include the entire day by appending 23:59:59 if only date provided
      const to = /T/.test(toDate) ? toDate : `${toDate}T23:59:59`
      query = query.lte('created_at', to)
    }

    // Sorting
    if (sort === 'created_asc') {
      query = query.order('created_at', { ascending: true })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    if (limit && Number.isFinite(limit)) {
      query = query.limit(limit)
    }

    // Server-side search by file_name; will add client-side fallbacks
    if (search && String(search).trim()) {
      query = query.ilike('file_name', `%${search}%`)
    }

    const { data, error } = await query
    if (error) throw error

    let rows = data || []

    // Client-side filter by project (via joined task.project_id)
    if (projectId) {
      rows = rows.filter(r => r.task?.project_id === projectId)
    }

    // Client-side search fallbacks: task title, project name/code
    if (search && String(search).trim()) {
      const s = String(search).toLowerCase()
      rows = rows.filter(r =>
        r.file_name?.toLowerCase().includes(s) ||
        r.task?.title?.toLowerCase().includes(s) ||
        r.task?.project?.name?.toLowerCase().includes(s) ||
        r.task?.project?.code?.toLowerCase().includes(s)
      )
    }

    return rows
  },

  // Add comment to task
  addComment: async (taskId, comment) => {
    const { data, error } = await supabase
      .from('task_comments')
      .insert([{
        task_id: taskId,
        comment: comment,
        user_id: (await supabase.auth.getUser()).data.user.id
      }])
      .select(`
        *,
        user:profiles(id, full_name)
      `)
      .single()

    if (error) throw error
    return data
  },

  // Insert N new placeholder tasks at a specific position within a project's ordering
  insertAtPosition: async (projectId, position = 0, count = 1, template = {}) => {
    if (!projectId) throw new Error('projectId is required')
    const n = Math.max(1, Number(count) || 1)
    // 1) Shift existing rows down
    try { await supabase.rpc('shift_task_order', { p_project_id: projectId, p_from: position, p_count: n }) } catch (e) { console.warn('shift_task_order failed:', e) }

    // 2) Build placeholder tasks
    const today = new Date().toISOString().slice(0,10)
    let currentUserId = null
    try { currentUserId = (await supabase.auth.getUser()).data.user?.id || null } catch {}

    const rows = Array.from({ length: n }, (_, i) => ({
      title: template.title || '(Mục mới)',
      description: template.description || '',
      project_id: projectId,
      assigned_to: template.assigned_to || currentUserId,
      assigned_by: currentUserId,
      priority: template.priority || 'medium',
      start_date: template.start_date || today,
      due_date: template.due_date || today,
      status: template.status || 'pending',
      task_type: template.task_type || 'one_time',
      order_index: position + i
    }))

    const { data, error } = await supabase
      .from('tasks')
      .insert(rows)
      .select('*')
    if (error) throw error
    return data || []
  },

  // Move a task to a new position within its project (0-based)
  moveToPosition: async (projectId, itemId, toIndex) => {
    if (!projectId || !itemId || toIndex == null) throw new Error('projectId, itemId, toIndex are required')
    const { error } = await supabase.rpc('move_task_order', { p_project_id: projectId, p_item_id: itemId, p_to: toIndex })
    if (error) throw error
    return true
  },

  // Duplicate a task at a specific position (shifts others)
  duplicateAtPosition: async (projectId, sourceTask, position) => {
    if (!projectId || !sourceTask) throw new Error('projectId and sourceTask are required')
    try { await supabase.rpc('shift_task_order', { p_project_id: projectId, p_from: position, p_count: 1 }) } catch (e) { console.warn('shift_task_order failed:', e) }
    const today = new Date().toISOString().slice(0,10)
    let currentUserId = null
    try { currentUserId = (await supabase.auth.getUser()).data.user?.id || null } catch {}
    const row = {
      title: sourceTask.title || '(Bản sao)',
      description: sourceTask.description || '',
      project_id: projectId,
      assigned_to: sourceTask.assigned_to?.id || sourceTask.assigned_to || currentUserId,
      assigned_by: currentUserId,
      priority: sourceTask.priority || 'medium',
      start_date: sourceTask.start_date || today,
      due_date: sourceTask.due_date || today,
      status: sourceTask.status || 'pending',
      task_type: sourceTask.task_type || 'one_time',
      order_index: position
    }
    const { data, error } = await supabase.from('tasks').insert([row]).select('*').single()
    if (error) throw error
    return data
  },
}

// Progress Items API (independent from tasks)
// Table: progress_items (create via SQL if not exists)
const progressApi = {
  _isNoTableError: (error) => {
    try {
      const code = error?.code || error?.details || ''
      const status = error?.status
      const msg = String(error?.message || error?.hint || '').toLowerCase()
      return status === 404 ||
        /relation .* does not exist/i.test(error?.message || '') ||
        /not exist/i.test(msg) ||
        code === '42P01' || code === 'PGRST116' || code === 'PGRST265' ||
        /schema cache/.test(msg) || /could not find the table/.test(msg)
    } catch { return false }
  },
  // Get all progress items for a project
  getByProject: async (projectId) => {
    // Prefer ordering by order_index then created_at; fallback if column missing
    try {
      const { data, error } = await supabase
        .from('progress_items')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    } catch (error) {
      // If column missing (42703), retry simple ordering
      if ((error?.code === '42703') || /column .*order_index.* does not exist/i.test(error?.message || '')) {
        const { data, error: err2 } = await supabase
          .from('progress_items')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
        if (err2) throw err2
        return data || []
      }
      if (progressApi._isNoTableError(error)) {
        const err = new Error('PROGRESS_TABLE_MISSING')
        err.code = 'PROGRESS_TABLE_MISSING'
        throw err
      }
      throw error
    }
  },

  // Insert N placeholder progress items at a specific position within a project
  insertAtPosition: async (projectId, position = 0, count = 1, template = {}) => {
    if (!projectId) throw new Error('projectId is required')
    const n = Math.max(1, Number(count) || 1)
    try { await supabase.rpc('shift_progress_order', { p_project_id: projectId, p_from: position, p_count: n }) } catch (e) { console.warn('shift_progress_order failed:', e) }

    const today = new Date().toISOString().slice(0,10)
    // Only include base columns to be schema-safe across environments.
    const baseRow = {
      project_id: projectId,
      title: template.title || '(Mục mới)',
      start_date: template.start_date || today,
      due_date: template.due_date || today,
      progress_percent: Number(template.progress_percent || 0)
    }
    const rows = Array.from({ length: n }, (_, i) => ({ ...baseRow, order_index: position + i }))

    const { data, error } = await supabase
      .from('progress_items')
      .insert(rows)
      .select('*')
    if (error) throw error
    return data || []
  },

  // Create a progress item
  create: async (item) => {
    const { data, error } = await supabase
      .from('progress_items')
      .insert([item])
      .select('*')
      .single()
    if (error) throw error
    return data
  },

  // Update a progress item
  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('progress_items')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data
  },

  // Delete a progress item
  delete: async (id) => {
    const { error } = await supabase
      .from('progress_items')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  },

  // Move a progress item to a new position within its project (0-based)
  moveToPosition: async (projectId, itemId, toIndex) => {
    if (!projectId || !itemId || toIndex == null) throw new Error('projectId, itemId, toIndex are required')
    const { error } = await supabase.rpc('move_progress_order', { p_project_id: projectId, p_item_id: itemId, p_to: toIndex })
    if (error) throw error
    return true
  },

  // Duplicate a progress item at a specific position (shifts others)
  duplicateAtPosition: async (projectId, sourceItem, position) => {
    if (!projectId || !sourceItem) throw new Error('projectId and sourceItem are required')
    try { await supabase.rpc('shift_progress_order', { p_project_id: projectId, p_from: position, p_count: 1 }) } catch (e) { console.warn('shift_progress_order failed:', e) }
    const today = new Date().toISOString().slice(0,10)
    const base = {
      project_id: projectId,
      title: sourceItem.title || '(Bản sao)',
      start_date: sourceItem.start_date || today,
      due_date: sourceItem.due_date || today,
      progress_percent: Number(sourceItem.progress_percent || 0),
      order_index: position
    }
    // Include manpower if exists in schema (best-effort from source)
    if (typeof sourceItem.manpower !== 'undefined') {
      base.manpower = Number(sourceItem.manpower)
    }
    // Include area-like key if present on source
    for (const k of ['area', 'khu_vuc', 'zone']) {
      if (Object.prototype.hasOwnProperty.call(sourceItem || {}, k)) {
        base[k] = sourceItem[k]
        break
      }
    }
    const { data, error } = await supabase.from('progress_items').insert([base]).select('*').single()
    if (error) throw error
    return data
  },
}

// Users API
const usersApi = {
  // Get all users
  getAll: async () => {
    // Use RPC to avoid deep join recursion
    const { data, error } = await supabase.rpc('list_staff')
    if (error) throw error
    // RPC returns jsonb array already; ensure [] when null
    return data || []
  },

  // Get minimal name map for a set of user IDs
  getNamesByIds: async (ids = []) => {
    const unique = Array.from(new Set((ids || []).filter(Boolean)))
    if (!unique.length) return {}
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', unique)
    if (error) throw error
    const map = {}
    for (const r of data || []) {
      map[r.id] = r.full_name || r.email || r.id
    }
    return map
  },

  // Get user by ID
  getById: async (id) => {
    const { data, error } = await supabase.rpc('get_staff_by_id_full', { p_user_id: id })
    if (error) throw error
    return data
  },

  // Create new user with auth
  create: async (userData) => {
    try {
      // 0) Preflight: avoid 500 from trigger by checking duplicate email in profiles
      if (userData?.email) {
        const { data: existingProfile, error: checkErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', userData.email.toLowerCase())
          .maybeSingle()

        if (!checkErr && existingProfile) {
          throw new Error('Email này đã được đăng ký trong hệ thống')
        }
      }

      // Create auth user using an ephemeral client so current admin session is preserved
      const eph = getEphemeralClient()
      const { data: authData, error: authError } = await eph.auth.signUp({
        email: userData.email,
        password: userData.password || 'TempPassword123!',
        options: {
          data: {
            full_name: userData.full_name,
            phone: userData.phone,
            // Ensure we do not send empty strings which may break trigger casts
            birthday: userData.birthday || null,
            join_date: userData.join_date || new Date().toISOString().split('T')[0],
            is_active: userData.is_active !== undefined ? userData.is_active : true,
            role: userData.role || 'user'
          },
          emailRedirectTo: window.location.origin
        }
      })

      if (authError) {
        console.error('Auth error:', authError)
        // Friendlier mapping for common cases
        const rawMsg = authError?.message || ''
        if (/User already registered/i.test(rawMsg)) {
          throw new Error('Email này đã được đăng ký')
        }
        if (/Database error saving new user/i.test(rawMsg) || authError.status === 500) {
          // Probe again for duplicate email in profiles to offer a clearer hint
          try {
            const { data: dup, error: dupErr } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', (userData.email || '').toLowerCase())
              .maybeSingle()
            if (!dupErr && dup) {
              throw new Error('Email đã tồn tại trong bảng nhân sự. Vui lòng dùng email khác hoặc xóa/hợp nhất hồ sơ cũ.')
            }
          } catch {}
          throw new Error('Lỗi hệ thống khi tạo tài khoản. Vui lòng thử lại hoặc liên hệ quản trị.')
        }
        throw new Error(`Lỗi tạo tài khoản: ${rawMsg}`)
      }

      if (!authData?.user?.id) {
        throw new Error('Không nhận được ID người dùng sau khi tạo tài khoản')
      }

  // Profile will be created automatically by trigger on auth.users insert
  // Wait briefly to allow trigger to run
  await new Promise(resolve => setTimeout(resolve, 1500))

      // Try to fetch the created profile with retry logic
      let profileData = null
      let retries = 3
      
      while (retries > 0 && !profileData) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle()

        if (data) {
          profileData = data
          break
        }

        if (error && retries === 1) {
          console.error('Profile fetch error:', error)
          // If profile doesn't exist, create it manually
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([{
              id: authData.user.id,
              email: userData.email,
              full_name: userData.full_name,
              phone: userData.phone,
              birthday: userData.birthday,
              join_date: userData.join_date || new Date().toISOString().split('T')[0],
              is_active: userData.is_active !== undefined ? userData.is_active : true,
              role: userData.role || 'user'
            }])
            .select()
            .single()

          if (createError) {
            console.error('Manual profile creation error:', createError)
            throw new Error(`Lỗi tạo hồ sơ người dùng: ${createError.message}`)
          }

          profileData = newProfile
          break
        }

        retries--
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      if (!profileData) {
        throw new Error('Không thể tạo hồ sơ người dùng sau nhiều lần thử')
      }

      return profileData
    } catch (error) {
      console.error('Create user error:', error)
      // Provide user-friendly error message
      if (error.message.includes('User already registered')) {
        throw new Error('Email này đã được đăng ký')
      }
      throw new Error(error.message || 'Lỗi khi tạo nhân sự mới')
    }
  },

  // Update user
  update: async (id, updates) => {
    // Prefer RPC to bypass complex RLS and allow project managers
    const payload = {
      p_user_id: id,
      p_full_name: updates.full_name ?? null,
      p_phone: updates.phone ?? null,
      p_is_active: typeof updates.is_active === 'boolean' ? updates.is_active : null,
      p_join_date: updates.join_date ?? null,
      p_birthday: updates.birthday ?? null,
      p_email: updates.email ?? null
    }
    const { data, error } = await supabase.rpc('update_profile_safe', payload)
    if (error) throw error
    if (!data) throw new Error('NO_PERMISSION_OR_NOT_FOUND')
    return data
  },

  // Deactivate user
  deactivate: async (id) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('NO_PERMISSION_OR_NOT_FOUND')
    return data
  },

  // Delete user permanently (hard delete)
  delete: async (id) => {
    try {
      // Step 1: Check if user is managing any projects
      const { data: managedProjects, error: checkError } = await supabase
        .from('projects')
        .select('id, name, code')
        .eq('manager_id', id)

      if (checkError) {
        console.error('Check projects error:', checkError)
      }

      // Step 2: If user is managing projects, set manager_id to NULL
      if (managedProjects && managedProjects.length > 0) {
        console.log(`User is managing ${managedProjects.length} projects. Setting manager_id to NULL...`)
        
        const { error: updateError } = await supabase
          .from('projects')
          .update({ manager_id: null })
          .eq('manager_id', id)

        if (updateError) {
          console.error('Update projects error:', updateError)
          throw new Error(`Không thể cập nhật dự án: ${updateError.message}`)
        }
      }

      // Step 3: Delete from project_members table (if any)
      const { error: memberError } = await supabase
        .from('project_members')
        .delete()
        .eq('user_id', id)

      if (memberError) {
        console.warn('Delete project members warning:', memberError)
        // Continue even if this fails
      }

      // Step 4: Delete from profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id)

      if (profileError) {
        console.error('Profile delete error:', profileError)
        throw new Error(`Lỗi xóa hồ sơ: ${profileError.message}`)
      }

      // Step 5: Delete from auth.users using RPC function
      try {
        const { error: authError } = await supabase.rpc('delete_user', { user_id: id })
        if (authError) {
          console.warn('Auth delete warning:', authError)
          // Continue even if auth delete fails, as profile is already deleted
        }
      } catch (rpcError) {
        console.warn('RPC delete_user not available:', rpcError)
        // This is expected if the RPC function doesn't exist
      }

      return { success: true }
    } catch (error) {
      console.error('Delete user error:', error)
      throw new Error(error.message || 'Lỗi khi xóa người dùng')
    }
  }
}

// Reports API
const reportsApi = {
  // Get dashboard statistics
  getDashboardStats: async () => {
    const { data, error } = await supabase
      .from('task_statistics')
      .select('*')

    if (error) throw error
    return data
  },

  // Get overdue tasks
  getOverdueTasks: async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        project:projects(name, code),
        assigned_to:profiles!tasks_assigned_to_fkey(full_name, email)
      `)
      .eq('status', 'overdue')
      .order('due_date')

    if (error) throw error
    return data
  },

  // Get tasks due soon
  getTasksDueSoon: async (days = 7) => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        project:projects(name, code),
        assigned_to:profiles!tasks_assigned_to_fkey(full_name, email)
      `)
      .gte('due_date', new Date().toISOString().split('T')[0])
      .lte('due_date', futureDate.toISOString().split('T')[0])
      .neq('status', 'completed')
      .order('due_date')

    if (error) throw error
    return data
  },

  // Get birthday reminders
  getBirthdayReminders: async (month) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, birthday')
      .not('birthday', 'is', null)
      .eq('is_active', true)

    if (error) throw error

    // Filter by month on client side since PostgreSQL date functions may vary
    return data.filter(person => {
      if (!person.birthday) return false
      const birthMonth = new Date(person.birthday).getMonth() + 1
      return birthMonth === month
    })
  }
}

// Notifications API
const notificationsApi = {
  // Get user notifications
  getUserNotifications: async (userId) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return data
  },

  // Mark notification as read
  markAsRead: async (id) => {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Mark all notifications as read
  markAllAsRead: async (userId) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error
  },

  // Create notification
  create: async (notificationData) => {
    const { data, error } = await supabase
      .from('notifications')
      .insert([notificationData])
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// Lightweight API for Dashboard/Reports (faster loading with minimal JOINs)
const lightApi = {
  // Get projects summary (no heavy JOINs)
  getProjectsSummary: async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, code, name, status, progress_percent, start_date, end_date, budget')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Get tasks summary (no heavy JOINs)
  getTasksSummary: async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, priority, progress_percent, start_date, due_date, project_id, assigned_to')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Get users summary (minimal data)
  getUsersSummary: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active')
      .eq('is_active', true)

    if (error) throw error
    return data
  }
}

// Task Proposals API
const taskProposalsApi = {
  // Get all proposals (for current user)
  getAll: async () => {
    const { data, error } = await supabase.rpc('list_task_proposals', { p_mode: 'all' })
    if (error) throw error
    return data || []
  },

  // Get proposals by project
  getByProject: async (projectId) => {
    const { data, error } = await supabase.rpc('list_task_proposals', { p_project_id: projectId, p_mode: 'by_project' })
    if (error) throw error
    return data || []
  },

  // Get pending proposals for approval
  getPendingForApproval: async (userId) => {
    // Function derives current user with auth.uid(), so we only need mode
    const { data, error } = await supabase.rpc('list_task_proposals', { p_mode: 'pending_for_approval' })
    if (error) throw error
    return data || []
  },

  // Create new proposal
  create: async (proposalData) => {
    const { data, error } = await supabase
      .from('task_proposals')
      .insert([proposalData])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update proposal
  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('task_proposals')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Approve proposal and create task
  approve: async (proposalId) => {
    // Get proposal details
    const { data: proposal, error: fetchError } = await supabase
      .from('task_proposals')
      .select('*')
      .eq('id', proposalId)
      .single()

    if (fetchError) throw fetchError

    // Create task from proposal
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert([{
        project_id: proposal.project_id,
        title: proposal.title,
        description: proposal.description,
        assigned_to: proposal.proposed_assignee,
        assigned_by: proposal.approver_id,
        start_date: proposal.start_date,
        due_date: proposal.due_date,
        priority: proposal.priority,
        status: 'pending',
        proposal_id: proposalId,
        notes: proposal.notes
      }])
      .select()
      .single()

    if (taskError) throw taskError

    // Update proposal status
    const { error: updateError } = await supabase
      .from('task_proposals')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('id', proposalId)

    if (updateError) throw updateError

    return task
  },

  // Reject proposal
  reject: async (proposalId, reason) => {
    const { data, error } = await supabase
      .from('task_proposals')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason
      })
      .eq('id', proposalId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Delete proposal
  delete: async (id) => {
    const { error } = await supabase
      .from('task_proposals')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Project Documents API (Meeting Minutes and other categories)
const projectDocsApi = {
  // List documents for a project with optional search and sorting
  // opts: { search?: string, category?: string, sort?: 'meeting_desc' | 'meeting_asc' | 'created_desc' | 'created_asc' }
  list: async (projectId, opts = {}) => {
    const { search = '', category, sort = 'meeting_desc' } = opts || {}

    let query = supabase
      .from('project_documents')
      .select('*')
      .eq('project_id', projectId)

    if (category) {
      query = query.eq('category', category)
    }

    // Order by meeting_date (default), fallback to created_at
    if (sort === 'meeting_asc') {
      query = query.order('meeting_date', { ascending: true, nullsFirst: true }).order('created_at', { ascending: true })
    } else if (sort === 'created_asc') {
      query = query.order('created_at', { ascending: true })
    } else if (sort === 'created_desc') {
      query = query.order('created_at', { ascending: false })
    } else {
      // meeting_desc
      query = query.order('meeting_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
    }

    if (search && String(search).trim()) {
      // Simple case-insensitive match on title; further filter client-side by file_name
      query = query.ilike('title', `%${search}%`)
    }

    const { data, error } = await query
    if (error) throw error

    // If additional search by filename is needed, filter client-side as fallback
    if (search && String(search).trim()) {
      const s = String(search).toLowerCase()
      return (data || []).filter(d =>
        d.title?.toLowerCase().includes(s) || d.file_name?.toLowerCase().includes(s)
      )
    }

    return data
  },

  // Update document metadata (title, description, meeting_date, category)
  update: async (id, updates = {}) => {
    const allowed = ['title', 'description', 'meeting_date', 'category']
    const payload = {}
    for (const k of allowed) if (updates[k] !== undefined) payload[k] = updates[k]
    if (Object.keys(payload).length === 0) return null
    const { data, error } = await supabase
      .from('project_documents')
      .update(payload)
      .eq('id', id)
      .select('*')
    // Avoid .single() to prevent 406 (PGRST116) when no rows are updated due to RLS/permissions
    if (error) throw error
    if (!data || data.length === 0) {
      throw new Error('Bạn không có quyền sửa tài liệu này hoặc tài liệu không tồn tại')
    }
    return data[0]
  },

  // Cross-project search/list for documents on Dashboard
  // opts: { projectId?: string, category?: string, search?: string, fromDate?: string, toDate?: string, sort?: 'meeting_desc'|'meeting_asc'|'created_desc'|'created_asc', limit?: number }
  searchAll: async (opts = {}) => {
    const { projectId, category, search = '', fromDate, toDate, sort = 'meeting_desc', limit = 100 } = opts || {}

    let query = supabase
      .from('project_documents')
      .select(`
        *,
        project:projects(id, name, code)
      `)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    if (category) {
      // For 'minutes', we expect DB backfill has set category='minutes' on legacy rows
      query = query.eq('category', category)
    }

    if (fromDate) {
      query = query.gte('meeting_date', fromDate)
    }
    if (toDate) {
      query = query.lte('meeting_date', toDate)
    }

    // Sorting
    if (sort === 'meeting_asc') {
      query = query.order('meeting_date', { ascending: true, nullsFirst: true }).order('created_at', { ascending: true })
    } else if (sort === 'created_asc') {
      query = query.order('created_at', { ascending: true })
    } else if (sort === 'created_desc') {
      query = query.order('created_at', { ascending: false })
    } else {
      // meeting_desc
      query = query.order('meeting_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
    }

    // Apply a reasonable limit for dashboard
    if (limit && Number.isFinite(limit)) {
      query = query.limit(limit)
    }

    // Server-side title search; we'll do filename search client-side
    if (search && String(search).trim()) {
      query = query.ilike('title', `%${search}%`)
    }

    const { data, error } = await query
    if (error) throw error

    if (search && String(search).trim()) {
      const s = String(search).toLowerCase()
      return (data || []).filter(d =>
        d.title?.toLowerCase().includes(s) || d.file_name?.toLowerCase().includes(s) || d.project?.name?.toLowerCase().includes(s) || d.project?.code?.toLowerCase().includes(s)
      )
    }

    return data || []
  },

  // Upload a project document (PDF); returns inserted row
  // opts: { title?: string, meetingDate?: string, description?: string, category?: 'minutes'|'tech'|'incoming'|'outgoing'|'legal' }
  upload: async (projectId, file, { title, meetingDate, description, category } = {}) => {
    if (!file) throw new Error('Vui lòng chọn file (PDF)')

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    // Primary bucket and resilient fallback if missing
    const primaryBucket = 'project-docs'
    const fallbackBucket = 'task-reports'
    const folder = `${projectId}`

    // Sanitize filename to avoid Storage "Invalid key" errors (remove accents/specials)
    const sanitize = (name) => {
      return String(name)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/[^a-zA-Z0-9._-]+/g, '-') // only safe chars
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
    }

    const safeName = sanitize(file.name)
    const path = `${folder}/${Date.now()}-${safeName}`

    let bucketUsed = primaryBucket
    let upErr
    try {
      const res = await supabase.storage
        .from(primaryBucket)
        .upload(path, file, { upsert: false, contentType: file.type || undefined })
      upErr = res.error
      if (upErr) throw upErr
    } catch (e) {
      const msg = String(e?.message || e)
      if (msg.toLowerCase().includes('bucket not found')) {
        // Try fallback bucket gracefully
        const res2 = await supabase.storage
          .from(fallbackBucket)
          .upload(path, file, { upsert: false, contentType: file.type || undefined })
        if (res2.error) {
          // Re-throw original with helpful hint
          throw new Error("Bucket 'project-docs' chưa tồn tại. Vui lòng chạy SQL tạo bucket hoặc tạo trong Supabase Storage. Chi tiết: " + msg)
        }
        bucketUsed = fallbackBucket
      } else {
        throw e
      }
    }

    const { data: pub } = supabase.storage.from(bucketUsed).getPublicUrl(path)
    const fileUrl = pub?.publicUrl || `${bucketUsed}/${path}`

    const payload = {
      project_id: projectId,
      title: title || file.name,
      description: description || null,
      file_url: fileUrl,
      file_name: file.name,
      file_size: file.size || null,
      file_type: file.type || null,
      meeting_date: meetingDate || null,
      uploaded_by: userId,
      category: category || null
    }

    const { data, error } = await supabase
      .from('project_documents')
      .insert([payload])
      .select('*')
      .single()
    if (error) throw error
    return data
  },

  // Delete a document (soft-delete: keep file in storage for undo/redo)
  delete: async (doc) => {
    // IMPORTANT: keep the storage object to allow restoring via History
    // If you must physically delete, implement an archive flow first.
    // Ask for representation but DO NOT call .single().
    // This avoids 406 (PGRST116) while letting us detect 0-row deletes (RLS/no permission).
    const { data, error } = await supabase
      .from('project_documents')
      .delete()
      .eq('id', doc.id)
      .select('id')

    if (error) throw error
    if (!data || data.length === 0) {
      throw new Error('Bạn không có quyền xóa tài liệu này hoặc tài liệu không tồn tại')
    }
    return data[0]
  }
}

// User Activity API (top-level)
const userActivityApi = {
  // Get activity summary for all users (manager/admin only)
  async getSummary() {
    // Use visible scope RPC: managers/admin see all; others see self + shared projects
    const { data, error } = await supabase.rpc('get_user_activity_visible')
    if (error) throw error
    return data || []
  },
  // Record a login event for current user
  async recordLogin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('record_login', { p_user_id: user.id })
    if (error) console.error('recordLogin error', error)
  },
  // Heartbeat to mark user online
  async heartbeat() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('heartbeat', { p_user_id: user.id })
    if (error) console.warn('heartbeat error', error)
  },
}

// History API
const historyApi = {
  // List history entries with optional filters
  list: async ({ projectId = null, entityType = null, entityId = null, limit = 200 } = {}) => {
    let q = supabase.from('entity_history').select('*').order('created_at', { ascending: false })
    if (projectId) q = q.eq('project_id', projectId)
    if (entityType) q = q.eq('entity_type', entityType)
    if (entityId) q = q.eq('entity_id', entityId)
    if (limit) q = q.limit(limit)
    const { data, error } = await q
    if (error) throw error
    return data || []
  },

  // Apply a history entry by id (undo/redo)
  apply: async (historyId, reason = null) => {
    const { data, error } = await supabase.rpc('apply_history_version', { p_history_id: historyId, p_reason: reason })
    if (error) throw error
    return data
  },

  // Restore to a specific version number for an entity
  restoreToVersion: async (entityType, entityId, version, reason = null) => {
    const { data, error } = await supabase.rpc('restore_entity_to_version', {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_version: version,
      p_entity_id: entityId,
      p_version: version,
      p_reason: reason
    })
    if (error) throw error
    return data
  }
}

// Default export to avoid Android WebView named-export bundling issues
export default {
  projectsApi,
  tasksApi,
  usersApi,
  projectMembersApi,
  remindersApi,
  notificationsApi,
  companyApi,
  historyApi
}
