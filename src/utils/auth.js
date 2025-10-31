// Helper to clear all auth-related storage
export const clearAuthStorage = () => {
  try {
    // Clear localStorage items related to Supabase auth
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        localStorage.removeItem(key)
      }
    })
    
    // Clear all sessionStorage
    sessionStorage.clear()
    
    console.log('✅ Auth storage cleared')
    return true
  } catch (error) {
    console.error('Error clearing auth storage:', error)
    return false
  }
}

// Check if user is authenticated
export const isAuthenticated = async () => {
  try {
    const { supabase } = await import('../lib/supabase')
    const { data: { session } } = await supabase.auth.getSession()
    return !!session?.user
  } catch (error) {
    console.error('Error checking auth:', error)
    return false
  }
}
