import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Mail, Bell, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { logger } from '../../utils/logger'

const EmailNotificationSettings = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const [preferences, setPreferences] = useState({
    email_notifications_enabled: true,
    email_on_submission: true,
    email_on_review: true,
    email_on_approval: true,
    email_on_rejection: true,
    email_on_comment: true
  })

  useEffect(() => {
    loadPreferences()
  }, [user])

  const loadPreferences = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('email_notifications_enabled, email_on_submission, email_on_review, email_on_approval, email_on_rejection, email_on_comment')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (data) {
        setPreferences(data)
      }
    } catch (error) {
      logger.error('Error loading email preferences:', error)
      setMessage({ type: 'error', text: 'Failed to load preferences' })
    } finally {
      setLoading(false)
    }
  }

  const savePreferences = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('users')
        .update(preferences)
        .eq('id', user.id)

      if (error) throw error

      setMessage({ type: 'success', text: 'Email preferences saved successfully' })

      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      logger.error('Error saving email preferences:', error)
      setMessage({ type: 'error', text: 'Failed to save preferences' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (field) => {
    setPreferences(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const notificationOptions = [
    {
      id: 'email_on_submission',
      label: 'Requisition Submitted',
      description: 'Receive emails when a new requisition is submitted for review',
      enabled: preferences.email_on_submission
    },
    {
      id: 'email_on_review',
      label: 'Requisition Reviewed',
      description: 'Receive emails when a requisition is reviewed',
      enabled: preferences.email_on_review
    },
    {
      id: 'email_on_approval',
      label: 'Requisition Approved',
      description: 'Receive emails when a requisition is approved',
      enabled: preferences.email_on_approval
    },
    {
      id: 'email_on_rejection',
      label: 'Requisition Rejected',
      description: 'Receive emails when a requisition is rejected',
      enabled: preferences.email_on_rejection
    },
    {
      id: 'email_on_comment',
      label: 'New Comments',
      description: 'Receive emails when someone comments on your requisition',
      enabled: preferences.email_on_comment
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading email preferences...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Mail className="w-6 h-6 text-indigo-600" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Email Notifications</h2>
          <p className="text-sm text-gray-600">
            Manage your email notification preferences
          </p>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' :
          message.type === 'error' ? 'bg-red-50 text-red-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
           message.type === 'error' ? <XCircle className="w-5 h-5" /> :
           <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Master Toggle */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="font-semibold text-gray-900">Enable Email Notifications</h3>
              <p className="text-sm text-gray-600">
                Master switch for all email notifications
              </p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('email_notifications_enabled')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              preferences.email_notifications_enabled ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                preferences.email_notifications_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Individual Notification Settings */}
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
        {notificationOptions.map((option) => (
          <div
            key={option.id}
            className={`p-6 ${!preferences.email_notifications_enabled ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{option.label}</h4>
                <p className="text-sm text-gray-600 mt-1">{option.description}</p>
              </div>
              <button
                onClick={() => handleToggle(option.id)}
                disabled={!preferences.email_notifications_enabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed ${
                  option.enabled && preferences.email_notifications_enabled
                    ? 'bg-indigo-600'
                    : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    option.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">About Email Notifications</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Emails are sent for critical actions only</li>
              <li>You will continue to receive in-app notifications regardless of email settings</li>
              <li>Email delivery may take a few minutes</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={loadPreferences}
          disabled={saving}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset
        </button>
        <button
          onClick={savePreferences}
          disabled={saving}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </button>
      </div>
    </div>
  )
}

export default EmailNotificationSettings
