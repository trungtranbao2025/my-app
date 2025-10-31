import React, { useMemo, useState } from 'react'
import DrawingsFromPdfWizard from '../components/drawings/DrawingsFromPdfWizard'
import DrawingsList from '../components/drawings/DrawingsList'

/**
 * Trang quản lý Bản vẽ (PDF chung + bản vẽ theo trang)
 * - Bên trái: Wizard tạo bản vẽ từ PDF
 * - Bên phải: Danh sách bản vẽ + tìm kiếm/lọc
 */
export default function DrawingsPage() {
  const { projectId: ctxProjectId } = useProjectContextSafe()
  const urlProjectId = useProjectIdFromUrl()
  const [lastRefreshKey, setLastRefreshKey] = useState(0)

  const handleCreated = () => setLastRefreshKey(k => k+1)

  // Ưu tiên dự án đang chọn trong context; nếu app của bạn dùng router param, thay thế ở đây
  const projectId = ctxProjectId || urlProjectId

  if (!projectId) {
    return <div className="p-6 text-gray-600">Vui lòng chọn dự án trước khi truy cập Bản vẽ.</div>
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">Bản vẽ dự án</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="order-2 lg:order-1">
          <div className="sticky top-4">
            <DrawingsFromPdfWizard projectId={projectId} onCreated={handleCreated} />
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <DrawingsList key={lastRefreshKey} projectId={projectId} />
        </div>
      </div>
    </div>
  )
}

// Hook hứng projectId từ context của app; nếu chưa có thì trả null
function useProjectContextSafe() {
  try {
    // Giả định context có sẵn; nếu app bạn dùng context khác, chỉnh lại hàm này
    const ctx = require('../contexts/ProjectContext')
    const useProject = ctx?.useProject || (()=>({ projectId: null }))
    return useProject()
  } catch {
    return { projectId: null }
  }
}

function useProjectIdFromUrl() {
  try {
    const q = new URLSearchParams(window.location.hash.split('?')[1] || '')
    return q.get('projectId') || null
  } catch { return null }
}
