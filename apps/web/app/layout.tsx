import '../styles/globals.css'
import type { ReactNode } from 'react'

export const metadata = { title: 'Overlay & Clash Check', description: 'PDF overlay alignment' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased bg-gray-50 text-gray-800">
        {children}
      </body>
    </html>
  )
}
