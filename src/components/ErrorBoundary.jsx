import React from 'react'
// Namespace import to avoid named-export issues on some bundlers
import versionControl from '../utils/versionControl'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // Log error to database
    versionControl.logError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true
    }).catch(err => {
      console.error('Failed to log error to database:', err)
    })
    
    // Check if it's an auth-related error
    const isAuthError = 
      error.message?.includes('auth') || 
      error.message?.includes('session') ||
      error.message?.includes('token')
    
    if (isAuthError) {
      console.log('⚠️ Auth error detected, clearing cache...')
      this.clearAuthCache()
    }
  }

  clearAuthCache = () => {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key)
        }
      })
      sessionStorage.clear()
    } catch (error) {
      console.error('Error clearing cache:', error)
    }
  }

  handleReload = () => {
    this.clearAuthCache()
    window.location.href = '/login'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Đã xảy ra lỗi
            </h3>
            
            <p className="text-sm text-gray-500 mb-6">
              Ứng dụng gặp lỗi không mong muốn. Vui lòng tải lại trang.
            </p>
            
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                  Chi tiết lỗi
                </summary>
                <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-32">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            
            <div className="space-y-2">
              <button
                onClick={this.handleReload}
                className="w-full btn-primary"
              >
                Tải lại và đăng nhập
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full btn-secondary"
              >
                Chỉ tải lại
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
