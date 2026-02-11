import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { PLAN_TIERS, PLAN_ORDER, formatPrice, formatLimit } from '../../config/plans'
import { createCheckoutSession } from '../../services/api/billing'
import {
  Check,
  X,
  Crown,
  Zap,
  ArrowLeft,
  Loader2,
  Sparkles,
  Shield
} from 'lucide-react'

const PricingPlans = () => {
  const [billingInterval, setBillingInterval] = useState('monthly')
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [error, setError] = useState(null)
  const { currentOrg, isOwner } = useOrganization()
  const navigate = useNavigate()

  const currentPlan = currentOrg?.plan || 'free'

  const handleSelectPlan = async (planId) => {
    if (planId === 'free' || planId === currentPlan) return
    if (!isOwner) {
      setError('Only the organization owner can change the subscription plan.')
      return
    }

    const plan = PLAN_TIERS[planId]
    const priceId = billingInterval === 'yearly'
      ? plan.stripePriceIdYearly
      : plan.stripePriceIdMonthly

    if (!priceId || priceId.startsWith('STRIPE_')) {
      setError('Stripe is not yet configured. Please contact support to upgrade your plan.')
      return
    }

    setLoadingPlan(planId)
    setError(null)

    const { data, error: checkoutError } = await createCheckoutSession(
      priceId,
      currentOrg.id,
      billingInterval
    )

    if (checkoutError) {
      setError(checkoutError)
      setLoadingPlan(null)
      return
    }

    // Redirect to Stripe Checkout
    if (data?.url) {
      window.location.href = data.url
    }
    setLoadingPlan(null)
  }

  const getButtonLabel = (planId) => {
    if (planId === currentPlan) return 'Current Plan'
    if (PLAN_ORDER.indexOf(planId) < PLAN_ORDER.indexOf(currentPlan)) return 'Downgrade'
    return 'Upgrade'
  }

  const getButtonStyle = (planId, highlighted) => {
    if (planId === currentPlan) {
      return 'bg-gray-100 text-gray-500 cursor-default'
    }
    if (highlighted) {
      return 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
    }
    return 'bg-white text-gray-900 border border-gray-300 hover:border-blue-400 hover:bg-blue-50'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings/organization?tab=billing')}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Choose Your Plan</h1>
              <p className="text-gray-500 mt-1">
                Select the plan that best fits your organization&apos;s needs
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Error banner */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Billing interval toggle */}
        <div className="flex justify-center mb-12">
          <div className="bg-white border border-gray-200 rounded-xl p-1 flex">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                billingInterval === 'monthly'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billingInterval === 'yearly'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Yearly
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                billingInterval === 'yearly'
                  ? 'bg-blue-500 text-white'
                  : 'bg-green-100 text-green-700'
              }`}>
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
          {PLAN_ORDER.map((planId) => {
            const plan = PLAN_TIERS[planId]
            const isCurrentPlan = planId === currentPlan
            const price = billingInterval === 'yearly' ? plan.priceYearly : plan.priceMonthly
            const monthlyEquiv = billingInterval === 'yearly' ? Math.round(plan.priceYearly / 12 * 100) / 100 : plan.priceMonthly

            return (
              <div
                key={planId}
                className={`relative bg-white rounded-2xl border-2 transition-all ${
                  plan.highlighted
                    ? 'border-blue-500 shadow-xl shadow-blue-100 scale-[1.02]'
                    : isCurrentPlan
                    ? 'border-green-300 shadow-md'
                    : 'border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300'
                } flex flex-col`}
              >
                {/* Popular badge */}
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Current plan badge */}
                {isCurrentPlan && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-green-600 text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="p-6 pt-8 flex-1 flex flex-col">
                  {/* Plan icon & name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg ${
                      planId === 'enterprise' ? 'bg-purple-100 text-purple-600' :
                      planId === 'professional' ? 'bg-blue-100 text-blue-600' :
                      planId === 'starter' ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {planId === 'enterprise' ? <Crown className="w-5 h-5" /> :
                       planId === 'professional' ? <Zap className="w-5 h-5" /> :
                       planId === 'starter' ? <Zap className="w-5 h-5" /> :
                       <Shield className="w-5 h-5" />}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  </div>

                  {/* Pricing */}
                  <div className="mb-2">
                    {plan.price === 0 ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-gray-900">Free</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-gray-900">
                          ${billingInterval === 'yearly' ? monthlyEquiv : price}
                        </span>
                        <span className="text-gray-500">/mo</span>
                      </div>
                    )}
                    {billingInterval === 'yearly' && plan.price > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        ${price}/year — billed annually
                      </p>
                    )}
                  </div>

                  <p className="text-sm text-gray-500 mb-6">{plan.description}</p>

                  {/* Limits summary */}
                  <div className="grid grid-cols-3 gap-2 mb-6 p-3 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-900">{formatLimit(plan.limits.maxUsers)}</p>
                      <p className="text-xs text-gray-500">Users</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-900">{formatLimit(plan.limits.maxProjects)}</p>
                      <p className="text-xs text-gray-500">Projects</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-900">{formatLimit(plan.limits.maxRequisitionsPerMonth)}</p>
                      <p className="text-xs text-gray-500">Req/mo</p>
                    </div>
                  </div>

                  {/* Features list */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          plan.highlighted ? 'text-blue-500' : 'text-green-500'
                        }`} />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleSelectPlan(planId)}
                    disabled={isCurrentPlan || loadingPlan === planId}
                    className={`w-full py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${getButtonStyle(planId, plan.highlighted)}`}
                  >
                    {loadingPlan === planId ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      getButtonLabel(planId)
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* FAQ / Enterprise CTA */}
        <div className="mt-16 text-center">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Need a custom plan?
            </h3>
            <p className="text-gray-500 mb-4">
              For organizations with specific requirements, we offer custom plans with
              tailored limits, dedicated support, and custom integrations.
            </p>
            <a
              href="mailto:support@ledgerworkflow.com"
              className="inline-flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700"
            >
              Contact Sales
            </a>
          </div>
        </div>

        {/* Comparison table */}
        <div className="mt-16">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-8">
            Compare Plans
          </h2>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left p-4 text-sm font-medium text-gray-500 w-1/3">Feature</th>
                  {PLAN_ORDER.map(planId => (
                    <th key={planId} className="p-4 text-center text-sm font-semibold text-gray-900">
                      {PLAN_TIERS[planId].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Team Members', key: 'maxUsers' },
                  { label: 'Projects', key: 'maxProjects' },
                  { label: 'Requisitions/month', key: 'maxRequisitionsPerMonth' },
                  { label: 'Approval Workflows', values: ['Basic', 'Multi-level', 'Advanced', 'Custom'] },
                  { label: 'Purchase Orders', values: [false, false, true, true] },
                  { label: 'Receipt Tracking', values: [false, false, true, true] },
                  { label: 'Reports & Analytics', values: ['Basic', 'Basic', 'Advanced', 'Advanced'] },
                  { label: 'Requisition Templates', values: [false, true, true, true] },
                  { label: 'CSV Export', values: [false, true, true, true] },
                  { label: 'PDF Export', values: [false, false, true, true] },
                  { label: 'Audit Trail', values: [false, false, false, true] },
                  { label: 'Custom Integrations', values: [false, false, false, true] },
                  { label: 'Support', values: ['Standard', 'Priority', 'Priority', 'Dedicated'] },
                ].map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="p-4 text-sm text-gray-700">{row.label}</td>
                    {PLAN_ORDER.map((planId, planIdx) => (
                      <td key={planId} className="p-4 text-center">
                        {row.key ? (
                          <span className="text-sm font-medium text-gray-900">
                            {formatLimit(PLAN_TIERS[planId].limits[row.key])}
                          </span>
                        ) : typeof row.values[planIdx] === 'boolean' ? (
                          row.values[planIdx] ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-gray-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm text-gray-700">{row.values[planIdx]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PricingPlans
