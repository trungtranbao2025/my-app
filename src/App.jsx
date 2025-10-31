import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'
import UpdateChecker from './components/UpdateChecker'
import './App.css'

// Eager load only critical pages (login, layout)
import LoginPage from './pages/LoginPage'

// Lazy load all other pages for faster initial load
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const TasksPage = lazy(() => import('./pages/TasksPage'))
const StaffPage = lazy(() => import('./pages/StaffPage'))
// const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const CompanySettingsPage = lazy(() => import('./pages/CompanySettingsPage'))
const SystemSettingsPage = lazy(() => import('./pages/SystemSettingsPage'))
const TaskReminderSettingsPage = lazy(() => import('./pages/TaskReminderSettingsPage'))
// const ReminderSettingsPage = lazy(() => import('./pages/ReminderSettingsPage'))
const DashboardLayoutDemo = lazy(() => import('./components/DashboardLayoutDemo'))
const ProgressPage = lazy(() => import('./pages/ProgressPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const DrawingsPage = lazy(() => import('./pages/DrawingsPage'))

console.log('📱 App component loaded')

function App() {
  console.log('🎨 App rendering...')
  
  return (
    <div className="App">
      <UpdateChecker />
      <Suspense fallback={<LoadingSpinner message="Đang tải trang..." />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/layout-demo" element={<DashboardLayoutDemo />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="projects/*" element={<ProjectsPage />} />
            <Route path="progress/*" element={<ProgressPage />} />
            <Route path="drawings" element={<DrawingsPage />} />
            <Route path="tasks/*" element={<TasksPage />} />
            <Route path="staff/*" element={<StaffPage />} />
            <Route path="history" element={<HistoryPage />} />
            {/* <Route path="reports" element={<ReportsPage />} /> */}
            <Route path="profile" element={<ProfilePage />} />
            <Route path="company-settings" element={<CompanySettingsPage />} />
            <Route path="system-settings" element={<SystemSettingsPage />} />
            <Route path="reminder-settings" element={<TaskReminderSettingsPage />} />
            {/* Legacy route redirect after removing StatusReminderRules and TaskReminderSettings pages */}
            <Route path="status-reminder-rules" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </div>
  )
}

export default App
