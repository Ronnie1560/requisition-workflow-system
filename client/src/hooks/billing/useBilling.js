/**
 * useBilling Hook
 * Provides billing state, plan limits, and enforcement logic for components.
 */
import { useMemo } from 'react'
import { useOrganization } from '../../context/OrganizationContext'
import { getPlanConfig, getPlanLimits, PLAN_ORDER } from '../../config/plans'

export function useBilling() {
  const { currentOrg, isOwner } = useOrganization()

  const billing = useMemo(() => {
    if (!currentOrg) {
      return {
        plan: 'free',
        planConfig: getPlanConfig('free'),
        limits: getPlanLimits('free'),
        status: 'active',
        isTrialing: false,
        trialDaysLeft: 0,
        trialExpired: false,
        isFree: true,
        isPaid: false,
        canUpgrade: true,
        canManageBilling: false,
        hasStripe: false,
      }
    }

    const plan = currentOrg.plan || 'free'
    const planConfig = getPlanConfig(plan)
    const limits = getPlanLimits(plan)
    const status = currentOrg.status || 'active'
    const isTrialing = status === 'trial'

    // Calculate trial days left
    let trialDaysLeft = 0
    let trialExpired = false
    if (isTrialing && currentOrg.trial_ends_at) {
      const diff = new Date(currentOrg.trial_ends_at) - new Date()
      trialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
      trialExpired = trialDaysLeft <= 0
    }

    const isFree = plan === 'free'
    const isPaid = !isFree && status === 'active'
    const canUpgrade = PLAN_ORDER.indexOf(plan) < PLAN_ORDER.length - 1
    const canManageBilling = isOwner
    const hasStripe = !!currentOrg.stripe_customer_id

    return {
      plan,
      planConfig,
      limits,
      status,
      isTrialing,
      trialDaysLeft,
      trialExpired,
      isFree,
      isPaid,
      canUpgrade,
      canManageBilling,
      hasStripe,
    }
  }, [currentOrg, isOwner])

  return billing
}

/**
 * Check if a specific limit is reached
 * @param {number} current - Current count
 * @param {number} max - Maximum allowed (-1 = unlimited)
 * @returns {{ allowed: boolean, remaining: number, percentage: number }}
 */
export function checkLimit(current, max) {
  if (max === -1) return { allowed: true, remaining: Infinity, percentage: 0 }
  const remaining = Math.max(0, max - current)
  const percentage = max > 0 ? (current / max) * 100 : 0
  return {
    allowed: current < max,
    remaining,
    percentage: Math.min(percentage, 100),
  }
}
