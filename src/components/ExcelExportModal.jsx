import React, { useState, useMemo } from 'react'
import {
  XMarkIcon,
  DocumentArrowDownIcon,
  EyeIcon
} from '@heroicons/react/24/outline'

/**
 * ExcelExportModal - Modal chọn cột và preview trước khi export
 */
const ExcelExportModal = ({
  isOpen,
  onClose,
  data,
  headers,
  onExport,
  defaultFileName = 'export',
  title = "Export dữ liệu ra Excel"
}) => {
  // Các cột cần loại bỏ khi export
  const EXCLUDED_HEADERS = useMemo(() => ['Ưu tiên', 'Tiến độ (%)', 'Tự đánh giá (%)'], [])
  const visibleHeaders = useMemo(() => (headers || []).filter(h => !EXCLUDED_HEADERS.includes(h)), [headers, EXCLUDED_HEADERS])
  const [selectedColumns, setSelectedColumns] = useState(new Set(visibleHeaders))
  const [fileName, setFileName] = useState(defaultFileName)
  const [showPreview, setShowPreview] = useState(false)

  // Preview data với các cột đã chọn
  const previewData = useMemo(() => {
    return data.slice(0, 5).map(row => {
      const filtered = {}
      Array.from(selectedColumns).forEach(col => {
        filtered[col] = row[col]
      })
      return filtered
    })
  }, [data, selectedColumns])

  // Handle select all columns
  const handleSelectAllColumns = (checked) => {
    if (checked) {
      setSelectedColumns(new Set(visibleHeaders))
    } else {
      setSelectedColumns(new Set())
    }
  }

  // Handle select column
  const handleSelectColumn = (column, checked) => {
    const newSelected = new Set(selectedColumns)
    if (checked) {
      newSelected.add(column)
    } else {
      newSelected.delete(column)
    }
    setSelectedColumns(newSelected)
  }

  // Handle export
  const handleExport = () => {
    if (selectedColumns.size === 0) {
      return
    }
    onExport(Array.from(selectedColumns), fileName)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {data.length} hàng | Đã chọn: <span className="font-semibold text-green-600">{selectedColumns.size}</span> / {visibleHeaders.length} cột
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* File Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tên file Excel
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Nhập tên file..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-gray-600 font-medium">.xlsx</span>
            </div>
          </div>

          {/* Column Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Chọn cột cần export
              </label>
              <button
                onClick={() => handleSelectAllColumns(selectedColumns.size !== visibleHeaders.length)}
                className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium"
              >
                {selectedColumns.size === visibleHeaders.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
              {visibleHeaders.map((header, index) => (
                <label
                  key={index}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    selectedColumns.has(header)
                      ? 'bg-green-100 border-2 border-green-500'
                      : 'bg-white border-2 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.has(header)}
                    onChange={(e) => handleSelectColumn(header, e.target.checked)}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className={`text-sm font-medium ${
                    selectedColumns.has(header) ? 'text-green-800' : 'text-gray-700'
                  }`}>
                    {header}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Preview Toggle */}
          <div>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              <EyeIcon className="w-5 h-5" />
              {showPreview ? 'Ẩn' : 'Hiện'} preview (5 hàng đầu)
            </button>

            {showPreview && selectedColumns.size > 0 && (
              <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200 [&>thead>tr>th]:text-center [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200 [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100">
                    <thead className="bg-gray-100">
                      <tr>
                        {Array.from(selectedColumns).map((header, index) => (
                          <th
                            key={index}
                            className="px-4 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 last:border-r-0 whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewData.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-50">
                          {Array.from(selectedColumns).map((header, colIndex) => (
                            <td
                              key={colIndex}
                              className="px-4 py-2 text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap max-w-xs truncate"
                              title={String(row[header] || '')}
                            >
                              {String(row[header] || '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 bg-gray-50 text-xs text-gray-600 text-center border-t border-gray-200">
                  Hiển thị 5 hàng đầu tiên / {data.length} hàng
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            <p>💡 <strong>Lưu ý:</strong> Tất cả {data.length} hàng sẽ được export</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Hủy
            </button>
            <button
              onClick={handleExport}
              disabled={selectedColumns.size === 0 || !fileName.trim()}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <DocumentArrowDownIcon className="w-5 h-5" />
              Export Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExcelExportModal
