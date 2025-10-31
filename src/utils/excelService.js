import * as XLSX from 'xlsx'

/**
 * Excel Service - Xử lý import/export file Excel
 * Sử dụng SheetJS (xlsx) library
 */

export class ExcelService {
  /**
   * Đọc file Excel và trả về dữ liệu dạng JSON
   * @param {File} file - File Excel
   * @param {Object} options - Tùy chọn đọc file
   * @returns {Promise<Object>} - { data: [], headers: [], sheetNames: [] }
   */
  static async readExcelFile(file, options = {}) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: 'array', ...options })

          // Lấy tên tất cả các sheet
          const sheetNames = workbook.SheetNames

          // Đọc sheet đầu tiên (hoặc sheet được chỉ định)
          const sheetName = options.sheetName || sheetNames[0]
          const worksheet = workbook.Sheets[sheetName]

          // Convert sang JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, // Trả về array of arrays
            defval: '', // Giá trị mặc định cho ô trống
            blankrows: false, // Bỏ qua hàng trống
            ...options 
          })

          // Lấy headers từ hàng đầu tiên
          const headers = jsonData[0] || []
          
          // Lấy data từ hàng thứ 2 trở đi
          const rows = jsonData.slice(1).map((row, index) => {
            const rowData = { _rowIndex: index + 1 }
            headers.forEach((header, colIndex) => {
              rowData[header] = row[colIndex] || ''
            })
            return rowData
          })

          resolve({
            data: rows,
            headers: headers,
            sheetNames: sheetNames,
            rawData: jsonData
          })
        } catch (error) {
          reject(new Error(`Lỗi đọc file Excel: ${error.message}`))
        }
      }

      reader.onerror = () => {
        reject(new Error('Lỗi đọc file'))
      }

      reader.readAsArrayBuffer(file)
    })
  }

  /**
   * Export dữ liệu ra file Excel với định dạng đẹp, chuyên nghiệp
   * @param {Array} data - Mảng dữ liệu cần export
   * @param {String} fileName - Tên file (không có extension)
   * @param {Object} options - Tùy chọn export
   */
  static exportToExcel(data, fileName = 'export', options = {}) {
    try {
      const {
        sheetName = 'Sheet1',
        headers = null, // Nếu null, lấy keys từ object đầu tiên
        columnWidths = null, // Array of widths: [{ wch: 20 }, { wch: 15 }]
        selectedColumns = null, // Array of column keys to export
        dateFormat = 'dd/mm/yyyy',
        headerStyle = true, // Áp dụng style cho header
        alternatingRows = true, // Màu xen kẽ cho các hàng
        freezeHeader = true // Đóng băng hàng header
      } = options

      // Lọc columns nếu có selectedColumns
      let exportData = data
      if (selectedColumns && selectedColumns.length > 0) {
        exportData = data.map(row => {
          const filtered = {}
          selectedColumns.forEach(col => {
            filtered[col] = row[col]
          })
          return filtered
        })
      }

      // Tạo worksheet từ JSON
      const worksheet = XLSX.utils.json_to_sheet(exportData, {
        header: headers || undefined,
        dateNF: dateFormat
      })

      // Lấy range của worksheet
      const range = XLSX.utils.decode_range(worksheet['!ref'])
      
      // Thiết lập độ rộng cột với auto-size thông minh
      if (columnWidths) {
        worksheet['!cols'] = columnWidths
      } else {
        const cols = []
        const dataKeys = headers || Object.keys(exportData[0] || {})
        dataKeys.forEach((key, colIndex) => {
          // Tính độ dài tối đa của cột (header + data)
          const headerLength = String(key).length
          const maxDataLength = Math.max(
            ...exportData.map(row => String(row[key] || '').length)
          )
          const maxLength = Math.max(headerLength, maxDataLength)
          // Giới hạn độ rộng từ 10-50 ký tự
          cols.push({ wch: Math.min(Math.max(maxLength + 3, 10), 50) })
        })
        worksheet['!cols'] = cols
      }

      // Áp dụng style cho tất cả các ô
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
          const cell = worksheet[cellAddress]
          
          if (!cell) continue

          // Khởi tạo style cho cell
          cell.s = cell.s || {}

          // Border cho tất cả các ô
          cell.s.border = {
            top: { style: 'thin', color: { rgb: 'D0D0D0' } },
            bottom: { style: 'thin', color: { rgb: 'D0D0D0' } },
            left: { style: 'thin', color: { rgb: 'D0D0D0' } },
            right: { style: 'thin', color: { rgb: 'D0D0D0' } }
          }

          // Style cho header (hàng đầu tiên)
          if (R === 0 && headerStyle) {
            cell.s.fill = {
              patternType: 'solid',
              fgColor: { rgb: '4472C4' } // Xanh dương đậm
            }
            cell.s.font = {
              bold: true,
              color: { rgb: 'FFFFFF' }, // Chữ trắng
              sz: 12,
              name: 'Times New Roman'
            }
            cell.s.alignment = {
              horizontal: 'center',
              vertical: 'center',
              wrapText: true
            }
          } else {
            // Style cho các hàng dữ liệu
            cell.s.font = {
              sz: 11,
              name: 'Times New Roman'
            }
            cell.s.alignment = {
              vertical: 'center',
              wrapText: false
            }

            // Màu xen kẽ cho các hàng
            if (alternatingRows && R % 2 === 0) {
              cell.s.fill = {
                patternType: 'solid',
                fgColor: { rgb: 'F2F2F2' } // Xám nhạt
              }
            }
          }
        }
      }

      // Đóng băng hàng header
      if (freezeHeader) {
        worksheet['!freeze'] = { xSplit: 0, ySplit: 1 }
      }

      // Auto-filter cho header
      worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(range) }

      // Tạo workbook
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

      // Download file với options để giữ styling
      XLSX.writeFile(workbook, `${fileName}.xlsx`, {
        cellStyles: true,
        bookSST: false
      })

      return { success: true, message: 'Export thành công!' }
    } catch (error) {
      console.error('Export error:', error)
      return { success: false, message: `Lỗi export: ${error.message}` }
    }
  }

  /**
   * Tạo file Excel template mẫu
   * @param {Array} headers - Mảng tên cột
   * @param {String} fileName - Tên file
   * @param {Array} sampleData - Dữ liệu mẫu (optional)
   */
  static downloadTemplate(headers, fileName = 'template', sampleData = []) {
    const data = sampleData.length > 0 ? sampleData : [
      headers.reduce((obj, header) => {
        obj[header] = ''
        return obj
      }, {})
    ]

    this.exportToExcel(data, fileName, {
      headers: headers,
      sheetName: 'Template'
    })
  }

  /**
   * Validate dữ liệu Excel theo rules
   * @param {Array} data - Dữ liệu cần validate
   * @param {Object} rules - Rules validation
   * @returns {Object} - { valid: boolean, errors: [] }
   */
  static validateData(data, rules = {}) {
    const errors = []

    data.forEach((row, index) => {
      Object.keys(rules).forEach(field => {
        const rule = rules[field]
        const value = row[field]

        // Required check
        if (rule.required && (!value || value.toString().trim() === '')) {
          errors.push({
            row: index + 1,
            field: field,
            message: `${field} là bắt buộc`,
            value: value
          })
        }

        // Type check
        if (value && rule.type) {
          switch (rule.type) {
            case 'email':
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                errors.push({
                  row: index + 1,
                  field: field,
                  message: `${field} không đúng định dạng email`,
                  value: value
                })
              }
              break
            case 'number':
              if (isNaN(value)) {
                errors.push({
                  row: index + 1,
                  field: field,
                  message: `${field} phải là số`,
                  value: value
                })
              }
              break
            case 'date':
              if (isNaN(Date.parse(value))) {
                errors.push({
                  row: index + 1,
                  field: field,
                  message: `${field} không đúng định dạng ngày`,
                  value: value
                })
              }
              break
          }
        }

        // Custom validator
        if (value && rule.validator && typeof rule.validator === 'function') {
          const validationResult = rule.validator(value, row)
          if (validationResult !== true) {
            errors.push({
              row: index + 1,
              field: field,
              message: validationResult || `${field} không hợp lệ`,
              value: value
            })
          }
        }
      })
    })

    return {
      valid: errors.length === 0,
      errors: errors
    }
  }

  /**
   * Convert date từ Excel serial number sang JavaScript Date
   * @param {Number} serial - Excel date serial
   * @returns {Date}
   */
  static excelDateToJSDate(serial) {
    const utc_days = Math.floor(serial - 25569)
    const utc_value = utc_days * 86400
    const date_info = new Date(utc_value * 1000)
    return date_info
  }

  /**
   * Format data trước khi export
   * @param {Array} data - Raw data
   * @param {Object} formatters - Object với key là tên cột, value là hàm format
   * @returns {Array} - Formatted data
   */
  static formatDataForExport(data, formatters = {}) {
    return data.map(row => {
      const formatted = { ...row }
      Object.keys(formatters).forEach(key => {
        if (formatted[key] !== undefined && typeof formatters[key] === 'function') {
          formatted[key] = formatters[key](formatted[key], row)
        }
      })
      return formatted
    })
  }

  /**
   * Merge data từ nhiều sheets
   * @param {File} file - File Excel
   * @returns {Promise<Object>} - { sheetName: data }
   */
  static async readAllSheets(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: 'array' })

          const allSheets = {}

          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
              defval: '',
              blankrows: false
            })
            allSheets[sheetName] = jsonData
          })

          resolve(allSheets)
        } catch (error) {
          reject(new Error(`Lỗi đọc file: ${error.message}`))
        }
      }

      reader.onerror = () => reject(new Error('Lỗi đọc file'))
      reader.readAsArrayBuffer(file)
    })
  }
}

export default ExcelService
