import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  MessageSquareText, ThumbsUp, MessageCircle, Filter,
  CheckCircle, Clock, XCircle, AlertCircle, Send,
} from 'lucide-react'

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: Clock },
  in_review: { label: 'In Review', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  planned: { label: 'Planned', color: 'bg-purple-100 text-purple-700', icon: MessageCircle },
  in_progress: { label: 'In Progress', color: 'bg-indigo-100 text-indigo-700', icon: Send },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: XCircle },
}

const CATEGORY_LABELS = {
  feature_request: 'Feature Request',
  bug_report: 'Bug Report',
  improvement: 'Improvement',
  question: 'Question',
  other: 'Other',
}

const PRIORITY_COLORS = {
  low: 'text-gray-500',
  medium: 'text-yellow-600',
  high: 'text-orange-600',
  critical: 'text-red-600',
}

export default function FeedbackPage() {
  const { platformAdmin } = useAuth()
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [respondingTo, setRespondingTo] = useState(null)
  const [responseText, setResponseText] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')

  useEffect(() => {
    loadFeedback()
  }, [])

  async function loadFeedback() {
    try {
      const { data, error } = await supabase
        .from('platform_feedback')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setFeedback(data || [])
    } catch (err) {
      console.error('Failed to load feedback:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRespond(fb) {
    try {
      const updates = {
        admin_response: responseText || fb.admin_response,
        responded_by: platformAdmin.id,
        responded_at: new Date().toISOString(),
      }
      if (selectedStatus) {
        updates.status = selectedStatus
      }

      const { error } = await supabase.from('platform_feedback').update(updates).eq('id', fb.id)
      if (error) throw error

      setRespondingTo(null)
      setResponseText('')
      setSelectedStatus('')
      await loadFeedback()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  async function quickStatusChange(fbId, newStatus) {
    try {
      const { error } = await supabase
        .from('platform_feedback')
        .update({ status: newStatus, responded_by: platformAdmin.id, responded_at: new Date().toISOString() })
        .eq('id', fbId)
      if (error) throw error
      await loadFeedback()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const filtered = feedback.filter((fb) => {
    const matchesStatus = statusFilter === 'all' || fb.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || fb.category === categoryFilter
    return matchesStatus && matchesCategory
  })

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
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
        >
          <option value="all">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{filtered.length} items</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = feedback.filter((f) => f.status === key).length
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              className={`p-3 rounded-lg border text-center text-sm transition-colors ${
                statusFilter === key
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
              }`}
            >
              <div className="text-lg font-bold text-gray-900 dark:text-white">{count}</div>
              <div className="text-xs text-gray-500">{cfg.label}</div>
            </button>
          )
        })}
      </div>

      {/* Feedback list */}
      <div className="space-y-3">
        {filtered.map((fb) => {
          const statusCfg = STATUS_CONFIG[fb.status] || STATUS_CONFIG.open
          const StatusIcon = statusCfg.icon
          return (
            <div
              key={fb.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{fb.title}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                      <StatusIcon className="h-3 w-3 inline mr-1" />
                      {statusCfg.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      {CATEGORY_LABELS[fb.category] || fb.category}
                    </span>
                    <span className={`text-xs font-medium ${PRIORITY_COLORS[fb.priority] || ''}`}>
                      {fb.priority}
                    </span>
                  </div>
                  {fb.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{fb.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" /> {fb.upvotes} upvotes
                    </span>
                    <span>{new Date(fb.created_at).toLocaleDateString()}</span>
                    {fb.org_id && <span className="font-mono">{fb.org_id.substring(0, 8)}...</span>}
                  </div>
                  {fb.admin_response && (
                    <div className="mt-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-100 dark:border-primary-800">
                      <div className="text-xs text-primary-600 font-medium mb-1">Admin Response</div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{fb.admin_response}</p>
                    </div>
                  )}
                </div>

                {/* Quick actions */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => { setRespondingTo(fb); setResponseText(fb.admin_response || ''); setSelectedStatus(fb.status) }}
                    className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    <MessageCircle className="h-3 w-3 inline mr-1" /> Respond
                  </button>
                  {fb.status === 'open' && (
                    <button
                      onClick={() => quickStatusChange(fb.id, 'in_review')}
                      className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Start Review
                    </button>
                  )}
                </div>
              </div>

              {/* Response form */}
              {respondingTo?.id === fb.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Write your response..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700
                             text-gray-900 dark:text-white text-sm"
                  />
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700
                               text-sm text-gray-900 dark:text-white"
                    >
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRespond(fb)}
                      className="px-4 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                    >
                      Save Response
                    </button>
                    <button
                      onClick={() => setRespondingTo(null)}
                      className="px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <MessageSquareText className="h-8 w-8 mx-auto mb-2" />
            No feedback items match your filters.
          </div>
        )}
      </div>
    </div>
  )
}
