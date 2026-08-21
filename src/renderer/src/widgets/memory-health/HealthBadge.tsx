import type { LifecycleHealthStatus } from '@shared/types/lifecycle.types'

interface HealthBadgeProps {
  status: LifecycleHealthStatus
}

const STATUS_STYLES: Record<LifecycleHealthStatus, { bg: string; text: string; label: string }> = {
  healthy:  { bg: 'bg-success/20', text: 'text-success', label: 'Healthy' },
  warning:  { bg: 'bg-warning/20', text: 'text-warning', label: 'Warning' },
  critical: { bg: 'bg-error/20',   text: 'text-error',   label: 'Critical' },
}

export default function HealthBadge({ status }: HealthBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.healthy
  return (
    <span
      data-testid="health-badge"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.text} bg-current`} />
      {style.label}
    </span>
  )
}
