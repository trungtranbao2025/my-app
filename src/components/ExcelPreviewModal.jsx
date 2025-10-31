import React, { useState, useMemo, useEffect } from 'react'
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline'

/**
 * ExcelPreviewModal - Modal preview data Excel trước khi import
 * Cho phép chọn hàng, cột cần import
 */
const ExcelPreviewModal = ({ 
  isOpen, 
  onClose, 
  data, 
  headers, 
  onConfirm,
  title = "Preview dữ liệu Excel"
}) => {
  // Các cột cần loại bỏ khi import
  const EXCLUDED_HEADERS = useMemo(() => ['Ưu tiên', 'Tiến độ (%)', 'Tự đánh giá (%)'], [])
  const visibleHeaders = useMemo(() => (headers || []).filter(h => !EXCLUDED_HEADERS.includes(h)), [headers, EXCLUDED_HEADERS])

  const [selectedRows, setSelectedRows] = useState(new Set())
  const [selectedColumns, setSelectedColumns] = useState(new Set(visibleHeaders))
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  // Auto-select all rows on open for better UX
  useEffect(() => {
    if (isOpen && Array.isArray(data)) {
      setSelectedRows(new Set(data.map((_, idx) => idx)))
    }
  }, [isOpen, data])

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchTerm) return data
    
    return data.filter(row => {
      return Object.values(row).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    })
  }, [data, searchTerm])

  // Pagination
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    const end = start + rowsPerPage
    return filteredData.slice(start, end)
  }, [filteredData, currentPage])

  const totalPages = Math.ceil(filteredData.length / rowsPerPage)

  // Handle select all rows
  const handleSelectAllRows = (checked) => {
    if (checked) {
      setSelectedRows(new Set(data.map((_, index) => index)))
    } else {
      setSelectedRows(new Set())
    }
  }

  // Handle select row
  const handleSelectRow = (index, checked) => {
    const newSelected = new Set(selectedRows)
    if (checked) {
      newSelected.add(index)
    } else {
      newSelected.delete(index)
    }
    setSelectedRows(newSelected)
  }

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

  // Handle confirm
  const handleConfirm = () => {
    const selectedData = data
      .filter((_, index) => selectedRows.has(index))
      .map(row => {
        const filtered = {}
        Array.from(selectedColumns).forEach(col => {
          filtered[col] = row[col]
        })
        return filtered
      })

    onConfirm(selectedData, Array.from(selectedColumns))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {data.length} hàng, {visibleHeaders.length} cột | 
              Đã chọn: <span className="font-semibold text-blue-600">{selectedRows.size}</span> hàng, 
              <span className="font-semibold text-blue-600 ml-1">{selectedColumns.size}</span> cột
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Search and Controls */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm trong dữ liệu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Select All Buttons */}
            <button
              onClick={() => handleSelectAllRows(selectedRows.size !== data.length)}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium whitespace-nowrap"
            >
              {selectedRows.size === data.length ? 'Bỏ chọn' : 'Chọn'} tất cả hàng
            </button>
            
            <button
              onClick={() => handleSelectAllColumns(selectedColumns.size !== visibleHeaders.length)}
              className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium whitespace-nowrap"
            >
              {selectedColumns.size === visibleHeaders.length ? 'Bỏ chọn' : 'Chọn'} tất cả cột
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto p-4">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full border border-gray-200 [&>thead>tr>th]:text-center [&>tbody>tr>td]:border [&>tbody>tr>td]:border-gray-100 [&>thead>tr>th]:border [&>thead>tr>th]:border-gray-200">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  {/* Row Checkbox Header */}
                  <th className="px-4 py-3 text-center border-r border-gray-200 bg-gray-200">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === data.length && data.length > 0}
                      onChange={(e) => handleSelectAllRows(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  
                  {/* Column Headers with Checkboxes */}
                  {visibleHeaders.map((header, index) => (
                    <th
                      key={index}
                      className="px-4 py-3 text-left border-r border-gray-200 last:border-r-0"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedColumns.has(header)}
                          onChange={(e) => handleSelectColumn(header, e.target.checked)}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <span className="font-semibold text-gray-700 text-sm">
                          {header}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((row, rowIndex) => {
                  const actualIndex = (currentPage - 1) * rowsPerPage + rowIndex
                  const isSelected = selectedRows.has(actualIndex)
                  
                  return (
                    <tr
                      key={actualIndex}
                      className={`hover:bg-blue-50 transition-colors ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      {/* Row Checkbox */}
                      <td className="px-4 py-3 border-r border-gray-200 bg-gray-50">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(actualIndex, e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      
                      {/* Data Cells */}
                      {visibleHeaders.map((header, colIndex) => {
                        const isColSelected = selectedColumns.has(header)
                        return (
                          <td
                            key={colIndex}
                            className={`px-4 py-3 text-sm text-gray-900 border-r border-gray-200 last:border-r-0 ${
                              isColSelected ? 'bg-green-50' : ''
                            }`}
                          >
                            {String(row[header] || '')}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Hiển thị {((currentPage - 1) * rowsPerPage) + 1} - {Math.min(currentPage * rowsPerPage, filteredData.length)} / {filteredData.length} hàng
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Trước
                </button>
                <span className="text-sm text-gray-700">
                  Trang {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sau
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            <p>💡 <strong>Mẹo:</strong> Click vào checkbox cột để chọn cột, checkbox hàng để chọn hàng</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedRows.size === 0 || selectedColumns.size === 0}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckIcon className="w-5 h-5" />
              Xác nhận import ({selectedRows.size} hàng)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExcelPreviewModal
