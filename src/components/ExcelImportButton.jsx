import React, { useState, useRef } from 'react'
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import ExcelService from '../utils/excelService'
import ExcelPreviewModal from './ExcelPreviewModal'

/**
 * ExcelImportButton - Nút import Excel với preview modal
 * @param {Function} onImport - Callback khi import thành công (data, selectedColumns)
 * @param {String} className - Custom CSS classes
 * @param {React.ReactNode} children - Custom button content
 */
const ExcelImportButton = ({ 
  onImport, 
  className = '',
  children
}) => {
  const [importing, setImporting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState([])
  const [headers, setHeaders] = useState([])
  const fileInputRef = useRef(null)

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Vui lòng chọn file Excel (.xlsx hoặc .xls)')
      return
    }

    try {
      setImporting(true)
      toast.loading('Đang đọc file Excel...', { id: 'import-loading' })
      
  const result = await ExcelService.readExcelFile(file)
      
      toast.dismiss('import-loading')
      
      if (result.data.length === 0) {
        toast.error('File Excel không có dữ liệu')
        return
      }
      
      // Show preview
  // Loại bỏ các cột không sử dụng theo yêu cầu
  const EXCLUDED_HEADERS = ['Ưu tiên', 'Tiến độ (%)', 'Tự đánh giá (%)']
  const filteredHeaders = (result.headers || []).filter(h => !EXCLUDED_HEADERS.includes(h))
  setPreviewData(result.data)
  setHeaders(filteredHeaders)
      setShowPreview(true)
      toast.success(`Đọc thành công ${result.data.length} hàng dữ liệu`)
      
    } catch (error) {
      toast.dismiss('import-loading')
      console.error('Import error:', error)
      toast.error('Không thể đọc file Excel: ' + error.message)
    } finally {
      setImporting(false)
      // Reset input để có thể chọn lại file
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleConfirmImport = (selectedData, selectedColumns) => {
    if (onImport) {
      onImport(selectedData, selectedColumns)
      setShowPreview(false)
      setPreviewData([])
      setHeaders([])
    }
  }

  const handleCancel = () => {
    setShowPreview(false)
    setPreviewData([])
    setHeaders([])
  }

  return (
    <>
      <div className={className}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
          id="excel-import-input"
          disabled={importing}
        />
        <label
          htmlFor="excel-import-input"
          className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-sm font-semibold text-white hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 ${
            importing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          {children || (
            <>
              <DocumentArrowUpIcon className={`w-4 h-4 flex-shrink-0 ${importing ? 'animate-bounce' : ''}`} />
              <span>{importing ? 'Đang đọc...' : 'Import Excel'}</span>
            </>
          )}
        </label>
      </div>

      {/* Preview Modal */}
      <ExcelPreviewModal
        isOpen={showPreview}
        onClose={handleCancel}
        data={previewData}
        headers={headers}
        onConfirm={handleConfirmImport}
        title="Preview dữ liệu Excel"
      />
    </>
  )
}

export default ExcelImportButton

