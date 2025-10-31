import React, { useState } from 'react'
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import ExcelService from '../utils/excelService'
import ExcelExportModal from './ExcelExportModal'

/**
 * ExcelExportButton - Nút export Excel với modal preview
 * @param {Array} data - Dữ liệu cần export
 * @param {String} filename - Tên file mặc định
 * @param {Boolean} disabled - Disable button
 * @param {String} className - Custom CSS classes
 * @param {React.ReactNode} children - Custom button content
 */
const ExcelExportButton = ({ 
  data = [], 
  filename = 'export', 
  disabled = false,
  className = '',
  children
}) => {
  const [showModal, setShowModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Lấy headers từ object đầu tiên
  const headers = data.length > 0 ? Object.keys(data[0]) : []

  const handleOpenModal = () => {
    if (!data || data.length === 0) {
      toast.error('Không có dữ liệu để export')
      return
    }
    setShowModal(true)
  }

  const handleExport = (selectedColumns, fileName) => {
    try {
      setExporting(true)

      const result = ExcelService.exportToExcel(data, fileName, {
        selectedColumns: selectedColumns,
        sheetName: 'Data'
      })

      if (result.success) {
        toast.success('Export Excel thành công!')
        setShowModal(false)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Lỗi export: ' + error.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpenModal}
        disabled={disabled || exporting || !data || data.length === 0}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-sm font-semibold text-white hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${className}`}
      >
        {children || (
          <>
            <DocumentArrowDownIcon className={`w-4 h-4 flex-shrink-0 ${exporting ? 'animate-bounce' : ''}`} />
            <span>{exporting ? 'Đang xuất...' : 'Export Excel'}</span>
          </>
        )}
      </button>

      <ExcelExportModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        data={data}
        headers={headers}
        onExport={handleExport}
        defaultFileName={filename}
      />
    </>
  )
}

export default ExcelExportButton

