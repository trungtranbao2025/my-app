import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'

// Fallback entry (TSX) để tránh lỗi trình duyệt còn cache yêu cầu main.tsx

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontFamily: 'Times New Roman, serif' },
          }}
        />
      </AuthProvider>
    </HashRouter>
  </StrictMode>
)
