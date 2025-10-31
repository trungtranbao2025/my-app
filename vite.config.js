import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Important for Electron
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    hmr: {
      overlay: true
    }
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    modulePreload: false, // Disable for Electron file:// protocol
    cssCodeSplit: false, // Bundle CSS together for Electron
    terserOptions: {
      compress: {
        drop_console: false, // Keep console in dev
        drop_debugger: true
      }
    },
    chunkSizeWarningLimit: 2000,
    sourcemap: false,
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: 'assets/index-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js'
    ],
    exclude: ['lucide-react'] // Exclude heavy icon library from pre-bundling
  }
})
