/**
 * Subscription Plan Configuration
 * 
 * Central source of truth for all plan tiers, pricing, limits, and features.
 * Stripe Price IDs should be set once you create products in Stripe Dashboard.
 */

export const PLAN_TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'For individuals and small teams getting started',
    price: 0,
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    stripePriceIdMonthly: null, // No Stripe for free
    stripePriceIdYearly: null,
    limits: {
      maxUsers: 3,
      maxProjects: 2,
      maxRequisitionsPerMonth: 25,
    },
    features: [
      'Up to 3 team members',
      'Up to 2 projects',
      '25 requisitions/month',
      'Basic approval workflow',
      'Email notifications',
      'Standard support',
    ],
    highlighted: false,
    cta: 'Current Plan',
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'For growing teams that need more capacity',
    price: 8,
    priceMonthly: 8,
    priceYearly: 80, // ~$6.67/mo — 2 months free
    currency: 'USD',
    // Replace these with actual Stripe Price IDs from your Stripe Dashboard
    stripePriceIdMonthly: 'STRIPE_STARTER_MONTHLY_PRICE_ID',
    stripePriceIdYearly: 'STRIPE_STARTER_YEARLY_PRICE_ID',
    limits: {
      maxUsers: 10,
      maxProjects: 10,
      maxRequisitionsPerMonth: 200,
    },
    features: [
      'Up to 10 team members',
      'Up to 10 projects',
      '200 requisitions/month',
      'Multi-level approvals',
      'Email notifications',
      'Requisition templates',
      'CSV export',
      'Priority support',
    ],
    highlighted: false,
    cta: 'Upgrade',
  },

  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'For organizations that need full control',
    price: 12,
    priceMonthly: 12,
    priceYearly: 120, // ~$10/mo — 2 months free
    currency: 'USD',
    stripePriceIdMonthly: 'STRIPE_PRO_MONTHLY_PRICE_ID',
    stripePriceIdYearly: 'STRIPE_PRO_YEARLY_PRICE_ID',
    limits: {
      maxUsers: 25,
      maxProjects: 25,
      maxRequisitionsPerMonth: 500,
    },
    features: [
      'Up to 25 team members',
      'Up to 25 projects',
      '500 requisitions/month',
      'Advanced approval chains',
      'Purchase order management',
      'Receipt tracking',
      'Advanced reports & analytics',
      'Requisition templates',
      'CSV & PDF export',
      'Priority support',
    ],
    highlighted: true, // Most popular
    cta: 'Upgrade',
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations with custom needs',
    price: 60,
    priceMonthly: 60,
    priceYearly: 600, // ~$50/mo — 2 months free
    currency: 'USD',
    stripePriceIdMonthly: 'STRIPE_ENTERPRISE_MONTHLY_PRICE_ID',
    stripePriceIdYearly: 'STRIPE_ENTERPRISE_YEARLY_PRICE_ID',
    limits: {
      maxUsers: -1, // Unlimited
      maxProjects: -1,
      maxRequisitionsPerMonth: -1,
    },
    features: [
      'Unlimited team members',
      'Unlimited projects',
      'Unlimited requisitions',
      'Custom approval workflows',
      'Purchase order management',
      'Receipt tracking',
      'Advanced reports & analytics',
      'Audit trail & compliance',
      'Requisition templates',
      'CSV & PDF export',
      'Dedicated support',
      'Custom integrations',
    ],
    highlighted: false,
    cta: 'Upgrade',
  },
}

// Ordered list for display
export const PLAN_ORDER = ['free', 'starter', 'professional', 'enterprise']

// Trial configuration
export const TRIAL_CONFIG = {
  durationDays: 14,
  plan: 'professional', // Trial users get Professional-level features
  graceperiodDays: 3, // Days after trial expires before restricting access
}

/**
 * Get the plan configuration for a given plan ID
 */
export const getPlanConfig = (planId) => {
  return PLAN_TIERS[planId] || PLAN_TIERS.free
}

/**
 * Get limits for a given plan ID
 */
export const getPlanLimits = (planId) => {
  const plan = getPlanConfig(planId)
  return plan.limits
}

/**
 * Check if a plan is higher than another
 */
export const isPlanHigher = (planA, planB) => {
  const order = PLAN_ORDER
  return order.indexOf(planA) > order.indexOf(planB)
}

/**
 * Format price for display
 */
export const formatPrice = (amount, currency = 'USD') => {
  if (amount === 0) return 'Free'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format limit value (-1 = unlimited)
 */
export const formatLimit = (value) => {
  if (value === -1) return 'Unlimited'
  return value.toLocaleString()
}
