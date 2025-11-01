import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
// import { AppInitializer } from './components/AppInitializer'
import ErrorBoundary from './components/ErrorBoundary'

// Register service worker for offline support only on web browser
// Avoid registering inside Capacitor/Electron where /sw.js may not exist
try {
  const isCapacitor = typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() !== 'web'
  const isElectron = typeof window !== 'undefined' && !!window.electron
  if (!isCapacitor && !isElectron && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration.scope)
        })
        .catch((error) => {
          console.log('❌ Service Worker registration failed:', error)
        })
    })
  }
} catch {}

// Bind F5 to hard reload (clear cache + reload) via Electron
if (typeof window !== 'undefined' && window.electron && window.electron.hardReload) {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
      e.preventDefault()
      window.electron.hardReload()
    }
  })
}

// Debug: Log React mount
console.log('🚀 React starting to mount...')

// Polyfill: Some legacy code may call toast.info / toast.warning (not provided by react-hot-toast)
try {
  if (typeof toast === 'function') {
    if (typeof toast.info !== 'function') {
      // Fallback to neutral toast
      toast.info = (message, options) => toast(message, options)
    }
    if (typeof toast.warning !== 'function') {
      toast.warning = (message, options) => toast(message, options)
    }
  }
} catch (e) {
  // no-op
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        {/* <AppInitializer> */}
          <AuthProvider>
            <NotificationProvider>
              <App />
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    fontFamily: 'Times New Roman, serif',
                  },
                }}
              />
            </NotificationProvider>
          </AuthProvider>
        {/* </AppInitializer> */}
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)

console.log('✅ React mount complete')
