import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ArrowLeft, Building2, Users, FolderKanban, FileText,
  CreditCard, AlertTriangle, CheckCircle, Ban, Play,
  Settings, ExternalLink,
} from 'lucide-react'

export default function TenantDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [org, setOrg] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)

  useEffect(() => {
    loadTenantDetails()
  }, [id])

  async function loadTenantDetails() {
    try {
      const [orgsRes, membersRes] = await Promise.all([
        supabase.rpc('get_all_organizations_with_stats'),
        supabase.from('organization_members').select(`
          id, role, workflow_role, is_active, accepted_at, created_at,
          user_id
        `).eq('organization_id', id),
      ])

      if (orgsRes.data) {
        const found = orgsRes.data.find((o) => o.id === id)
        setOrg(found || null)
      }
      if (membersRes.data) setMembers(membersRes.data)
    } catch (err) {
      console.error('Failed to load tenant:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(newStatus) {
    if (!confirm(`Are you sure you want to set this organization to "${newStatus}"?`)) return
    setActionLoading(true)
    try {
      const { error } = await supabase.rpc('platform_update_org_status', {
        target_org_id: id,
        new_status: newStatus,
      })
      if (error) throw error
      await loadTenantDetails()
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePlanChange(newPlan, maxUsers, maxProjects, maxReqs) {
    setActionLoading(true)
    try {
      const { error } = await supabase.rpc('platform_update_org_plan', {
        target_org_id: id,
        new_plan: newPlan,
        new_max_users: maxUsers,
        new_max_projects: maxProjects,
        new_max_reqs: maxReqs,
      })
      if (error) throw error
      setShowPlanModal(false)
      await loadTenantDetails()
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Organization not found.</p>
        <button onClick={() => navigate('/tenants')} className="mt-4 text-primary-600 hover:underline">
          Back to tenants
        </button>
      </div>
    )
  }

  const statusActions = {
    active: [
      { label: 'Suspend', status: 'suspended', icon: Ban, color: 'text-red-600 hover:bg-red-50' },
    ],
    trial: [
      { label: 'Activate', status: 'active', icon: CheckCircle, color: 'text-green-600 hover:bg-green-50' },
      { label: 'Suspend', status: 'suspended', icon: Ban, color: 'text-red-600 hover:bg-red-50' },
    ],
    suspended: [
      { label: 'Reactivate', status: 'active', icon: Play, color: 'text-green-600 hover:bg-green-50' },
      { label: 'Cancel', status: 'cancelled', icon: AlertTriangle, color: 'text-red-600 hover:bg-red-50' },
    ],
    cancelled: [
      { label: 'Reactivate', status: 'active', icon: Play, color: 'text-green-600 hover:bg-green-50' },
    ],
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/tenants')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{org.name}</h2>
          <p className="text-sm text-gray-500">{org.slug} &middot; {org.email || 'No email'}</p>
        </div>
        <div className="flex items-center gap-2">
          {(statusActions[org.status] || []).map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.status}
                onClick={() => handleStatusChange(action.status)}
                disabled={actionLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200
                  dark:border-gray-700 ${action.color} disabled:opacity-50`}
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </button>
            )
          })}
          <button
            onClick={() => setShowPlanModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200
              dark:border-gray-700 text-primary-600 hover:bg-primary-50"
          >
            <Settings className="h-4 w-4" />
            Change Plan
          </button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard icon={CreditCard} label="Plan" value={org.plan} />
        <InfoCard icon={Users} label="Members" value={`${org.member_count} / ${org.max_users}`} />
        <InfoCard icon={FolderKanban} label="Projects" value={`${org.project_count} / ${org.max_projects}`} />
        <InfoCard icon={FileText} label="Reqs (Month)" value={`${org.requisition_count_this_month} / ${org.max_requisitions_per_month}`} />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organization info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Organization Details
          </h3>
          <dl className="space-y-3 text-sm">
            <DetailRow label="Status" value={<StatusBadge status={org.status} />} />
            <DetailRow label="Created" value={new Date(org.created_at).toLocaleDateString()} />
            {org.trial_ends_at && <DetailRow label="Trial Ends" value={new Date(org.trial_ends_at).toLocaleDateString()} />}
            {org.subscription_ends_at && <DetailRow label="Subscription Ends" value={new Date(org.subscription_ends_at).toLocaleDateString()} />}
            {org.stripe_customer_id && (
              <DetailRow
                label="Stripe"
                value={
                  <a
                    href={`https://dashboard.stripe.com/customers/${org.stripe_customer_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline flex items-center gap-1"
                  >
                    {org.stripe_customer_id.substring(0, 18)}...
                    <ExternalLink className="h-3 w-3" />
                  </a>
                }
              />
            )}
          </dl>
        </div>

        {/* Members list */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="h-4 w-4" /> Members ({members.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0"
              >
                <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {m.user_id.substring(0, 8)}...
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    m.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                    m.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {m.role}
                  </span>
                  {m.workflow_role && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.workflow_role === 'approver' ? 'bg-green-100 text-green-700' :
                      m.workflow_role === 'reviewer' ? 'bg-yellow-100 text-yellow-700' :
                      m.workflow_role === 'finance' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {m.workflow_role}
                    </span>
                  )}
                  {!m.is_active && (
                    <span className="text-xs text-red-500">Inactive</span>
                  )}
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No members found.</p>
            )}
          </div>
        </div>
      </div>

      {/* Plan change modal */}
      {showPlanModal && (
        <PlanChangeModal
          currentPlan={org.plan}
          currentLimits={{ max_users: org.max_users, max_projects: org.max_projects, max_reqs: org.max_requisitions_per_month }}
          onSubmit={handlePlanChange}
          onClose={() => setShowPlanModal(false)}
          loading={actionLoading}
        />
      )}
    </div>
  )
}

function InfoCard({ icon, label, value }) {
  const IconComp = icon
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <IconComp className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white capitalize">
        {value}
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-gray-900 dark:text-white font-medium">{value}</dd>
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = {
    active: 'bg-green-100 text-green-700',
    trial: 'bg-yellow-100 text-yellow-700',
    suspended: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.cancelled}`}>
      {status}
    </span>
  )
}

function PlanChangeModal({ currentPlan, currentLimits, onSubmit, onClose, loading }) {
  const [plan, setPlan] = useState(currentPlan)
  const [maxUsers, setMaxUsers] = useState(currentLimits.max_users)
  const [maxProjects, setMaxProjects] = useState(currentLimits.max_projects)
  const [maxReqs, setMaxReqs] = useState(currentLimits.max_reqs)

  const planDefaults = {
    free: { users: 5, projects: 3, reqs: 50 },
    starter: { users: 10, projects: 10, reqs: 200 },
    professional: { users: 25, projects: 50, reqs: 1000 },
    enterprise: { users: 100, projects: 200, reqs: 10000 },
  }

  function applyDefaults(p) {
    const d = planDefaults[p]
    if (d) {
      setMaxUsers(d.users)
      setMaxProjects(d.projects)
      setMaxReqs(d.reqs)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Change Plan</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan</label>
            <select
              value={plan}
              onChange={(e) => { setPlan(e.target.value); applyDefaults(e.target.value) }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Users</label>
              <input type="number" value={maxUsers} onChange={(e) => setMaxUsers(+e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Projects</label>
              <input type="number" value={maxProjects} onChange={(e) => setMaxProjects(+e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Reqs/mo</label>
              <input type="number" value={maxReqs} onChange={(e) => setMaxReqs(+e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(plan, maxUsers, maxProjects, maxReqs)}
            disabled={loading}
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
