import { useState, useEffect } from 'react'
import { 
  Building2, Users, CreditCard, Settings, 
  Loader2, Save, Upload, Trash2, UserPlus,
  Crown, Shield, User
} from 'lucide-react'
import { useOrganization } from '../../context/OrganizationContext'

/**
 * Organization Settings Page
 * Manage organization details, members, and billing
 */
export default function OrganizationSettings() {
  const {
    currentOrg,
    updateOrganization,
    getMembers,
    removeMember,
    updateMemberRole,
    inviteUser,
    isOwner,
    canManageOrg,
  } = useOrganization()

  const [activeTab, setActiveTab] = useState('general')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // General settings form
  const [generalForm, setGeneralForm] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state_province: '',
    postal_code: '',
    country: '',
    tax_id: '',
  })

  // Members list
  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)

  // Load initial data
  useEffect(() => {
    if (currentOrg) {
      setGeneralForm({
        name: currentOrg.name || '',
        email: currentOrg.email || '',
        phone: currentOrg.phone || '',
        website: currentOrg.website || '',
        address_line1: currentOrg.address_line1 || '',
        address_line2: currentOrg.address_line2 || '',
        city: currentOrg.city || '',
        state_province: currentOrg.state_province || '',
        postal_code: currentOrg.postal_code || '',
        country: currentOrg.country || 'Uganda',
        tax_id: currentOrg.tax_id || '',
      })
    }
  }, [currentOrg])

  // Load members when tab changes
  useEffect(() => {
    if (activeTab === 'members') {
      loadMembers()
    }
  }, [activeTab])

  const loadMembers = async () => {
    setLoadingMembers(true)
    const { data, error: fetchError } = await getMembers()
    if (data) {
      setMembers(data)
    }
    if (fetchError) {
      setError(fetchError)
    }
    setLoadingMembers(false)
  }

  const handleSaveGeneral = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error: updateError } = await updateOrganization(generalForm)

    if (updateError) {
      setError(updateError)
    } else {
      setSuccess('Organization settings saved successfully')
    }
    setSaving(false)
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setInviting(true)
    setError(null)

    const { error: inviteError } = await inviteUser(inviteEmail, inviteRole)

    if (inviteError) {
      setError(inviteError)
    } else {
      setSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      loadMembers()
    }
    setInviting(false)
  }

  const handleRemoveMember = async (memberId, memberName) => {
    if (!confirm(`Remove ${memberName} from this organization?`)) return

    const { error: removeError } = await removeMember(memberId)
    if (removeError) {
      setError(removeError)
    } else {
      setSuccess('Member removed successfully')
      loadMembers()
    }
  }

  const handleRoleChange = async (memberId, newRole) => {
    const { error: roleError } = await updateMemberRole(memberId, newRole)
    if (roleError) {
      setError(roleError)
    } else {
      loadMembers()
    }
  }

  const getRoleIcon = (role) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />
      case 'admin': return <Shield className="w-4 h-4 text-blue-500" />
      default: return <User className="w-4 h-4 text-gray-400" />
    }
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ]

  if (!currentOrg) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Organization Settings
              </h1>
              <p className="text-sm text-gray-500">{currentOrg.name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        <div className="flex gap-8">
          {/* Sidebar Tabs */}
          <nav className="w-48 flex-shrink-0">
            <ul className="space-y-1">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Tab Content */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {/* General Tab */}
            {activeTab === 'general' && (
              <form onSubmit={handleSaveGeneral} className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  General Settings
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      value={generalForm.name}
                      onChange={(e) => setGeneralForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={!canManageOrg}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={generalForm.email}
                      onChange={(e) => setGeneralForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={!canManageOrg}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={generalForm.phone}
                      onChange={(e) => setGeneralForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={!canManageOrg}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website
                    </label>
                    <input
                      type="url"
                      value={generalForm.website}
                      onChange={(e) => setGeneralForm(prev => ({ ...prev, website: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={!canManageOrg}
                    />
                  </div>
                </div>

                <hr className="border-gray-200" />

                <h3 className="text-md font-medium text-gray-900">Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={generalForm.address_line1}
                      onChange={(e) => setGeneralForm(prev => ({ ...prev, address_line1: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={!canManageOrg}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={generalForm.city}
                      onChange={(e) => setGeneralForm(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={!canManageOrg}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={generalForm.country}
                      onChange={(e) => setGeneralForm(prev => ({ ...prev, country: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={!canManageOrg}
                    />
                  </div>
                </div>

                {canManageOrg && (
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Changes
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* Members Tab */}
            {activeTab === 'members' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Team Members
                  </h2>
                  <span className="text-sm text-gray-500">
                    {members.length} / {currentOrg.max_users || 5} members
                  </span>
                </div>

                {/* Invite Form */}
                {canManageOrg && (
                  <form onSubmit={handleInvite} className="flex gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="submit"
                      disabled={inviting}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      Invite
                    </button>
                  </form>
                )}

                {/* Members List */}
                {loadingMembers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            {member.user?.avatar_url ? (
                              <img src={member.user.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                            ) : (
                              <User className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {member.user?.full_name || member.user?.email}
                            </p>
                            <p className="text-sm text-gray-500">{member.user?.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            {getRoleIcon(member.role)}
                            <span className="text-sm text-gray-600 capitalize">{member.role}</span>
                          </div>
                          {canManageOrg && member.role !== 'owner' && (
                            <button
                              onClick={() => handleRemoveMember(member.id, member.user?.full_name)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Billing Tab */}
            {activeTab === 'billing' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Subscription & Billing
                </h2>

                {/* Current Plan */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Current Plan</p>
                      <p className="text-xl font-semibold text-gray-900 capitalize">
                        {currentOrg.plan} Plan
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      currentOrg.status === 'active' ? 'bg-green-100 text-green-700' :
                      currentOrg.status === 'trial' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {currentOrg.status}
                    </span>
                  </div>
                </div>

                {/* Usage */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-500">Team Members</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {members.length} / {currentOrg.max_users || 5}
                    </p>
                  </div>
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-500">Projects</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      - / {currentOrg.max_projects || 10}
                    </p>
                  </div>
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-500">Requisitions/mo</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      - / {currentOrg.max_requisitions_per_month || 100}
                    </p>
                  </div>
                </div>

                {/* Upgrade CTA */}
                {currentOrg.plan !== 'enterprise' && isOwner && (
                  <div className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl text-white">
                    <h3 className="text-lg font-semibold mb-2">
                      Upgrade to unlock more features
                    </h3>
                    <p className="text-blue-100 mb-4">
                      Get unlimited users, projects, and advanced reporting.
                    </p>
                    <button className="px-4 py-2 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50">
                      View Plans
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
