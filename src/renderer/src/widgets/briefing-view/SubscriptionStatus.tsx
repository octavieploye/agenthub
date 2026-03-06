import { useUsageStore } from '@renderer/stores/usage-store'
import { PLAN_LIMITS } from '@shared/constants/plan-limits'

function SubscriptionStatus(): React.JSX.Element {
  const plan = useUsageStore((s) => s.plan)
  const totalMessages = useUsageStore((s) => s.totalMessages)
  const burnRate = useUsageStore((s) => s.burnRate)
  const quotaPercent = useUsageStore((s) => s.quotaPercent)

  const limits = PLAN_LIMITS[plan]
  const label = limits?.label ?? 'Custom'
  const messageLimit = limits?.messageLimit ?? 0

  const barColor =
    quotaPercent > 80 ? 'bg-error' : quotaPercent > 60 ? 'bg-warning' : 'bg-primary'

  return (
    <div data-testid="subscription-status" className="panel-glass flex items-center gap-3 px-5 py-3 mb-6">
      <span className="text-xs font-semibold">Claude {label}</span>
      <div className="flex-1 h-2 rounded-full bg-base-content/10 overflow-hidden">
        <div
          data-testid="quota-bar-fill"
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${quotaPercent}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums">{quotaPercent}%</span>
      {messageLimit > 0 && (
        <span className="text-xs text-base-content/50 tabular-nums">
          {totalMessages}/{messageLimit} msgs
        </span>
      )}
      {burnRate > 0 && (
        <span className="text-xs text-base-content/40">
          {burnRate.toFixed(1)} msg/hr
        </span>
      )}
    </div>
  )
}

export default SubscriptionStatus
