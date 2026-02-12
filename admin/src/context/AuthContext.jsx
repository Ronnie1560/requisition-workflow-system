import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const SESSION_KEEPALIVE_MS = 5 * 60 * 1000 // 5 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [platformAdmin, setPlatformAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState(null)
  const keepAliveRef = useRef(null)
  const checkingRef = useRef(false) // prevent duplicate checkPlatformAdmin calls

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
    // Use onAuthStateChange as the single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setPlatformAdmin(null)
          setSessionId(null)
          stopKeepAlive()
          setLoading(false)
          return
        }

        if (session?.user) {
          // Set loading BEFORE setting user to prevent the race condition
          // where ProtectedRoute sees user!=null, platformAdmin=null, loading=false
          setLoading(true)
          setUser(session.user)
          await checkPlatformAdmin(session.user.id)
        } else if (event === 'INITIAL_SESSION') {
          // No session on initial load
          setLoading(false)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
      stopKeepAlive()
    }
  }, [stopKeepAlive])

  async function checkPlatformAdmin(userId) {
    // Prevent duplicate concurrent checks
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
      } else {
        setPlatformAdmin(data)

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
      setPlatformAdmin(null)
    } finally {
      checkingRef.current = false
      setLoading(false)
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

  async function signOut() {
    // Invalidate admin session
    if (sessionId) {
      await supabase.rpc('invalidate_admin_session', { p_session_id: sessionId }).catch(() => {})
    }
    stopKeepAlive()
    setSessionId(null)
    await supabase.auth.signOut()
    setUser(null)
    setPlatformAdmin(null)
  }

  const value = {
    user,
    platformAdmin,
    loading,
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
