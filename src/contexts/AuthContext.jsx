/* @refresh reset */
import React, { createContext, useContext, useEffect, useState } from 'react'
import supabaseLib from '../lib/supabase'

const { supabase, SUPABASE_URL } = supabaseLib
import api from '../lib/api'

const { userActivityApi } = api

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let heartbeatTimer = null
    let onlineHandler = null
    let unsubscribeAuth = null
    
    // Get initial session
    const getInitialSession = async () => {
      try {
        // 0) Quick connectivity preflight to avoid refresh loops when blocked
        const canReach = await (async () => {
          try {
            const ctrl = new AbortController()
            const t = setTimeout(() => ctrl.abort(), 1500)
            // Use auth endpoint instead of root URL for better compatibility
            await fetch(`${SUPABASE_URL}/auth/v1/health`, { 
              method: 'GET', 
              mode: 'cors', 
              signal: ctrl.signal,
              headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY }
            })
            clearTimeout(t)
            return true
          } catch {
            return false
          }
        })()

        if (!canReach || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
          if (!mounted) return
          setUser(null)
          setProfile(null)
          setLoading(false)
          // Retry when online
          if (typeof window !== 'undefined' && !onlineHandler) {
            onlineHandler = () => { getInitialSession() }
            window.addEventListener('online', onlineHandler, { once: true })
          }
          return
        }

        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        if (error) {
          console.error('Session error:', error.message)
          setUser(null)
          setProfile(null)
          setLoading(false)
          
          // Clear stale auth data
          const keys = Object.keys(localStorage)
          keys.forEach(key => {
            if (key.startsWith('sb-') || key.includes('supabase')) {
              localStorage.removeItem(key)
            }
          })
          return
        }
        
        if (session?.user) {
          setUser(session.user)
          setLoading(false) // Unlock UI immediately after auth check
          // Fetch profile in background
          fetchProfile(session.user.id)
          // Record login once when we have a session
          try { userActivityApi.recordLogin() } catch {}
          // Start heartbeat every 2 minutes
          if (!heartbeatTimer) {
            heartbeatTimer = setInterval(() => {
              userActivityApi.heartbeat()
            }, 120000)
          }
        } else {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error getting session:', error.message)
        if (!mounted) return
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    }

    const createAuthSubscription = () => {
      if (unsubscribeAuth) return
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return
          
          console.log('Auth event:', event, session?.user?.email)
          
          if (event === 'SIGNED_OUT') {
            setUser(null)
            setProfile(null)
            if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
          } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session?.user) {
              setUser(session.user)
              fetchProfile(session.user.id) // Background fetch
              try { userActivityApi.recordLogin() } catch {}
              if (!heartbeatTimer) {
                heartbeatTimer = setInterval(() => {
                  userActivityApi.heartbeat()
                }, 120000)
              }
            }
          } else if (session?.user) {
            setUser(session.user)
            fetchProfile(session.user.id) // Background fetch
          } else {
            setUser(null)
            setProfile(null)
          }
        }
      )
      unsubscribeAuth = () => subscription?.unsubscribe()
    }

    getInitialSession().then(() => {
      // Chỉ tạo subscription sau lần preflight/getSession đầu
      // để tránh Supabase tự phát hành session và cố refresh khi offline
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        createAuthSubscription()
      } else if (typeof window !== 'undefined') {
        onlineHandler = () => { createAuthSubscription() }
        window.addEventListener('online', onlineHandler, { once: true })
      }
    })

    return () => {
      mounted = false
      if (unsubscribeAuth) unsubscribeAuth()
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
      if (typeof window !== 'undefined' && onlineHandler) {
        window.removeEventListener('online', onlineHandler)
        onlineHandler = null
      }
    }
  }, [])

  const fetchProfile = async (userId) => {
      try {
        const { data, error } = await supabase.rpc('get_current_profile_full')
        if (error) {
          console.error('RPC get_current_profile_full error:', error)
          return null
        }
        if (data?.error) {
          console.warn('RPC semantic error:', data.error)
          return null
        }
        setProfile(data)
        return data
      } catch (err) {
        console.error('RPC exception:', err)
        return null
      }
  }

  const signUp = async (email, password, userData) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) throw error

    if (data.user) {
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: data.user.id,
            email: data.user.email,
            ...userData
          }
        ])

      if (profileError) throw profileError
    }

    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return data
  }

  const signOut = async () => {
    try {
      // Sign out from Supabase first
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Sign out error:', error)
      }
      
      // Clear state
      setUser(null)
      setProfile(null)
      
      // Clear Supabase storage keys
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key)
        }
      })
      
      sessionStorage.clear()
      
      console.log('✅ User signed out successfully')
    } catch (error) {
      console.error('Error signing out:', error)
      // Clear state anyway
      setUser(null)
      setProfile(null)
      
      // Force clear storage
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key)
        }
      })
    }
  }

  const resetPassword = async (email) => {
    // Gửi email khôi phục mật khẩu với đường dẫn chuyển hướng về trang đặt mật khẩu mới
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined
    const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined)
    if (error) throw error
  }

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })
    if (error) throw error
  }

  const updateProfile = async (updates) => {
    if (!user) throw new Error('No user logged in')

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error
    
    setProfile(data)
    return data
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    fetchProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
