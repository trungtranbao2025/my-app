import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { format } from 'date-fns'

// Export data to Excel
export const exportToExcel = (data, fileName = 'export', sheetName = 'Data') => {
  try {
    // Create a new workbook
    const wb = XLSX.utils.book_new()
    
    // Convert data to worksheet
    const ws = XLSX.utils.json_to_sheet(data)
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    
    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    
    // Create blob and save
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    
    // Add timestamp to filename
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss')
    saveAs(blob, `${fileName}_${timestamp}.xlsx`)
    
    return true
  } catch (error) {
    console.error('Error exporting to Excel:', error)
    throw error
  }
}

// Export multiple sheets
export const exportMultipleSheets = (sheets, fileName = 'export') => {
  try {
    const wb = XLSX.utils.book_new()
    
    sheets.forEach(({ data, sheetName }) => {
      const ws = XLSX.utils.json_to_sheet(data)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    })
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss')
    saveAs(blob, `${fileName}_${timestamp}.xlsx`)
    
    return true
  } catch (error) {
    console.error('Error exporting multiple sheets:', error)
    throw error
  }
}

// Import Excel file
export const importFromExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        resolve(jsonData)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = (error) => reject(error)
    reader.readAsArrayBuffer(file)
  })
}

// Import all sheets from Excel
export const importAllSheets = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        
        const allSheets = {}
        
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName]
          allSheets[sheetName] = XLSX.utils.sheet_to_json(worksheet)
        })
        
        resolve(allSheets)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = (error) => reject(error)
    reader.readAsArrayBuffer(file)
  })
}

// Generate Excel template for import
export const generateTemplate = (columns, fileName = 'template') => {
  try {
    const wb = XLSX.utils.book_new()
    
    // Create header row
    const ws = XLSX.utils.aoa_to_sheet([columns])
    
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    
    saveAs(blob, `${fileName}_template.xlsx`)
    
    return true
  } catch (error) {
    console.error('Error generating template:', error)
    throw error
  }
}
