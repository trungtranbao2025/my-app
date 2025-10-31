import { useState, useEffect, useRef } from 'react'

// Simple in-memory cache with TTL (Time To Live)
const cache = new Map()
const DEFAULT_TTL = 10 * 60 * 1000 // 10 minutes (increased for better UX)

// Load cache from localStorage on init
const loadCacheFromStorage = () => {
  try {
    const stored = localStorage.getItem('app_cache')
    if (stored) {
      const parsed = JSON.parse(stored)
      Object.entries(parsed).forEach(([key, value]) => {
        // Only restore if not expired
        if (Date.now() - value.timestamp < DEFAULT_TTL) {
          cache.set(key, value)
        }
      })
    }
  } catch (error) {
    console.error('Failed to load cache from storage:', error)
  }
}

// Save cache to localStorage
const saveCacheToStorage = () => {
  try {
    const cacheObj = {}
    cache.forEach((value, key) => {
      cacheObj[key] = value
    })
    localStorage.setItem('app_cache', JSON.stringify(cacheObj))
  } catch (error) {
    console.error('Failed to save cache to storage:', error)
  }
}

// Load cache on module load
loadCacheFromStorage()

export const useCache = (key, fetcher, ttl = DEFAULT_TTL) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    const loadData = async () => {
      // Check cache first
      const cached = cache.get(key)
      if (cached) {
        // Always show cached data immediately (stale-while-revalidate)
        setData(cached.data)
        setLoading(false)
        
        // If cache is still fresh, don't refetch
        if (Date.now() - cached.timestamp < ttl) {
          return
        }
        
        // Cache is stale, but we already showed it
        // Now fetch fresh data in background
        setLoading(false) // Keep loading false for better UX
      } else {
        setLoading(true)
      }

      // Fetch new data
      try {
        setError(null)
        const result = await fetcher()
        
        if (isMounted.current) {
          setData(result)
          // Store in cache
          cache.set(key, {
            data: result,
            timestamp: Date.now()
          })
          // Persist to localStorage
          saveCacheToStorage()
        }
      } catch (err) {
        if (isMounted.current) {
          setError(err)
          console.error(`Error fetching ${key}:`, err)
        }
      } finally {
        if (isMounted.current) {
          setLoading(false)
        }
      }
    }

    loadData()
  }, [key, ttl])

  const refresh = async () => {
    // Invalidate cache
    cache.delete(key)
    
    try {
      setLoading(true)
      setError(null)
      const result = await fetcher()
      
      if (isMounted.current) {
        setData(result)
        cache.set(key, {
          data: result,
          timestamp: Date.now()
        })
        // Persist to localStorage
        saveCacheToStorage()
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err)
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }

  return { data, loading, error, refresh }
}

// Clear all cache
export const clearCache = () => {
  cache.clear()
  localStorage.removeItem('app_cache')
}

// Clear specific cache entry
export const clearCacheKey = (key) => {
  cache.delete(key)
  saveCacheToStorage()
}
