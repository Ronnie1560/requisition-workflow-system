import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  Building2,
  Users,
  FolderKanban,
  FileText,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const PLAN_COLORS = {
  free: '#9CA3AF',
  starter: '#3B82F6',
  professional: '#8B5CF6',
  enterprise: '#F59E0B',
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentOrgs, setRecentOrgs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const [statsRes, orgsRes] = await Promise.all([
        supabase.rpc('get_platform_stats'),
        supabase.rpc('get_all_organizations_with_stats'),
      ])

      if (statsRes.data) setStats(statsRes.data)
      if (orgsRes.data) setRecentOrgs(orgsRes.data.slice(0, 5))
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-gray-500">
        Failed to load platform statistics.
      </div>
    )
  }

  const statCards = [
    { label: 'Total Organizations', value: stats.total_organizations, icon: Building2, color: 'text-blue-500' },
    { label: 'Active Organizations', value: stats.active_organizations, icon: TrendingUp, color: 'text-green-500' },
    { label: 'Trial Organizations', value: stats.trial_organizations, icon: Clock, color: 'text-yellow-500' },
    { label: 'Suspended', value: stats.suspended_organizations, icon: AlertTriangle, color: 'text-red-500' },
    { label: 'Total Users', value: stats.total_users, icon: Users, color: 'text-indigo-500' },
    { label: 'Total Projects', value: stats.total_projects, icon: FolderKanban, color: 'text-purple-500' },
    { label: 'Requisitions (Month)', value: stats.requisitions_this_month, icon: FileText, color: 'text-cyan-500' },
    { label: 'Monthly Revenue', value: `$${(stats.revenue_monthly_cents / 100).toFixed(0)}`, icon: DollarSign, color: 'text-emerald-500' },
  ]

  const planData = Object.entries(stats.plans || {}).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: count,
    fill: PLAN_COLORS[name] || '#666',
  }))

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${card.color}`} />
                <span className="text-sm text-gray-500 dark:text-gray-400">{card.label}</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                {card.value}
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Plan Distribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={planData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {planData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Recent organizations bar chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Recent Tenants — Users
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={recentOrgs}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="member_count" fill="#6366F1" radius={[4, 4, 0, 0]} name="Members" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent tenants table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Recent Tenants
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Users</th>
                <th className="px-4 py-3 font-medium">Reqs/mo</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {recentOrgs.map((org) => (
                <tr
                  key={org.id}
                  className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {org.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${PLAN_COLORS[org.plan] || '#666'}20`, color: PLAN_COLORS[org.plan] || '#666' }}
                    >
                      {org.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={org.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{org.member_count}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{org.requisition_count_this_month}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(org.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    trial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.cancelled}`}>
      {status}
    </span>
  )
}
