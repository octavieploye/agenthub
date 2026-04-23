import type { ActivityEvent } from '@shared/types/activity.types'
import ActivityEventCard from './ActivityEventCard'

interface Props {
  events: ActivityEvent[]
}

export default function ActivityByProject({ events }: Props): React.JSX.Element {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-base-content/40 text-sm">
        No activity in this time range
      </div>
    )
  }

  const grouped = new Map<string, ActivityEvent[]>()
  for (const event of events) {
    const key = event.repoId ?? 'global'
    const list = grouped.get(key) ?? []
    list.push(event)
    grouped.set(key, list)
  }

  return (
    <div className="space-y-4 overflow-y-auto">
      {[...grouped.entries()].map(([repoId, repoEvents]) => (
        <div key={repoId}>
          <h3 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider px-3 py-1 sticky top-0 bg-base-100/90 backdrop-blur-sm">
            {repoId === 'global' ? 'Global' : (repoEvents[0]?.details?.name as string) ?? repoId}
            <span className="ml-2 text-base-content/30">({repoEvents.length})</span>
          </h3>
          <div className="space-y-0.5">
            {repoEvents.map((event) => (
              <ActivityEventCard key={event.id} event={event} showDate />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
