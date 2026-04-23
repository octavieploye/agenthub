import type { ActivityEvent } from '@shared/types/activity.types'
import ActivityEventCard from './ActivityEventCard'

interface Props {
  events: ActivityEvent[]
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function ActivityByDay({ events }: Props): React.JSX.Element {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-base-content/40 text-sm">
        No activity in this time range
      </div>
    )
  }

  const grouped = new Map<string, ActivityEvent[]>()
  for (const event of events) {
    const key = dayKey(event.createdAt)
    const list = grouped.get(key) ?? []
    list.push(event)
    grouped.set(key, list)
  }

  return (
    <div className="space-y-4 overflow-y-auto">
      {[...grouped.entries()].map(([day, dayEvents]) => (
        <div key={day}>
          <h3 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider px-3 py-1 sticky top-0 bg-base-100/90 backdrop-blur-sm">
            {day}
            <span className="ml-2 text-base-content/30">({dayEvents.length} events)</span>
          </h3>
          <div className="space-y-0.5">
            {dayEvents.map((event) => (
              <ActivityEventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
