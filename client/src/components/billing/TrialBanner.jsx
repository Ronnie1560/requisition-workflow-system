/**
 * TrialBanner Component
 * Displays a persistent banner when the organization is on a trial.
 * Shows days remaining and a CTA to upgrade.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBilling } from '../../hooks/billing/useBilling'
import { AlertTriangle, X, Clock, Sparkles } from 'lucide-react'

export default function TrialBanner() {
  const { isTrialing, trialDaysLeft, trialExpired, canManageBilling } = useBilling()
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()

  // Don't show if not trialing or dismissed
  if (!isTrialing || dismissed) return null

  const isUrgent = trialDaysLeft <= 3

  return (
    <div className={`relative px-4 py-3 text-sm ${
      trialExpired
        ? 'bg-red-600 text-white'
        : isUrgent
        ? 'bg-yellow-500 text-yellow-900'
        : 'bg-blue-600 text-white'
    }`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {trialExpired ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          ) : isUrgent ? (
            <Clock className="w-4 h-4 flex-shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 flex-shrink-0" />
          )}
          <span>
            {trialExpired
              ? 'Your trial has expired. Upgrade now to keep your premium features.'
              : trialDaysLeft === 1
              ? 'Your trial ends tomorrow! Upgrade to keep your features.'
              : `You have ${trialDaysLeft} days left in your trial.`}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {canManageBilling && (
            <button
              onClick={() => navigate('/billing/plans')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                trialExpired
                  ? 'bg-white text-red-600 hover:bg-red-50'
                  : isUrgent
                  ? 'bg-yellow-900 text-white hover:bg-yellow-800'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
            >
              Upgrade Now
            </button>
          )}
          {!trialExpired && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
