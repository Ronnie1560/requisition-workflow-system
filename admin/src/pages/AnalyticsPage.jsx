import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart3, Users, FolderKanban, FileText, Building2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'

export default function AnalyticsPage() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [])

  async function loadAnalytics() {
    try {
      const { data } = await supabase.rpc('get_all_organizations_with_stats')
      if (data) setOrgs(data)
    } catch (err) {
      console.error('Failed to load analytics:', err)
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

  // Top tenants by activity
  const topByReqs = [...orgs]
    .sort((a, b) => b.requisition_count_this_month - a.requisition_count_this_month)
    .slice(0, 10)
    .map((o) => ({ name: o.name?.substring(0, 20), reqs: Number(o.requisition_count_this_month) }))

  const topByUsers = [...orgs]
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, 10)
    .map((o) => ({ name: o.name?.substring(0, 20), users: Number(o.member_count) }))

  const topByProjects = [...orgs]
    .sort((a, b) => b.project_count - a.project_count)
    .slice(0, 10)
    .map((o) => ({ name: o.name?.substring(0, 20), projects: Number(o.project_count) }))

  // Usage distribution
  const totalUsers = orgs.reduce((s, o) => s + Number(o.member_count), 0)
  const totalProjects = orgs.reduce((s, o) => s + Number(o.project_count), 0)
  const totalReqs = orgs.reduce((s, o) => s + Number(o.requisition_count_this_month), 0)
  const avgUsersPerOrg = orgs.length > 0 ? (totalUsers / orgs.length).toFixed(1) : 0
  const avgProjectsPerOrg = orgs.length > 0 ? (totalProjects / orgs.length).toFixed(1) : 0
  const avgReqsPerOrg = orgs.length > 0 ? (totalReqs / orgs.length).toFixed(1) : 0

  // Capacity utilization 
  const capacityData = orgs
    .filter((o) => o.status === 'active' || o.status === 'trial')
    .map((o) => ({
      name: o.name?.substring(0, 15),
      userUtil: o.max_users > 0 ? Math.round((Number(o.member_count) / o.max_users) * 100) : 0,
      projectUtil: o.max_projects > 0 ? Math.round((Number(o.project_count) / o.max_projects) * 100) : 0,
    }))
    .sort((a, b) => b.userUtil - a.userUtil)
    .slice(0, 10)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={Building2} label="Active Tenants" value={orgs.filter((o) => o.status === 'active' || o.status === 'trial').length} />
        <SummaryCard icon={Users} label="Avg Users/Org" value={avgUsersPerOrg} />
        <SummaryCard icon={FolderKanban} label="Avg Projects/Org" value={avgProjectsPerOrg} />
        <SummaryCard icon={FileText} label="Avg Reqs/Org (Mo)" value={avgReqsPerOrg} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top by requisitions */}
        <ChartCard title="Top Tenants by Requisitions (This Month)">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topByReqs} layout="vertical">
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="reqs" fill="#6366F1" radius={[0, 4, 4, 0]} name="Requisitions" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top by users */}
        <ChartCard title="Top Tenants by Users">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topByUsers} layout="vertical">
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="users" fill="#8B5CF6" radius={[0, 4, 4, 0]} name="Users" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top by projects */}
        <ChartCard title="Top Tenants by Projects">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topByProjects} layout="vertical">
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="projects" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Projects" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Capacity utilization */}
        <ChartCard title="Capacity Utilization (% of Limit)">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={capacityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => [`${v}%`]} />
              <Line type="monotone" dataKey="userUtil" stroke="#6366F1" name="Users %" strokeWidth={2} />
              <Line type="monotone" dataKey="projectUtil" stroke="#3B82F6" name="Projects %" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value }) {
  const IconComp = icon
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <IconComp className="h-4 w-4" /> {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4" /> {title}
      </h3>
      {children}
    </div>
  )
}
