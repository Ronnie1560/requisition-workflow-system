import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getAllFeedback, submitFeedback, toggleVote } from '../../services/api/feedback'
import {
  MessageSquareText,
  ThumbsUp,
  Send,
  Plus,
  X,
  Filter,
  Clock,
  AlertCircle,
  MessageCircle,
  CheckCircle,
  XCircle,
  Bug,
  Lightbulb,
  HelpCircle,
  Sparkles,
  MoreHorizontal,
  ChevronUp,
} from 'lucide-react'

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: Clock },
  in_review: { label: 'In Review', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  planned: { label: 'Planned', color: 'bg-purple-100 text-purple-700', icon: MessageCircle },
  in_progress: { label: 'In Progress', color: 'bg-indigo-100 text-indigo-700', icon: Send },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: XCircle },
}

const CATEGORY_CONFIG = {
  feature_request: { label: 'Feature Request', icon: Lightbulb, color: 'bg-amber-100 text-amber-700' },
  bug_report: { label: 'Bug Report', icon: Bug, color: 'bg-red-100 text-red-700' },
  improvement: { label: 'Improvement', icon: Sparkles, color: 'bg-cyan-100 text-cyan-700' },
  question: { label: 'Question', icon: HelpCircle, color: 'bg-green-100 text-green-700' },
  other: { label: 'Other', icon: MoreHorizontal, color: 'bg-gray-100 text-gray-700' },
}

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'text-gray-500 bg-gray-50 border-gray-200' },
  medium: { label: 'Medium', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  high: { label: 'High', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  critical: { label: 'Critical', color: 'text-red-700 bg-red-50 border-red-200' },
}

export default function FeedbackPage() {
  const { user } = useAuth()
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [votingId, setVotingId] = useState(null)

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'feature_request',
    priority: 'medium',
  })

  const loadFeedback = useCallback(async () => {
    try {
      const { data, error } = await getAllFeedback()
      if (error) throw error
      setFeedback(data || [])
    } catch (err) {
      console.error('Failed to load feedback:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFeedback()
  }, [loadFeedback])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return

    setSubmitting(true)
    try {
      const { error } = await submitFeedback(form)
      if (error) throw error

      setForm({ title: '', description: '', category: 'feature_request', priority: 'medium' })
      setShowForm(false)
      await loadFeedback()
    } catch (err) {
      alert('Failed to submit feedback: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVote = async (feedbackId) => {
    setVotingId(feedbackId)
    try {
      const { error } = await toggleVote(feedbackId)
      if (error) throw error
      await loadFeedback()
    } catch (err) {
      console.error('Vote failed:', err)
    } finally {
      setVotingId(null)
    }
  }

  const hasVoted = (fb) => {
    return fb.votes?.some((v) => v.user_id === user?.id)
  }

  // Filter and sort
  const filtered = feedback
    .filter((fb) => {
      if (statusFilter !== 'all' && fb.status !== statusFilter) return false
      if (categoryFilter !== 'all' && fb.category !== categoryFilter) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
      if (sortBy === 'most_voted') return (b.upvotes || 0) - (a.upvotes || 0)
      return 0
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquareText className="h-7 w-7 text-indigo-600" />
            Feedback & Suggestions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Help us improve — share ideas, report bugs, or request features
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Submit Feedback'}
        </button>
      </div>

      {/* Submit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900">New Feedback</h3>

          {/* Category selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon
                const isSelected = form.category === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, category: key })}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      isSelected
                        ? `${cfg.color} border-current ring-2 ring-offset-1 ring-current/20`
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="feedback-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="feedback-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Brief summary of your feedback..."
              required
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="feedback-desc" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="feedback-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Provide more details, steps to reproduce (for bugs), or examples..."
              rows={4}
              maxLength={2000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm resize-y"
            />
            <p className="text-xs text-gray-400 mt-1">{form.description.length}/2000 characters</p>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <div className="flex gap-2">
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm({ ...form, priority: key })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    form.priority === key
                      ? `${cfg.color} ring-2 ring-offset-1 ring-current/20`
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting || !form.title.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filters & Sort */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        >
          <option value="all">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="most_voted">Most Voted</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Status Summary Bar */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = feedback.filter((f) => f.status === key).length
          const Icon = cfg.icon
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              className={`flex flex-col items-center p-3 rounded-lg border text-center transition-colors ${
                statusFilter === key
                  ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <Icon className={`h-4 w-4 mb-1 ${statusFilter === key ? 'text-indigo-600' : 'text-gray-400'}`} />
              <span className="text-lg font-bold text-gray-900">{count}</span>
              <span className="text-xs text-gray-500">{cfg.label}</span>
            </button>
          )
        })}
      </div>

      {/* Feedback List */}
      <div className="space-y-3">
        {filtered.map((fb) => {
          const statusCfg = STATUS_CONFIG[fb.status] || STATUS_CONFIG.open
          const categoryCfg = CATEGORY_CONFIG[fb.category] || CATEGORY_CONFIG.other
          const priorityCfg = PRIORITY_CONFIG[fb.priority] || PRIORITY_CONFIG.medium
          const StatusIcon = statusCfg.icon
          const CategoryIcon = categoryCfg.icon
          const voted = hasVoted(fb)
          const isVoting = votingId === fb.id

          return (
            <div
              key={fb.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex">
                {/* Vote column */}
                <div className="flex flex-col items-center py-4 px-3 border-r border-gray-100">
                  <button
                    onClick={() => handleVote(fb.id)}
                    disabled={isVoting}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all ${
                      voted
                        ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                        : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-50'
                    } ${isVoting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    title={voted ? 'Remove vote' : 'Upvote'}
                  >
                    <ChevronUp className={`h-5 w-5 ${voted ? 'text-indigo-600' : ''}`} />
                    <span className={`text-sm font-bold ${voted ? 'text-indigo-600' : 'text-gray-600'}`}>
                      {fb.upvotes || 0}
                    </span>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-4 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-base">{fb.title}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusCfg.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${categoryCfg.color}`}>
                      <CategoryIcon className="h-3 w-3" />
                      {categoryCfg.label}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${priorityCfg.color}`}>
                      {priorityCfg.label}
                    </span>
                  </div>

                  {fb.description && (
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed whitespace-pre-wrap">
                      {fb.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                    <span>{new Date(fb.created_at).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" /> {fb.upvotes || 0} vote{fb.upvotes !== 1 ? 's' : ''}
                    </span>
                    {fb.submitted_by === user?.id && (
                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs font-medium">
                        Your feedback
                      </span>
                    )}
                  </div>

                  {/* Admin response */}
                  {fb.admin_response && (
                    <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <MessageCircle className="h-3.5 w-3.5 text-indigo-600" />
                        <span className="text-xs font-semibold text-indigo-700">Admin Response</span>
                        {fb.responded_at && (
                          <span className="text-xs text-indigo-400">
                            &mdash; {new Date(fb.responded_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {fb.admin_response}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <MessageSquareText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-600 mb-1">No feedback yet</h3>
            <p className="text-sm text-gray-400 mb-4">
              {statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'No items match your current filters'
                : 'Be the first to share your thoughts and ideas!'}
            </p>
            {statusFilter === 'all' && categoryFilter === 'all' && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Submit Feedback
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
