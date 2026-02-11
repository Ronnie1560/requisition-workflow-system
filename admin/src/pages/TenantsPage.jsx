import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, Building2, Filter, ChevronRight } from 'lucide-react'

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  trial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
}

const PLAN_COLORS = {
  free: '#9CA3AF',
  starter: '#3B82F6',
  professional: '#8B5CF6',
  enterprise: '#F59E0B',
}

export default function TenantsPage() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')

  useEffect(() => {
    loadOrganizations()
  }, [])

  async function loadOrganizations() {
    try {
      const { data, error } = await supabase.rpc('get_all_organizations_with_stats')
      if (error) throw error
      setOrgs(data || [])
    } catch (err) {
      console.error('Failed to load organizations:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = orgs.filter((org) => {
    const matchesSearch = !search ||
      org.name?.toLowerCase().includes(search.toLowerCase()) ||
      org.slug?.toLowerCase().includes(search.toLowerCase()) ||
      org.email?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || org.status === statusFilter
    const matchesPlan = planFilter === 'all' || org.plan === planFilter
    return matchesSearch && matchesStatus && matchesPlan
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
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenants..."
            className="w-full pl-10 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                     rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                   rounded-lg text-sm text-gray-900 dark:text-white"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                   rounded-lg text-sm text-gray-900 dark:text-white"
        >
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        <Filter className="inline h-4 w-4 mr-1" />
        {filtered.length} of {orgs.length} tenants
      </div>

      {/* Tenant cards */}
      <div className="grid gap-3">
        {filtered.map((org) => (
          <Link
            key={org.id}
            to={`/tenants/${org.id}`}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
                     p-4 hover:border-primary-300 dark:hover:border-primary-600 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {org.name}
                  </h3>
                  <span
                    className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${PLAN_COLORS[org.plan] || '#666'}20`,
                      color: PLAN_COLORS[org.plan] || '#666',
                    }}
                  >
                    {org.plan}
                  </span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[org.status]}`}>
                    {org.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span>{org.member_count} users</span>
                  <span>{org.project_count} projects</span>
                  <span>{org.requisition_count_this_month} reqs/mo</span>
                  {org.email && <span>{org.email}</span>}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
            </div>
          </Link>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No tenants match your filters.
          </div>
        )}
      </div>
    </div>
  )
}
