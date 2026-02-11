import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Megaphone, Plus, Send, Trash2, Edit3, Eye, EyeOff } from 'lucide-react'

const TYPE_COLORS = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-yellow-100 text-yellow-700',
  maintenance: 'bg-orange-100 text-orange-700',
  feature: 'bg-green-100 text-green-700',
  critical: 'bg-red-100 text-red-700',
}

export default function AnnouncementsPage() {
  const { platformAdmin } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', content: '', announcement_type: 'info', target_audience: 'all', expires_at: '' })

  useEffect(() => {
    loadAnnouncements()
  }, [])

  async function loadAnnouncements() {
    try {
      const { data, error } = await supabase
        .from('platform_announcements')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setAnnouncements(data || [])
    } catch (err) {
      console.error('Failed to load announcements:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      const payload = {
        ...form,
        expires_at: form.expires_at || null,
        created_by: platformAdmin.id,
      }

      if (editing) {
        const { error } = await supabase.from('platform_announcements').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('platform_announcements').insert(payload)
        if (error) throw error
      }

      setShowForm(false)
      setEditing(null)
      setForm({ title: '', content: '', announcement_type: 'info', target_audience: 'all', expires_at: '' })
      await loadAnnouncements()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  async function togglePublish(ann) {
    try {
      const { error } = await supabase
        .from('platform_announcements')
        .update({
          is_published: !ann.is_published,
          published_at: !ann.is_published ? new Date().toISOString() : null,
        })
        .eq('id', ann.id)
      if (error) throw error
      await loadAnnouncements()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this announcement?')) return
    try {
      const { error } = await supabase.from('platform_announcements').delete().eq('id', id)
      if (error) throw error
      await loadAnnouncements()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  function startEdit(ann) {
    setForm({
      title: ann.title,
      content: ann.content,
      announcement_type: ann.announcement_type,
      target_audience: ann.target_audience,
      expires_at: ann.expires_at ? ann.expires_at.split('T')[0] : '',
    })
    setEditing(ann)
    setShowForm(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{announcements.length} announcements</span>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ title: '', content: '', announcement_type: 'info', target_audience: 'all', expires_at: '' }) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
        >
          <Plus className="h-4 w-4" /> New Announcement
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {editing ? 'Edit Announcement' : 'New Announcement'}
          </h3>
          <input
            type="text"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700
                     text-gray-900 dark:text-white"
          />
          <textarea
            placeholder="Content..."
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700
                     text-gray-900 dark:text-white"
          />
          <div className="grid grid-cols-3 gap-4">
            <select
              value={form.announcement_type}
              onChange={(e) => setForm({ ...form, announcement_type: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700
                       text-gray-900 dark:text-white text-sm"
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="maintenance">Maintenance</option>
              <option value="feature">Feature</option>
              <option value="critical">Critical</option>
            </select>
            <select
              value={form.target_audience}
              onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700
                       text-gray-900 dark:text-white text-sm"
            >
              <option value="all">All Users</option>
              <option value="free">Free Tier</option>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
              <option value="trial">Trial</option>
            </select>
            <input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700
                       text-gray-900 dark:text-white text-sm"
              placeholder="Expires at"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
              {editing ? 'Update' : 'Create'}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {announcements.map((ann) => (
          <div
            key={ann.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-gray-400" />
                  <h4 className="font-semibold text-gray-900 dark:text-white">{ann.title}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[ann.announcement_type] || 'bg-gray-100 text-gray-700'}`}>
                    {ann.announcement_type}
                  </span>
                  <span className="text-xs text-gray-500">→ {ann.target_audience}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ann.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {ann.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{ann.content}</p>
                <div className="text-xs text-gray-400 mt-2">
                  Created {new Date(ann.created_at).toLocaleDateString()}
                  {ann.expires_at && ` · Expires ${new Date(ann.expires_at).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-4">
                <button onClick={() => togglePublish(ann)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title={ann.is_published ? 'Unpublish' : 'Publish'}>
                  {ann.is_published ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-green-600" />}
                </button>
                <button onClick={() => startEdit(ann)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Edit3 className="h-4 w-4 text-gray-500" />
                </button>
                <button onClick={() => handleDelete(ann.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {announcements.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Megaphone className="h-8 w-8 mx-auto mb-2" />
            No announcements yet. Create one to communicate with your tenants.
          </div>
        )}
      </div>
    </div>
  )
}
