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

  // Session keepalive
  const startKeepAlive = useCallback((sid) => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current)
    keepAliveRef.current = setInterval(async () => {
      const { data } = await supabase.rpc('touch_admin_session', { p_session_id: sid })
      if (!data) {
        // Session expired — force logout
        await signOut()
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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        checkPlatformAdmin(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user)
          await checkPlatformAdmin(session.user.id)
        } else {
          setUser(null)
          setPlatformAdmin(null)
          setSessionId(null)
          stopKeepAlive()
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

        // Create admin session for tracking
        try {
          const { data: sid } = await supabase.rpc('create_admin_session', {
            p_ip: null,
            p_user_agent: navigator.userAgent,
          })
          if (sid) {
            setSessionId(sid)
            startKeepAlive(sid)
          }
        } catch {
          // Session creation is best-effort
        }

        // Record login (legacy – keep for audit)
        await supabase.rpc('record_platform_admin_login').catch(() => {})
      }
    } catch {
      setPlatformAdmin(null)
    } finally {
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
