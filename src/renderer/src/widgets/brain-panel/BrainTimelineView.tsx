import React, { useEffect } from 'react'
import { useBrainStore } from './brain-store'
import { useViewStore } from '@renderer/stores/view-store'
import BrainTimelineEntry from './BrainTimelineEntry'

/**
 * Timeline view showing merged brain events and git commits
 */
export default function BrainTimelineView() {
  const { timelineData, loading, error, getTimeline } = useBrainStore()
  const selectedRepoId = useViewStore((s) => s.selectedRepoId)

  useEffect(() => {
    if (selectedRepoId) {
      getTimeline(selectedRepoId)
    }
  }, [selectedRepoId])

  // Group entries by date
  const groupedByDate = timelineData.reduce((groups, entry) => {
    const date = new Date(entry.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(entry)
    return groups
  }, {} as Record<string, any[]>)

  return (
    <div className="brain-timeline w-full h-full">
      {timelineData.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <p className="mb-2">Timeline view</p>
            <p className="text-sm">Brain events and git commits will appear here</p>
          </div>
        </div>
      ) : (
        <div className="timeline-container space-y-6">
          {Object.entries(groupedByDate).map(([date, entries]) => (
            <div key={date} className="timeline-date-group">
              {/* Date header */}
              <div className="date-header mb-4">
                <div className="text-2xl font-bold text-gray-400">{date}</div>
              </div>

              {/* Timeline entries */}
              <div className="space-y-3 ml-4">
                {entries.map((entry) => (
                  <BrainTimelineEntry key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}