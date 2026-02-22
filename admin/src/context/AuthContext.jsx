import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const SESSION_KEEPALIVE_MS = 5 * 60 * 1000 // 5 minutes
const ADMIN_CACHE_KEY = 'lw_admin_cache'

// Restore cached admin data for instant render (validated in background)
function getCachedAdmin() {
  try {
    const raw = sessionStorage.getItem(ADMIN_CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw)
    // Max 1 hour cache
    if (Date.now() - cached.ts > 3600_000) {
      sessionStorage.removeItem(ADMIN_CACHE_KEY)
      return null
    }
    return cached.admin
  } catch {
    return null
  }
}

function setCachedAdmin(admin) {
  try {
    if (admin) {
      sessionStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify({ admin, ts: Date.now() }))
    } else {
      sessionStorage.removeItem(ADMIN_CACHE_KEY)
    }
  } catch { /* quota */ }
}

export function AuthProvider({ children }) {
  const cachedAdmin = useRef(getCachedAdmin())
  const [user, setUser] = useState(null)
  const [platformAdmin, setPlatformAdmin] = useState(cachedAdmin.current)
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState(null)
  const keepAliveRef = useRef(null)
  const checkingRef = useRef(false)

  // Session keepalive
  const startKeepAlive = useCallback((sid) => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current)
    keepAliveRef.current = setInterval(async () => {
      try {
        const { data } = await supabase.rpc('touch_admin_session', { p_session_id: sid })
        if (data === false) {
          // Session explicitly expired — sign out
          if (keepAliveRef.current) {
            clearInterval(keepAliveRef.current)
            keepAliveRef.current = null
          }
          await supabase.auth.signOut()
        }
      } catch {
        // Network error — ignore, retry on next interval
      }
    }, SESSION_KEEPALIVE_MS)
  }, [])

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setPlatformAdmin(null)
          setCachedAdmin(null)
          setSessionId(null)
          stopKeepAlive()
          setLoading(false)
          return
        }

        if (session?.user) {
          setUser(session.user)

          // If we have a cached admin, show the app immediately
          // and revalidate in background
          if (cachedAdmin.current) {
            setPlatformAdmin(cachedAdmin.current)
            setLoading(false)
            // Background revalidation
            checkPlatformAdmin(session.user.id, true)
          } else {
            setLoading(true)
            await checkPlatformAdmin(session.user.id, false)
          }
        } else if (event === 'INITIAL_SESSION') {
          // No session on initial load
          setCachedAdmin(null)
          setPlatformAdmin(null)
          setLoading(false)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
      stopKeepAlive()
    }
  }, [stopKeepAlive])

  async function checkPlatformAdmin(userId, isBackground = false) {
    if (checkingRef.current) return
    checkingRef.current = true

    try {
      const { data, error } = await supabase
        .from('platform_admins')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        setPlatformAdmin(null)
        setCachedAdmin(null)
      } else {
        setPlatformAdmin(data)
        setCachedAdmin(data)

        // Create admin session for tracking (best-effort, don't block)
        supabase.rpc('create_admin_session', {
          p_ip: null,
          p_user_agent: navigator.userAgent,
        }).then(({ data: sid }) => {
          if (sid) {
            setSessionId(sid)
            startKeepAlive(sid)
          }
        }).catch(() => {})
      }
    } catch {
      if (!isBackground) {
        setPlatformAdmin(null)
        setCachedAdmin(null)
      }
    } finally {
      checkingRef.current = false
      if (!isBackground) setLoading(false)
    }
  }

  // Pre-login rate-limit check
  async function checkRateLimit(email) {
    const { data, error } = await supabase.rpc('check_login_rate_limit', {
      p_email: email,
      p_ip: null,
    })
    if (error) return { allowed: true } // fail-open on error
    return data
  }

  async function signIn(email, password) {
    // Check rate-limit before attempting
    const rl = await checkRateLimit(email)
    if (!rl.allowed) {
      if (rl.locked) {
        const until = rl.locked_until ? new Date(rl.locked_until).toLocaleTimeString() : 'later'
        throw new Error(`Account locked due to too many failed attempts. Try again after ${until}.`)
      }
      throw new Error('Too many login attempts. Please wait 15 minutes and try again.')
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        // Record failed attempt
        await supabase.rpc('record_login_attempt', {
          p_email: email,
          p_success: false,
          p_ip: null,
          p_user_agent: navigator.userAgent,
          p_failure_reason: error.message,
        }).catch(() => {})
        throw error
      }

      // Record successful attempt
      await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_success: true,
        p_ip: null,
        p_user_agent: navigator.userAgent,
      }).catch(() => {})

      return data
    } catch (err) {
      throw err
    }
  }

  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    if (signingOut) return // Prevent double-click
    setSigningOut(true)

    // Helper: race a promise against a timeout so sign-out never hangs
    const withTimeout = (promise, ms = 3000) =>
      Promise.race([promise, new Promise(resolve => setTimeout(resolve, ms))])

    try {
      // Invalidate admin session (best-effort, 3s max)
      if (sessionId) {
        await withTimeout(
          supabase.rpc('invalidate_admin_session', { p_session_id: sessionId }).catch(() => {})
        )
      }
      stopKeepAlive()
      setSessionId(null)
      setCachedAdmin(null)
      cachedAdmin.current = null

      // Clear Supabase auth (3s max)
      await withTimeout(supabase.auth.signOut().catch(() => {}))
    } catch {
      // Swallow — we always redirect below
    } finally {
      // Always clear auth state, even if network calls fail
      setUser(null)
      setPlatformAdmin(null)
      setSigningOut(false)
      // Force redirect to login — don't rely solely on reactive state
      window.location.href = '/login'
    }
  }

  const value = {
    user,
    platformAdmin,
    loading,
    signingOut,
    sessionId,
    isAuthenticated: !!user && !!platformAdmin,
    signIn,
    signOut,
    checkRateLimit,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
