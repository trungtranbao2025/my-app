import React, { useState, useRef } from 'react'
import { PhotoIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import Tesseract from 'tesseract.js'

const OCRInput = ({ onTextExtracted, className = '' }) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewImage, setPreviewImage] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh (JPG, PNG, etc.)')
      return
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File quá lớn. Vui lòng chọn ảnh nhỏ hơn 10MB')
      return
    }

    // Preview image
    const reader = new FileReader()
    reader.onload = (e) => setPreviewImage(e.target.result)
    reader.readAsDataURL(file)

    // Process OCR
    await processOCR(file)
  }

  const processOCR = async (file) => {
    setIsProcessing(true)
    setProgress(0)

    try {
      toast.loading('Đang nhận dạng văn bản...', { id: 'ocr-loading' })

      const result = await Tesseract.recognize(file, 'vie', {
        logger: (m) => {
          // Update progress
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
          }
        }
      })

      const extractedText = result.data.text.trim()

      if (!extractedText) {
        toast.error('Không tìm thấy văn bản trong ảnh', { id: 'ocr-loading' })
        return
      }

      toast.success(`Nhận dạng thành công ${extractedText.length} ký tự!`, { 
        id: 'ocr-loading',
        duration: 3000 
      })
      
      // Send text to parent component
      onTextExtracted(extractedText)

      // Clear preview after success
      setTimeout(() => {
        setPreviewImage(null)
      }, 2000)

    } catch (error) {
      console.error('OCR Error:', error)
      toast.error('Lỗi khi nhận dạng văn bản: ' + error.message, { id: 'ocr-loading' })
    } finally {
      setIsProcessing(false)
      setProgress(0)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveImage = () => {
    setPreviewImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Upload Button */}
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={isProcessing}
          className="hidden"
          id="ocr-file-input"
        />
        <label
          htmlFor="ocr-file-input"
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all cursor-pointer ${
            isProcessing
              ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
              : 'bg-green-50 border-green-500 text-green-700 hover:bg-green-100'
          }`}
        >
          {isProcessing ? (
            <>
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              <span className="font-medium">Đang xử lý {progress}%...</span>
            </>
          ) : (
            <>
              <PhotoIcon className="w-5 h-5" />
              <span>📄 Chọn ảnh để nhận dạng văn bản</span>
            </>
          )}
        </label>
      </div>

      {/* Preview Image */}
      {previewImage && (
        <div className="relative border border-gray-300 rounded-lg overflow-hidden">
          <img
            src={previewImage}
            alt="Preview"
            className="w-full h-auto max-h-64 object-contain bg-gray-50"
          />
          {!isProcessing && (
            <button
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors shadow-lg"
              title="Xóa ảnh"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          {isProcessing && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white px-4 py-2 rounded-lg shadow-lg">
                <div className="flex items-center gap-2">
                  <ArrowPathIcon className="w-5 h-5 text-green-600 animate-spin" />
                  <span className="text-sm font-medium text-gray-700">
                    Đang nhận dạng... {progress}%
                  </span>
                </div>
                <div className="mt-2 w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs text-gray-500 italic">
        💡 Hỗ trợ nhận dạng tiếng Việt từ ảnh chụp tài liệu, hợp đồng, biên bản...
      </p>
    </div>
  )
}

export default OCRInput
