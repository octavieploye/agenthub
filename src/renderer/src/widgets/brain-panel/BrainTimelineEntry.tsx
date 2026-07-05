import React from 'react'
import { BrainTimelineEntry as BrainTimelineEntryType } from '../../../../shared/types/brain.types'

interface BrainTimelineEntryProps {
  entry: BrainTimelineEntryType
}

export default function BrainTimelineEntry({ entry }: BrainTimelineEntryProps) {
  // Icon mapping
  const icons = {
    brain: (
      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
        <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
      </svg>
    ),
    git: (
      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    )
  }

  return (
    <div className="timeline-entry flex items-start gap-3 p-3 hover:bg-base-200 rounded-lg transition-colors">
      {/* Icon */}
      <div className="icon mt-1">
        {icons[entry.icon] || icons[entry.type]}
      </div>

      {/* Content */}
      <div className="content flex-1">
        <div className="subject font-medium text-gray-900 dark:text-gray-100">
          {entry.subject}
        </div>
        {entry.details && (
          <div className="details text-sm text-gray-500 dark:text-gray-400 mt-1">
            {entry.details}
          </div>
        )}
      </div>

      {/* Time */}
      <div className="time text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap ml-2">
        {new Date(entry.date).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </div>
  )
}