import { useState, useEffect, useCallback } from 'react'
import type { ActivityEvent, ActivityStats, ActivityTimeRange, ActivityGroupMode } from '@shared/types/activity.types'
import ActivityStatsBar from './ActivityStatsBar'
import ActivityTimeline from './ActivityTimeline'
import ActivityByProject from './ActivityByProject'
import ActivityByDay from './ActivityByDay'

const TIME_RANGES: { key: ActivityTimeRange; label: string; days: number }[] = [
  { key: '1d', label: 'Yesterday', days: 1 },
  { key: '7d', label: 'This Week', days: 7 },
  { key: '14d', label: '2 Weeks', days: 14 },
  { key: '30d', label: 'Month', days: 30 },
  { key: '90d', label: '3 Months', days: 90 }
]

const GROUP_MODES: { key: ActivityGroupMode; label: string }[] = [
  { key: 'by-day', label: 'By Day' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'by-project', label: 'By Project' }
]

function sinceDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export default function ActivityLogView(): React.JSX.Element {
  const [timeRange, setTimeRange] = useState<ActivityTimeRange>('7d')
  const [groupMode, setGroupMode] = useState<ActivityGroupMode>('by-day')
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [stats, setStats] = useState<ActivityStats>({
    agentsSpawned: 0, agentsCompleted: 0, agentsErrored: 0,
    tasksCompleted: 0, bugsCreated: 0, bugsResolved: 0
  })
  const [loading, setLoading] = useState(true)

  const days = TIME_RANGES.find((r) => r.key === timeRange)?.days ?? 7

  const fetchData = useCallback(async () => {
    setLoading(true)
    const since = sinceDate(days)
    try {
      const [eventsRes, statsRes] = await Promise.all([
        window.agentHub.activity.query({ since }),
        window.agentHub.activity.stats({ since })
      ])
      if (eventsRes.success) setEvents(eventsRes.data)
      if (statsRes.success) setStats(statsRes.data)
    } catch (err) {
      console.warn('[activity] Failed to fetch:', err)
    }
    setLoading(false)
  }, [days])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold">Activity Log</h2>
        <button
          onClick={fetchData}
          className="btn btn-xs btn-ghost text-base-content/50"
          title="Refresh"
        >
          \u21BB Refresh
        </button>
      </div>

      <div className="shrink-0">
        <ActivityStatsBar stats={stats} />
      </div>

      <div className="flex items-center justify-between shrink-0 gap-2 flex-wrap">
        <div className="flex items-center bg-base-content/5 rounded-full p-0.5">
          {TIME_RANGES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTimeRange(key)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                timeRange === key
                  ? 'bg-primary text-primary-content'
                  : 'text-base-content/50 hover:text-base-content/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-base-content/5 rounded-full p-0.5">
          {GROUP_MODES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setGroupMode(key)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                groupMode === key
                  ? 'bg-secondary text-secondary-content'
                  : 'text-base-content/50 hover:text-base-content/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-base-content/40 text-sm">
            Loading...
          </div>
        ) : groupMode === 'timeline' ? (
          <ActivityTimeline events={events} />
        ) : groupMode === 'by-project' ? (
          <ActivityByProject events={events} />
        ) : (
          <ActivityByDay events={events} />
        )}
      </div>
    </div>
  )
}
