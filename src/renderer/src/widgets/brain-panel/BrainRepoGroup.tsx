import React, { useState } from 'react'
import BrainEntryRow from './BrainEntryRow'
import { BrainEntry } from '../../../../shared/types/brain.types'

interface BrainRepoGroupProps {
  repoName: string
  entries: BrainEntry[]
  summary: {
    active: number
    notActioned: number
    parked: number
    implemented: number
  }
}

export default function BrainRepoGroup({ repoName, entries, summary }: BrainRepoGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Calculate summary text
  const summaryParts = []
  if (summary.active > 0) summaryParts.push(`${summary.active} active`)
  if (summary.notActioned > 0) summaryParts.push(`${summary.notActioned} not actioned`)
  if (summary.parked > 0) summaryParts.push(`${summary.parked} parked`)
  if (summary.implemented > 0) summaryParts.push(`${summary.implemented} done`)

  return (
    <div className="brain-repo-group">
      {/* Repo header */}
      <div
        className="repo-header flex items-center justify-between p-3 bg-base-200 rounded-lg cursor-pointer hover:bg-base-300 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <button className="btn btn-sm btn-square btn-ghost">
            {isExpanded ? '▼' : '►'}
          </button>
          <span className="font-semibold text-lg">● {repoName}</span>
          {summaryParts.length > 0 && (
            <span className="text-sm text-gray-500">
              {summaryParts.join(' · ')}
            </span>
          )}
        </div>
      </div>

      {/* Entries (collapsible) */}
      {isExpanded && (
        <div className="repo-entries mt-3 space-y-3 ml-8">
          {entries.map((entry) => (
            <BrainEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}