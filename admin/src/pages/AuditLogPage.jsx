import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ScrollText, Filter } from 'lucide-react'

export default function AuditLogPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState('all')

  useEffect(() => {
    loadAuditLog()
  }, [])

  async function loadAuditLog() {
    try {
      const { data, error } = await supabase
        .from('platform_audit_log')
        .select(`
          id, action, entity_type, entity_id, details, created_at,
          platform_admins ( name, email )
        `)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setLogs(data || [])
    } catch (err) {
      console.error('Failed to load audit log:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = logs.filter((log) => {
    return entityFilter === 'all' || log.entity_type === entityFilter
  })

  const entityTypes = [...new Set(logs.map((l) => l.entity_type))].sort()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                   rounded-lg text-sm text-gray-900 dark:text-white"
        >
          <option value="all">All Entities</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{filtered.length} entries</span>
      </div>

      {/* Log entries */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ScrollText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            No audit log entries yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {filtered.map((log) => (
              <div key={log.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {log.action}
                    </span>
                    <span className="text-sm text-gray-900 dark:text-white font-medium">
                      {log.entity_type}
                    </span>
                    {log.entity_id && (
                      <span className="text-xs text-gray-400 font-mono">{log.entity_id.substring(0, 8)}...</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">{log.platform_admins?.name || log.platform_admins?.email}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="mt-1 text-xs text-gray-500 font-mono bg-gray-50 dark:bg-gray-900/50 p-2 rounded">
                    {JSON.stringify(log.details)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
