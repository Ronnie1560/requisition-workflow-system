import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'

// ============================================================================
// In-memory cache for user profile
// ============================================================================

let cachedProfile = null
let cacheUserId = null
let cacheTimestamp = null
let pendingRequest = null

const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes in milliseconds

/**
 * Custom hook to fetch and cache user profile with optimizations
 * 
 * Features:
 * - Deduplicates concurrent requests
 * - Caches data for 10 minutes
 * - Falls back to localStorage for initial render
 * - Prevents redundant API calls
 * 
 * @param {string} userId - The user ID to fetch profile for
 * @returns {Object} { profile, loading, error, refresh, isCached }
 */
export const useUserProfile = (userId) => {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isCached, setIsCached] = useState(false)
  const isMountedRef = useRef(true)

  // Check if cache is valid
  const isCacheValid = useCallback(() => {
    if (!cachedProfile || !cacheTimestamp || cacheUserId !== userId) {
      return false
    }
    const elapsed = Date.now() - cacheTimestamp
    return elapsed < CACHE_DURATION
  }, [userId])

  // Try to get from localStorage on initial load
  const getFromLocalStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(`user_profile_${userId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Check if localStorage data is less than 1 hour old
        if (parsed.timestamp && (Date.now() - parsed.timestamp) < 60 * 60 * 1000) {
          return parsed.data
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return null
  }, [userId])

  // Save to localStorage
  const saveToLocalStorage = useCallback((data) => {
    try {
      localStorage.setItem(`user_profile_${userId}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }))
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [userId])

  // Fetch profile from API
  const fetchProfile = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setLoading(false)
      return
    }

    // Return cached data if valid
    if (!forceRefresh && isCacheValid()) {
      setProfile(cachedProfile)
      setIsCached(true)
      setLoading(false)
      return
    }

    // Deduplicate concurrent requests
    if (pendingRequest && !forceRefresh) {
      try {
        const result = await pendingRequest
        if (isMountedRef.current) {
          setProfile(result)
          setIsCached(true)
          setLoading(false)
        }
        return
      } catch {
        // Continue to make new request
      }
    }

    try {
      setLoading(true)
      setError(null)

      // Create the request promise
      pendingRequest = supabase
        .from('users')
        .select('id, email, full_name, role, department, phone, is_active, avatar_url')
        .eq('id', userId)
        .single()
        .then(({ data, error }) => {
          if (error) throw error
          return data
        })

      const data = await pendingRequest

      // Update cache
      cachedProfile = data
      cacheUserId = userId
      cacheTimestamp = Date.now()

      // Save to localStorage for faster initial loads
      saveToLocalStorage(data)

      if (isMountedRef.current) {
        setProfile(data)
        setIsCached(false)
        setError(null)
      }
    } catch (err) {
      logger.error('Error fetching user profile:', err)
      if (isMountedRef.current) {
        setError(err)
        // Try localStorage fallback
        const localData = getFromLocalStorage()
        if (localData) {
          setProfile(localData)
          setIsCached(true)
        }
      }
    } finally {
      pendingRequest = null
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [userId, isCacheValid, getFromLocalStorage, saveToLocalStorage])

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true

    // Try localStorage first for instant render
    const localData = getFromLocalStorage()
    if (localData) {
      setProfile(localData)
      setIsCached(true)
      setLoading(false)
    }

    // Then fetch fresh data
    fetchProfile()

    return () => {
      isMountedRef.current = false
    }
  }, [userId, fetchProfile, getFromLocalStorage])

  return {
    profile,
    loading,
    error,
    refresh: () => fetchProfile(true),
    isCached
  }
}

/**
 * Clear the user profile cache
 */
export const clearUserProfileCache = () => {
  cachedProfile = null
  cacheUserId = null
  cacheTimestamp = null
  pendingRequest = null
}

/**
 * Update the cached profile (useful after profile updates)
 */
export const updateCachedProfile = (newProfile) => {
  if (cachedProfile && cacheUserId === newProfile.id) {
    cachedProfile = { ...cachedProfile, ...newProfile }
    cacheTimestamp = Date.now()
  }
}

export default useUserProfile
