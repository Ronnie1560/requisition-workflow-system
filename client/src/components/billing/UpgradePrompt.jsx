/**
 * UpgradePrompt Component
 * Inline component to show when a user hits a plan limit.
 * Use this in forms where limit-checks happen (e.g., invite user, create project).
 */
import { useNavigate } from 'react-router-dom'
import { useBilling } from '../../hooks/billing/useBilling'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'

export default function UpgradePrompt({ feature, current, max }) {
  const { canManageBilling, planConfig } = useBilling()
  const navigate = useNavigate()

  if (max === -1) return null // Unlimited
  if (current < max) return null // Not at limit

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-800">
            {feature || 'Limit'} limit reached
          </p>
          <p className="text-sm text-yellow-700 mt-1">
            Your <span className="font-medium capitalize">{planConfig.name}</span> plan allows
            up to {max} {feature?.toLowerCase() || 'items'}.
            {canManageBilling
              ? ' Upgrade your plan to add more.'
              : ' Ask your organization owner to upgrade.'}
          </p>
          {canManageBilling && (
            <button
              onClick={() => navigate('/billing/plans')}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              View Plans
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
