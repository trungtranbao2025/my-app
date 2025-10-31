import React, { useState, useEffect, useRef } from 'react'
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const VoiceInput = ({ onTranscript, placeholder = 'Nhấn mic để ghi âm...', className = '' }) => {
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState(null)
  const [isSupported, setIsSupported] = useState(true)
  const lastEmittedRef = useRef('')

  useEffect(() => {
    // Check if browser supports Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      setIsSupported(false)
      console.warn('Web Speech API không được hỗ trợ trên trình duyệt này')
      return
    }

    // Initialize recognition
    const recognitionInstance = new SpeechRecognition()
  recognitionInstance.continuous = true // Keep listening until stopped
  // Only use final results to reduce noise/duplication
  recognitionInstance.interimResults = false
    recognitionInstance.lang = 'vi-VN' // Vietnamese language
    recognitionInstance.maxAlternatives = 1

    // Handle results
    recognitionInstance.onresult = (event) => {
      // Emit only new, cleaned final segments to avoid duplicates
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        if (!res.isFinal) continue
        let text = (res[0]?.transcript || '').replace(/\s+/g, ' ').trim()
        if (!text) continue
        if (text === lastEmittedRef.current) continue
        lastEmittedRef.current = text
        onTranscript(text)
      }
    }

    // Handle errors
    recognitionInstance.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
      
      switch (event.error) {
        case 'no-speech':
          toast.error('Không phát hiện giọng nói. Vui lòng thử lại.')
          break
        case 'audio-capture':
          toast.error('Không tìm thấy microphone. Vui lòng kiểm tra thiết bị.')
          break
        case 'not-allowed':
          toast.error('Vui lòng cấp quyền truy cập microphone.')
          break
        case 'network':
          toast.error('Lỗi kết nối mạng. Vui lòng kiểm tra kết nối.')
          break
        default:
          toast.error('Lỗi nhận dạng giọng nói: ' + event.error)
      }
    }

    // Handle end
    recognitionInstance.onend = () => {
      setIsListening(false)
    }

    setRecognition(recognitionInstance)

    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop()
      }
    }
  }, [onTranscript])

  const toggleListening = () => {
    if (!recognition) return

    if (isListening) {
      recognition.stop()
      setIsListening(false)
      toast.success('Đã dừng ghi âm')
    } else {
      try {
        recognition.start()
        setIsListening(true)
        toast.success('Đang ghi âm... Hãy nói nội dung')
      } catch (error) {
        console.error('Error starting recognition:', error)
        toast.error('Không thể bắt đầu ghi âm')
      }
    }
  }

  if (!isSupported) {
    return (
      <div className="text-sm text-gray-500 italic">
        Voice input không được hỗ trợ trên trình duyệt này
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
        isListening
          ? 'bg-red-50 border-red-500 text-red-700 hover:bg-red-100 animate-pulse'
          : 'bg-blue-50 border-blue-500 text-blue-700 hover:bg-blue-100'
      } ${className}`}
      title={isListening ? 'Nhấn để dừng ghi âm' : 'Nhấn để bắt đầu ghi âm'}
    >
      {isListening ? (
        <>
          <StopIcon className="w-5 h-5 animate-pulse" />
          <span className="font-medium">Đang ghi âm...</span>
        </>
      ) : (
        <>
          <MicrophoneIcon className="w-5 h-5" />
          <span>{placeholder}</span>
        </>
      )}
    </button>
  )
}

export default VoiceInput
