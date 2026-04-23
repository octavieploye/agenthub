import type { ActivityEvent } from '@shared/types/activity.types'
import ActivityEventCard from './ActivityEventCard'

interface Props {
  events: ActivityEvent[]
}

export default function ActivityTimeline({ events }: Props): React.JSX.Element {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-base-content/40 text-sm">
        No activity in this time range
      </div>
    )
  }

  return (
    <div className="space-y-0.5 overflow-y-auto">
      {events.map((event) => (
        <ActivityEventCard key={event.id} event={event} showDate />
      ))}
    </div>
  )
}
