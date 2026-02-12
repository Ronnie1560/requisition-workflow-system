import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  ShieldCheck, Globe, Clock, Monitor, Trash2, Plus,
  Save, RefreshCw, AlertTriangle, CheckCircle, Loader,
} from 'lucide-react'

export default function SecuritySettingsPage() {
  const { sessionId } = useAuth()
  const [settings, setSettings] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loginAttempts, setLoginAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  // Editable fields
  const [requireIpCheck, setRequireIpCheck] = useState(false)
  const [allowedIps, setAllowedIps] = useState([])
  const [newIp, setNewIp] = useState('')
  const [sessionTimeout, setSessionTimeout] = useState(60)

  const loadData = useCallback(async () => {
    try {
      const [settingsRes, sessionsRes, attemptsRes] = await Promise.all([
        supabase.rpc('get_admin_security_settings'),
        supabase.rpc('get_admin_active_sessions'),
        supabase
          .from('platform_login_attempts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(25),
      ])

      if (settingsRes.data) {
        const s = settingsRes.data
        setSettings(s)
        setRequireIpCheck(s.require_ip_check || false)
        setAllowedIps(s.allowed_ips || [])
        setSessionTimeout(s.session_timeout_minutes || 60)
      }

      setSessions(sessionsRes.data || [])
      setLoginAttempts(attemptsRes.data || [])
    } catch (err) {
      console.error('Failed to load security data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleSaveSettings() {
    setSaving(true)
    setMessage(null)
    try {
      const { data, error } = await supabase.rpc('update_admin_security_settings', {
        p_require_ip_check: requireIpCheck,
        p_allowed_ips: allowedIps.length > 0 ? allowedIps : null,
        p_session_timeout_minutes: sessionTimeout,
      })
      if (error) throw error
      setMessage({ type: 'success', text: 'Security settings saved.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  function addIp() {
    const trimmed = newIp.trim()
    if (!trimmed) return
    // Basic validation
    if (!/^[\d.:a-fA-F/]+$/.test(trimmed)) {
      setMessage({ type: 'error', text: 'Invalid IP address format.' })
      return
    }
    if (allowedIps.includes(trimmed)) return
    setAllowedIps([...allowedIps, trimmed])
    setNewIp('')
  }

  function removeIp(ip) {
    setAllowedIps(allowedIps.filter((i) => i !== ip))
  }

  async function revokeOtherSessions() {
    if (!sessionId) return
    if (!confirm('Revoke all other admin sessions?')) return
    try {
      const { data, error } = await supabase.rpc('revoke_other_admin_sessions', {
        p_current_session_id: sessionId,
      })
      if (error) throw error
      setMessage({ type: 'success', text: `Revoked ${data} session(s).` })
      await loadData()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Account overview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary-500" /> Account Security
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Admin</span>
            <p className="font-medium text-gray-900 dark:text-white">{settings?.name || settings?.email}</p>
          </div>
          <div>
            <span className="text-gray-500">Last Login</span>
            <p className="font-medium text-gray-900 dark:text-white">
              {settings?.last_login_at ? new Date(settings.last_login_at).toLocaleString() : 'N/A'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Last Login IP</span>
            <p className="font-medium text-gray-900 dark:text-white">{settings?.last_login_ip || 'N/A'}</p>
          </div>
          <div>
            <span className="text-gray-500">Failed Attempts</span>
            <p className="font-medium text-gray-900 dark:text-white">{settings?.failed_login_count || 0}</p>
          </div>
        </div>
      </div>

      {/* Session timeout */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary-500" /> Session Settings
        </h3>
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-700 dark:text-gray-300">Session timeout (minutes):</label>
          <input
            type="number"
            min={5}
            max={1440}
            value={sessionTimeout}
            onChange={(e) => setSessionTimeout(Math.max(5, +e.target.value))}
            className="w-24 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <span className="text-xs text-gray-500">(5 – 1440)</span>
        </div>
      </div>

      {/* IP allowlist */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary-500" /> IP Allowlist
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={requireIpCheck}
              onChange={(e) => setRequireIpCheck(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-gray-300 dark:bg-gray-600 peer-checked:bg-primary-600 rounded-full
                          after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white
                          after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
          </label>
          <span className="text-sm text-gray-700 dark:text-gray-300">Enforce IP allowlist</span>
        </div>

        {requireIpCheck && (
          <>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIp())}
                placeholder="e.g. 203.0.113.50"
                className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                onClick={addIp}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            {allowedIps.length > 0 ? (
              <div className="space-y-1">
                {allowedIps.map((ip) => (
                  <div key={ip} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{ip}</span>
                    <button onClick={() => removeIp(ip)} className="text-red-500 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="inline h-3 w-3 mr-1" />
                No IPs configured. All IPs will be allowed as a safety fallback.
              </p>
            )}
          </>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm
                   hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </button>
      </div>

      {/* Active sessions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary-500" /> Active Sessions ({sessions.length})
          </h3>
          <div className="flex gap-2">
            <button onClick={loadData} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            {sessions.length > 1 && (
              <button onClick={revokeOtherSessions} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
                <Trash2 className="h-3.5 w-3.5" /> Revoke others
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
              <div>
                <p className="text-gray-900 dark:text-white font-medium truncate max-w-md">
                  {s.user_agent ? s.user_agent.substring(0, 60) + (s.user_agent.length > 60 ? '...' : '') : 'Unknown device'}
                </p>
                <p className="text-xs text-gray-500">
                  IP: {s.ip_address || 'N/A'} &middot; Started: {new Date(s.started_at).toLocaleString()}
                </p>
              </div>
              {s.id === sessionId && (
                <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                  Current
                </span>
              )}
            </div>
          ))}
          {sessions.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No active sessions.</p>}
        </div>
      </div>

      {/* Recent login attempts */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary-500" /> Recent Login Attempts
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs border-b border-gray-200 dark:border-gray-700">
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">IP</th>
                <th className="pb-2 pr-4">Result</th>
                <th className="pb-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {loginAttempts.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2 pr-4 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{a.email}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-500">{a.ip_address || '—'}</td>
                  <td className="py-2 pr-4">
                    {a.success ? (
                      <span className="text-green-600 dark:text-green-400 text-xs font-medium">Success</span>
                    ) : (
                      <span className="text-red-500 text-xs font-medium">Failed</span>
                    )}
                  </td>
                  <td className="py-2 text-xs text-gray-500 truncate max-w-xs">{a.failure_reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loginAttempts.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No login attempts recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
