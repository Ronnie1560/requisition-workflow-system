import { useState, useEffect, useRef, useCallback } from 'react'
import { getOrganizationSettings } from '../services/api/systemSettings'

// ============================================================================
// In-memory cache for organization settings
// ============================================================================

let cachedSettings = null
let cacheTimestamp = null
let pendingRequest = null // For deduplication

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

/**
 * Custom hook to fetch and cache organization settings
 *
 * Features:
 * - Deduplicates concurrent requests (only one request at a time)
 * - Caches data for 5 minutes
 * - Auto-invalidates after cache duration
 * - Prevents redundant API calls
 *
 * Usage:
 * const { orgSettings, loading, error, refresh } = useOrganizationSettings()
 *
 * @returns {Object} { orgSettings, loading, error, refresh, isCached }
 */
export const useOrganizationSettings = () => {
  const [orgSettings, setOrgSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isCached, setIsCached] = useState(false)
  const isMountedRef = useRef(true)

  // Function to check if cache is still valid
  const isCacheValid = useCallback(() => {
    if (!cachedSettings || !cacheTimestamp) {
      return false
    }

    const now = Date.now()
    const elapsed = now - cacheTimestamp
    return elapsed < CACHE_DURATION
  }, [])

  // Function to fetch organization settings
  const fetchSettings = useCallback(async (forceRefresh = false) => {
    try {
      // If we have valid cache and not forcing refresh, use it
      if (!forceRefresh && isCacheValid()) {
        if (isMountedRef.current) {
          setOrgSettings(cachedSettings)
          setLoading(false)
          setError(null)
          setIsCached(true)
        }
        return cachedSettings
      }

      // Deduplicate: if request is already pending, wait for it instead of making new request
      if (pendingRequest) {
        console.log('[useOrganizationSettings] Reusing pending request (deduplication)')
        const result = await pendingRequest
        if (isMountedRef.current) {
          setOrgSettings(result)
          setLoading(false)
          setIsCached(false)
        }
        return result
      }

      // Create new request
      console.log('[useOrganizationSettings] Fetching fresh data from API')
      setLoading(true)
      setError(null)

      // Store promise for deduplication
      pendingRequest = getOrganizationSettings()

      const { data, error: apiError } = await pendingRequest

      if (apiError) {
        throw new Error(apiError.message || 'Failed to fetch organization settings')
      }

      // Update cache
      cachedSettings = data
      cacheTimestamp = Date.now()
      pendingRequest = null // Clear pending request

      if (isMountedRef.current) {
        setOrgSettings(data)
        setLoading(false)
        setError(null)
        setIsCached(false)
      }

      return data
    } catch (err) {
      console.error('[useOrganizationSettings] Error fetching organization settings:', err)
      pendingRequest = null // Clear pending request on error

      if (isMountedRef.current) {
        setError(err.message || 'Failed to fetch organization settings')
        setLoading(false)
        // Keep using cached data if available, even if expired
        if (cachedSettings) {
          setOrgSettings(cachedSettings)
          setIsCached(true)
        }
      }

      throw err
    }
  }, [isCacheValid])

  // Fetch on component mount
  useEffect(() => {
    fetchSettings()

    return () => {
      isMountedRef.current = false
    }
  }, [fetchSettings])

  // Auto-refresh cache after duration expires
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isCacheValid()) {
        console.log('[useOrganizationSettings] Cache expired, scheduling refresh')
        // Cache has expired, but don't fetch automatically unless component mounts again
        // This prevents unnecessary requests in the background
      }
    }, CACHE_DURATION)

    return () => clearInterval(timer)
  }, [isCacheValid])

  // Return function to manually refresh data
  const refresh = useCallback(() => {
    console.log('[useOrganizationSettings] Manual refresh triggered')
    return fetchSettings(true) // Force refresh
  }, [fetchSettings])

  return {
    orgSettings,
    loading,
    error,
    refresh,
    isCached // True if using cached data, helpful for debugging
  }
}

// Bonus: Utility to clear cache manually
export const clearOrganizationSettingsCache = () => {
  console.log('[useOrganizationSettings] Clearing cache manually')
  cachedSettings = null
  cacheTimestamp = null
  pendingRequest = null
}
