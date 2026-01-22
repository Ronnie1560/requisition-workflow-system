import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'
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
    
    // Clear profile cache from localStorage
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('profile_') || key.startsWith('org_')) {
          localStorage.removeItem(key)
        }
      })
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  /**
   * Force logout and redirect to login page
   */
  const forceLogout = useCallback(async (reason = 'session_expired') => {
    logger.warn(`Force logout triggered: ${reason}`)
    
    // Clear state immediately
    clearAuthState()
    setSessionExpired(true)
    
    // Sign out from Supabase
    try {
      await supabase.auth.signOut()
    } catch (error) {
      logger.error('Error during force signOut:', error)
    }
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
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
    isAdmin: profile?.role === 'super_admin',
    userRole: profile?.role,
    // Inactivity timeout controls
    pauseInactivityTimer: pauseTimer,
    resumeInactivityTimer: resumeTimer,
    resetInactivityTimer: resetTimer
  }

  return (
    <AuthContext.Provider value={value}>
      {children}

      {/* Inactivity Warning Modal */}
      <InactivityWarningModal
        isOpen={showWarning}
        remainingSeconds={remainingSeconds}
        onStayLoggedIn={handleStayLoggedIn}
        onLogout={handleLogoutFromWarning}
      />
    </AuthContext.Provider>
  )
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
}
