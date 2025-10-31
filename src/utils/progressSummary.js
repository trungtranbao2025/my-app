// Shared utilities to compute progress summary identical across pages
// Contract:
// - Input: array of task-like objects with fields: status, is_completed, progress_percent, due_date
// - Output: { counts: { total, completed, in_progress, nearly_due, overdue }, lists: Record<string, Task[]> }
// - Classification rules:
//   completed: status==='completed' || is_completed===true || progress_percent>=100
//   overdue: not completed and daysRemaining<0
//   nearly_due: not completed and 0<=daysRemaining<=2
//   in_progress: all other non-completed

export function getDaysRemainingSimple(dueDate) {
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

export function classifyTaskStatus(task) {
  const isCompleted = task?.is_completed === true
    || task?.status === 'completed'
    || (task?.progress_percent != null && Number(task.progress_percent) >= 100)
  if (isCompleted) return 'completed'
  const dr = getDaysRemainingSimple(task?.due_date)
  if (dr === null) return 'in_progress'
  if (dr < 0) return 'overdue'
  if (dr <= 2) return 'nearly_due'
  return 'in_progress'
}

export function buildProgressSummary(tasksInput) {
  const tasks = Array.isArray(tasksInput) ? tasksInput : []
  const counts = { total: tasks.length, completed: 0, in_progress: 0, nearly_due: 0, overdue: 0 }
  const lists = { all: [], completed: [], in_progress: [], nearly_due: [], overdue: [] }
  for (const t of tasks) {
    const status = classifyTaskStatus(t)
    lists.all.push(t)
    if (status === 'completed') { counts.completed++; lists.completed.push(t) }
    else if (status === 'overdue') { counts.overdue++; lists.overdue.push(t) }
    else if (status === 'nearly_due') { counts.nearly_due++; lists.nearly_due.push(t) }
    else { counts.in_progress++; lists.in_progress.push(t) }
  }
  return { counts, lists }
}
