import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'
import { captureMessage } from '../lib/sentry'
import { useOrganizationSettings, clearOrganizationSettingsCache } from '../hooks/useOrganizationSettings'
import { useInactivityTimeout } from '../hooks/useInactivityTimeout'
import InactivityWarningModal from '../components/auth/InactivityWarningModal'

const AuthContext = createContext({})

// Session validation interval (5 minutes)
const SESSION_VALIDATION_INTERVAL = 5 * 60 * 1000

// Profile cache
let profileCache = null
let profileCacheUserId = null
let profileCacheTimestamp = null
const PROFILE_CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

const getProfileFromCache = (userId) => {
  if (profileCache && profileCacheUserId === userId && profileCacheTimestamp) {
    if ((Date.now() - profileCacheTimestamp) < PROFILE_CACHE_DURATION) {
      return profileCache
    }
  }
  // Try localStorage
  try {
    const stored = localStorage.getItem(`profile_${userId}`)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.timestamp && (Date.now() - parsed.timestamp) < PROFILE_CACHE_DURATION) {
        return parsed.data
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return null
}

const setProfileCache = (userId, data) => {
  profileCache = data
  profileCacheUserId = userId
  profileCacheTimestamp = Date.now()
  try {
    localStorage.setItem(`profile_${userId}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
  } catch {
    // Ignore localStorage errors
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// Export a function to trigger logout from outside React components (e.g., API interceptors)
let globalLogoutCallback = null
// eslint-disable-next-line react-refresh/only-export-components
export const setGlobalLogoutCallback = (callback) => {
  globalLogoutCallback = callback
}
// eslint-disable-next-line react-refresh/only-export-components
export const triggerGlobalLogout = () => {
  if (globalLogoutCallback) {
    globalLogoutCallback()
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const sessionValidationRef = useRef(null)
  const signingOutRef = useRef(false)

  // Use cached organization settings hook
  const { orgSettings } = useOrganizationSettings()
  const organizationName = orgSettings?.organization_name || 'Your Organization Name'

  /**
   * Clear all auth state and storage
   */
  const clearAuthState = useCallback(() => {
    setUser(null)
    setProfile(null)
    setSessionExpired(false)
    clearOrganizationSettingsCache()
    
    // Clear in-memory profile cache (CRITICAL: fixes sign-in after sign-out bug)
    profileCache = null
    profileCacheUserId = null
    profileCacheTimestamp = null
    
    // Clear profile cache from localStorage
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('profile_') || key.startsWith('org_') || key.startsWith('pcm_')) {
          localStorage.removeItem(key)
        }
      })
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  /**
   * Force logout and redirect to login page
   * Returns a promise that resolves when signOut is complete
   */
  const forceLogout = useCallback(async (reason = 'session_expired') => {
    logger.warn(`Force logout triggered: ${reason}`)

    // Guard: prevent auth listener from restoring session during sign-out
    signingOutRef.current = true

    // Track logout event for analytics
    captureMessage('User logged out', {
      level: 'info',
      tags: { event: 'auth.logout', reason }
    })

    // Clear state immediately (synchronous)
    clearAuthState()

    // Only set sessionExpired for non-user-initiated logouts
    if (reason !== 'user_initiated') {
      setSessionExpired(true)
    }

    // Sign out from Supabase (scope: 'global' revokes token server-side)
    try {
      await supabase.auth.signOut({ scope: 'global' })
      logger.info('Supabase signOut completed successfully')
    } catch (error) {
      logger.error('Error during force signOut:', error)
    }

    // Belt-and-suspenders: explicitly clear any residual Supabase auth tokens
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key)
        }
      })
    } catch {
      // Ignore localStorage errors
    }

    signingOutRef.current = false
  }, [clearAuthState])

  // Register global logout callback for API interceptors
  useEffect(() => {
    setGlobalLogoutCallback(forceLogout)
    return () => setGlobalLogoutCallback(null)
  }, [forceLogout])

  /**
   * Validate current session - check if token is still valid
   */
  const validateSession = useCallback(async () => {
    try {
      const { data: { user: currentUser }, error } = await supabase.auth.getUser()
      
      if (error || !currentUser) {
        logger.warn('Session validation failed - no valid user')
        await forceLogout('session_invalid')
        return false
      }
      
      return true
    } catch (error) {
      logger.error('Session validation error:', error)
      await forceLogout('session_error')
      return false
    }
  }, [forceLogout])

  // Set up periodic session validation
  useEffect(() => {
    if (!user) {
      // Clear interval if no user
      if (sessionValidationRef.current) {
        clearInterval(sessionValidationRef.current)
        sessionValidationRef.current = null
      }
      return
    }

    // Validate session every 5 minutes
    sessionValidationRef.current = setInterval(() => {
      validateSession()
    }, SESSION_VALIDATION_INTERVAL)

    return () => {
      if (sessionValidationRef.current) {
        clearInterval(sessionValidationRef.current)
        sessionValidationRef.current = null
      }
    }
  }, [user, validateSession])

  // Handle automatic logout due to inactivity
  const handleInactivityLogout = useCallback(async () => {
    logger.warn('Auto-logout due to inactivity')
    await forceLogout('inactivity')
  }, [forceLogout])

  // Set up inactivity timeout (only when user is logged in)
  const {
    showWarning,
    remainingSeconds,
    resetTimer,
    pauseTimer,
    resumeTimer
  } = useInactivityTimeout(handleInactivityLogout, {
    timeoutMinutes: 30,      // 30 minutes of inactivity
    warningMinutes: 2,       // Show warning 2 minutes before logout
    enabled: !!user          // Only enable when user is logged in
  })

  // Handle "Stay Logged In" from warning modal
  const handleStayLoggedIn = () => {
    resetTimer()
  }

  // Handle manual logout from warning modal
  const handleLogoutFromWarning = async () => {
    await signOut()
  }

  useEffect(() => {
    let mounted = true
    let fetchingProfile = false

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return

      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        // During sign-out, only process SIGNED_OUT events.
        // This prevents stale SIGNED_IN/TOKEN_REFRESHED events from
        // restoring the session (Chrome race condition).
        if (signingOutRef.current && event !== 'SIGNED_OUT') {
          logger.debug(`Ignoring ${event} event during sign-out`)
          return
        }

        // Handle TOKEN_REFRESHED: update user but DON'T refetch profile
        if (event === 'TOKEN_REFRESHED') {
          setUser(session?.user ?? null)
          return
        }

        // Handle SIGNED_OUT event
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        // For other events (SIGNED_IN, USER_UPDATED, etc.)
        setUser(session?.user ?? null)

        if (session?.user && !fetchingProfile) {
          fetchingProfile = true
          await fetchProfile(session.user.id)
          fetchingProfile = false
        } else if (!session?.user) {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const fetchProfile = async (userId, forceRefresh = false) => {
    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = getProfileFromCache(userId)
        if (cached) {
          setProfile(cached)
          setLoading(false)
          // Refresh in background
          refreshProfileInBackground(userId)
          return
        }
      }

      // Add timeout to prevent indefinite hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      )

      const fetchPromise = supabase
        .from('users')
        .select('id, email, full_name, role, department, phone, is_active, avatar_url')
        .eq('id', userId)
        .single()

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise])

      if (error) {
        logger.error('Error fetching profile:', error)
        // If profile doesn't exist, sign out (but don't create a loop)
        if (error.code === 'PGRST116') {
          setLoading(false)
          setTimeout(() => {
            supabase.auth.signOut()
          }, 100)
        }
        setLoading(false)
        return
      }

      // Cache the profile
      setProfileCache(userId, data)
      setProfile(data)
    } catch (error) {
      logger.error('Error fetching profile:', error)
      // On timeout or other errors, try cache
      const cached = getProfileFromCache(userId)
      if (cached) {
        setProfile(cached)
      } else {
        setProfile(null)
      }
    } finally {
      setLoading(false)
    }
  }

  // Background refresh for stale cache
  const refreshProfileInBackground = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, department, phone, is_active, avatar_url')
        .eq('id', userId)
        .single()
      
      if (!error && data) {
        setProfileCache(userId, data)
        setProfile(data)
      }
    } catch {
      // Silent fail for background refresh
    }
  }

  /**
   * @deprecated Self-registration is disabled.
   * New users must be invited by an organization administrator via the invite-user Edge Function.
   * This function is kept for backwards compatibility with tests only.
   */
  const signUp = async () => {
    // Self-registration is disabled for security
    // Users must be invited by an organization admin
    return { 
      data: null, 
      error: new Error('Self-registration is disabled. Please contact your organization administrator for an invitation.') 
    }
  }

  const signIn = async (email, password) => {
    try {
      // Ensure clean state before sign in (fixes sign-in after sign-out issue)
      clearAuthState()
      
      // Use rate-limited login edge function if available, fallback to direct auth
      const useRateLimitedLogin = import.meta.env.VITE_USE_RATE_LIMITED_LOGIN === 'true'
      
      let data, error
      
      if (useRateLimitedLogin) {
        // Call rate-limited login edge function
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rate-limited-login`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ email, password })
          }
        )
        
        const result = await response.json()
        
        if (!response.ok) {
          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = result.retry_after || 900 // 15 min default
            const minutes = Math.ceil(retryAfter / 60)
            error = new Error(`Too many login attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`)
            error.code = 'RATE_LIMITED'
          } else {
            error = new Error(result.error || 'Invalid login credentials')
            error.code = result.code || 'INVALID_CREDENTIALS'
          }
        } else {
          // Set the session from edge function response
          const { error: setError } = await supabase.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token
          })
          if (setError) {
            error = setError
          } else {
            data = result
          }
        }
      } else {
        // Direct Supabase auth (fallback)
        const result = await supabase.auth.signInWithPassword({
          email,
          password
        })
        data = result.data
        error = result.error
      }

      if (error) {
        captureMessage('Login failed', {
          level: 'warning',
          tags: { event: 'auth.login.failed', errorCode: error.code || 'unknown' }
        })
        throw error
      }
      
      captureMessage('Login successful', {
        level: 'info',
        tags: { event: 'auth.login.success' }
      })
      
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const signOut = async () => {
    // Use forceLogout for consistent cleanup
    await forceLogout('user_initiated')
  }

  const updateProfile = async (updates) => {
    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)

      if (error) throw error

      // Refresh profile
      await fetchProfile(user.id)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const value = {
    user,
    profile,
    loading,
    organizationName,
    sessionExpired,
    signUp,
    signIn,
    signOut,
    updateProfile,
    validateSession,
    isAuthenticated: !!user,
    /** @deprecated Use useWorkflowRole() or useOrganization().workflowRole instead */
    isAdmin: profile?.role === 'super_admin',
    /** @deprecated Use useWorkflowRole() or useOrganization().workflowRole instead */
    userRole: profile?.role,
    // Inactivity timeout controls
    pauseInactivityTimer: pauseTimer,
    resumeInactivityTimer: resumeTimer,
    resetInactivityTimer: resetTimer
  }

  return (
    <AuthContext.Provider value={value}>
      {children}

      {/* Inactivity Warning Modal - only show when user is authenticated */}
      {user && (
        <InactivityWarningModal
          isOpen={showWarning}
          remainingSeconds={remainingSeconds}
          onStayLoggedIn={handleStayLoggedIn}
          onLogout={handleLogoutFromWarning}
        />
      )}
    </AuthContext.Provider>
  )
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
}
