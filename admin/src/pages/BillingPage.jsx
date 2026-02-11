import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DollarSign, TrendingUp, CreditCard, AlertCircle, ExternalLink } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const PLAN_PRICES = { free: 0, starter: 800, professional: 1200, enterprise: 6000 }

export default function BillingPage() {
  const [orgs, setOrgs] = useState([])
  const [billingHistory, setBillingHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBillingData()
  }, [])

  async function loadBillingData() {
    try {
      const [orgsRes, historyRes] = await Promise.all([
        supabase.rpc('get_all_organizations_with_stats'),
        supabase.from('billing_history').select('*').order('created_at', { ascending: false }).limit(50),
      ])
      if (orgsRes.data) setOrgs(orgsRes.data)
      if (historyRes.data) setBillingHistory(historyRes.data)
    } catch (err) {
      console.error('Failed to load billing data:', err)
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

  const paidOrgs = orgs.filter((o) => o.plan !== 'free' && o.status === 'active')
  const totalMRR = paidOrgs.reduce((sum, o) => sum + (PLAN_PRICES[o.plan] || 0), 0)
  const totalARR = totalMRR * 12

  // Revenue by plan
  const revenueByPlan = Object.entries(PLAN_PRICES)
    .filter(([plan]) => plan !== 'free')
    .map(([plan, price]) => ({
      name: plan.charAt(0).toUpperCase() + plan.slice(1),
      revenue: paidOrgs.filter((o) => o.plan === plan).length * price / 100,
      count: paidOrgs.filter((o) => o.plan === plan).length,
    }))

  return (
    <div className="space-y-6">
      {/* Revenue stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Monthly Revenue (MRR)" value={`$${(totalMRR / 100).toFixed(0)}`} color="text-emerald-500" />
        <StatCard icon={TrendingUp} label="Annual Revenue (ARR)" value={`$${(totalARR / 100).toFixed(0)}`} color="text-blue-500" />
        <StatCard icon={CreditCard} label="Paying Customers" value={paidOrgs.length} color="text-purple-500" />
        <StatCard icon={AlertCircle} label="Free Tier" value={orgs.filter((o) => o.plan === 'free').length} color="text-gray-500" />
      </div>

      {/* Revenue chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Revenue by Plan (Monthly)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={revenueByPlan}>
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(v) => `$${v}`} />
            <Tooltip formatter={(v) => [`$${v}`, 'Revenue']} />
            <Bar dataKey="revenue" fill="#6366F1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Paying customers table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Paying Customers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Monthly</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Stripe</th>
              </tr>
            </thead>
            <tbody>
              {paidOrgs.map((org) => (
                <tr key={org.id} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{org.name}</td>
                  <td className="px-4 py-3 capitalize">{org.plan}</td>
                  <td className="px-4 py-3 text-emerald-600 font-medium">${(PLAN_PRICES[org.plan] / 100).toFixed(0)}</td>
                  <td className="px-4 py-3">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      {org.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {org.stripe_customer_id ? (
                      <a
                        href={`https://dashboard.stripe.com/customers/${org.stripe_customer_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline flex items-center gap-1"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent billing events */}
      {billingHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Billing Events</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-80 overflow-y-auto">
            {billingHistory.map((event) => (
              <div key={event.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {event.event_type?.replace(/_/g, ' ')}
                  </span>
                  {event.plan_to && (
                    <span className="ml-2 text-xs text-gray-500">
                      {event.plan_from && `${event.plan_from} → `}{event.plan_to}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  {event.amount_cents > 0 && (
                    <span className="text-sm font-medium text-emerald-600">
                      ${(event.amount_cents / 100).toFixed(2)}
                    </span>
                  )}
                  <div className="text-xs text-gray-400">
                    {new Date(event.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  const IconComp = icon
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <IconComp className={`h-4 w-4 ${color}`} />
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
    </div>
  )
}
