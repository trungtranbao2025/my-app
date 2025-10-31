// Force clear all site data and reload
export const forceResetApp = () => {
  try {
    console.log('🔄 Force resetting app...')
    
    // 1. Clear all localStorage
    localStorage.clear()
    
    // 2. Clear all sessionStorage
    sessionStorage.clear()
    
    // 3. Clear all cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
    })
    
    // 4. Clear IndexedDB
    if (window.indexedDB) {
      indexedDB.databases().then((dbs) => {
        dbs.forEach(db => {
          if (db.name) {
            indexedDB.deleteDatabase(db.name)
          }
        })
      }).catch(() => {
        // Ignore errors
      })
    }
    
    console.log('✅ All site data cleared')
    
    // 5. Force reload and redirect to login
    setTimeout(() => {
      window.location.href = '/login'
      window.location.reload(true) // Force reload from server
    }, 100)
    
  } catch (error) {
    console.error('Error resetting app:', error)
    // Force reload anyway
    window.location.href = '/login'
    window.location.reload(true)
  }
}

// Quick reset function for development
export const devReset = () => {
  if (confirm('Bạn có chắc muốn reset toàn bộ app? Tất cả dữ liệu local sẽ bị xóa.')) {
    forceResetApp()
  }
}
