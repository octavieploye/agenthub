import React from 'react'
import { BrainEntry } from '../../../../shared/types/brain.types'
import BrainEntryRow from './BrainEntryRow'

interface RepoGroup {
  repoName: string
  entries: BrainEntry[]
}

interface Props {
  groups: (RepoGroup | null | undefined)[]
}

function getWeekKey(dateStr: string): string {
  // Parse as local date to avoid UTC offset shifting the day
  const parts = dateStr.split('T')[0].split('-').map(Number)
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday offset
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

function getWeekLabel(weekKey: string): string {
  const [y, m, d] = weekKey.split('-').map(Number)
  const monday = new Date(y, m - 1, d)
  const sunday = new Date(y, m - 1, d + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', opts)}, ${y}`
}

export default function BrainChronologyView({ groups }: Props) {
  const allEntries = groups.flatMap((g) => g?.entries ?? [])

  if (allEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-base-content/50 text-sm">
        No entries to display
      </div>
    )
  }

  // Build week → repo → entries map
  const weekMap = new Map<string, Map<string, BrainEntry[]>>()

  for (const entry of allEntries) {
    const wk = getWeekKey(entry.createdAt)
    if (!weekMap.has(wk)) weekMap.set(wk, new Map())
    const repoMap = weekMap.get(wk)!
    if (!repoMap.has(entry.repoName)) repoMap.set(entry.repoName, [])
    repoMap.get(entry.repoName)!.push(entry)
  }

  // Sort weeks newest first
  const sortedWeeks = Array.from(weekMap.entries()).sort((a, b) => b[0].localeCompare(a[0]))

  // Within each repo bucket, sort entries newest first
  for (const [, repoMap] of sortedWeeks) {
    for (const [, entries] of repoMap) {
      entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
  }

  return (
    <div className="space-y-8">
      {sortedWeeks.map(([weekKey, repoMap]) => {
        const weekTotal = Array.from(repoMap.values()).reduce((s, e) => s + e.length, 0)
        return (
          <div key={weekKey}>
            {/* Week header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-base-content/50 bg-base-200 px-3 py-1 rounded-full whitespace-nowrap">
                {getWeekLabel(weekKey)}
              </span>
              <span className="badge badge-ghost badge-xs">{weekTotal}</span>
              <div className="flex-1 h-px bg-base-300" />
            </div>

            {/* Projects within this week */}
            <div className="space-y-5 ml-2">
              {Array.from(repoMap.entries()).map(([repoName, entries]) => (
                <div key={repoName}>
                  <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-base-content/60">
                    <span className="text-primary">●</span>
                    <span>{repoName}</span>
                    <span className="badge badge-ghost badge-xs">{entries.length}</span>
                  </div>
                  <div className="space-y-2 ml-5">
                    {entries.map((entry) => (
                      <BrainEntryRow key={entry.id} entry={entry} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
