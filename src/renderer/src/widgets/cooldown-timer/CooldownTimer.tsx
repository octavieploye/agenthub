interface CooldownTimerProps {
  remainingMs: number
  totalMs: number
  size: 'sm' | 'md' | 'lg'
  label?: string
}

const SIZE_PX: Record<CooldownTimerProps['size'], number> = {
  sm: 32,
  md: 48,
  lg: 64
}

type Zone = 'green' | 'amber' | 'red' | 'expired'

function getZone(remainingMs: number, totalMs: number): Zone {
  if (remainingMs <= 0) return 'expired'
  const pct = remainingMs / totalMs
  if (pct > 0.5) return 'green'
  if (pct >= 0.25) return 'amber'
  return 'red'
}

const ZONE_COLORS: Record<Zone, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  expired: '#ef4444'
}

function formatTime(ms: number): string {
  if (ms <= 0) return 'TRIPPED'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export default function CooldownTimer({
  remainingMs,
  totalMs,
  size,
  label
}: CooldownTimerProps): React.JSX.Element {
  const px = SIZE_PX[size]
  const zone = getZone(remainingMs, totalMs)
  const expired = remainingMs <= 0
  const progress = expired ? 1 : Math.max(0, 1 - remainingMs / totalMs)
  const pulse = zone === 'red' && !expired

  const center = px / 2
  const strokeWidth = px >= 48 ? 4 : 3
  const radius = center - strokeWidth
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress)

  const fontSize = px <= 32 ? 8 : px <= 48 ? 10 : 13

  return (
    <div
      data-testid="cooldown-timer"
      data-zone={zone}
      data-expired={expired ? 'true' : undefined}
      role="timer"
      aria-label={label ?? 'Cooldown timer'}
      className={`inline-flex items-center justify-center${pulse ? ' animate-pulse' : ''}`}
    >
      <svg width={String(px)} height={String(px)} viewBox={`0 0 ${px} ${px}`}>
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={ZONE_COLORS[zone]}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
        {/* Center text */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fill={ZONE_COLORS[zone]}
          fontSize={fontSize}
          fontWeight="bold"
        >
          {formatTime(remainingMs)}
        </text>
      </svg>
      <span aria-live="polite" className="sr-only">
        {expired ? 'Timer expired' : `${formatTime(remainingMs)} remaining, ${zone} zone`}
      </span>
    </div>
  )
}
