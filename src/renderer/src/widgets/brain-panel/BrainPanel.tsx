import React, { useState, useEffect } from 'react'
import { useBrainStore } from './brain-store'
import BrainRepoGroup from './BrainRepoGroup'
import BrainTimelineView from './BrainTimelineView'
import type { BrainEntryType } from '../../../../shared/types/brain.types'

const TYPE_OPTIONS: { value: BrainEntryType | 'all'; label: string }[] = [
  { value: 'all',        label: 'All Types' },
  { value: 'brainstorm', label: 'Brainstorm' },
  { value: 'spec',       label: 'Spec' },
  { value: 'plan',       label: 'Plan' },
  { value: 'sprint',     label: 'Sprint' },
  { value: 'strategy',   label: 'Strategy' },
  { value: 'marketing',  label: 'Marketing' },
  { value: 'how-to',     label: 'How-To' },
  { value: 'reference',  label: 'Reference' },
  { value: 'learning',   label: 'Learning' },
]

export default function BrainPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline'>('overview')
  const [typeFilter, setTypeFilter] = useState<BrainEntryType | 'all'>('all')
  const [repoFilter, setRepoFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'remaining' | 'in_progress' | 'done'>('all')
  const {
    brainData,
    loading,
    error,
    refreshBrainData,
  } = useBrainStore()

  useEffect(() => {
    refreshBrainData()
  }, [])

  // Collect unique repos for the filter dropdown
  const repoOptions = brainData.map((g) => ({ id: g.repoId, name: g.repoName }))

  // Apply filters
  const filteredData = brainData
    .filter((group) => repoFilter === 'all' || group.repoId === repoFilter)
    .map((group) => {
      let entries = group.entries

      if (typeFilter !== 'all') {
        entries = entries.filter((e) => e.type === typeFilter)
      }

      if (statusFilter !== 'all') {
        entries = entries.filter((e) => e.computedStatus === statusFilter)
      }

      if (entries.length === 0) return null

      return {
        ...group,
        entries,
        summary: {
          active: entries.filter(e => e.status === 'active').length,
          notActioned: entries.filter(e => e.tasksTotal === 0 && e.status !== 'parked' && e.status !== 'implemented').length,
          parked: entries.filter(e => e.status === 'parked').length,
          implemented: entries.filter(e => e.status === 'implemented').length
        }
      }
    })
    .filter(Boolean)

  const totalEntries = filteredData.reduce((sum, g) => sum + (g?.entries.length ?? 0), 0)

  return (
    <div className="brain-panel w-full h-full flex flex-col bg-base-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-base-300">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Brain</h2>

          {/* Tab switcher */}
          <div className="tabs tabs-boxed tabs-sm">
            <button
              className={`tab ${activeTab === 'overview' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={`tab ${activeTab === 'timeline' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              Timeline
            </button>
          </div>
        </div>

        {/* Filters + actions */}
        <div className="flex items-center gap-2">
          {/* Repo filter */}
          <select
            className="select select-bordered select-sm"
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value)}
          >
            <option value="all">All Repos</option>
            {repoOptions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          {/* Type filter */}
          <select
            className="select select-bordered select-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as BrainEntryType | 'all')}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            className="select select-bordered select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'remaining' | 'in_progress' | 'done')}
          >
            <option value="all">All Status</option>
            <option value="remaining">Remaining</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>

          {/* Count badge */}
          <span className="badge badge-ghost text-xs">{totalEntries} artifacts</span>

          <button
            className="btn btn-sm btn-ghost"
            onClick={refreshBrainData}
            disabled={loading}
          >
            {loading ? '↻ Scanning...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && brainData.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg"></span>
            <p className="mt-2 text-sm text-base-content/50">Scanning repos for artifacts...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="alert alert-error max-w-md">
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && totalEntries === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-base-content/50">
            <p className="mb-2">No artifacts found</p>
            <p className="text-sm">Add repos with docs/ directories to see brainstorms, specs, and plans</p>
          </div>
        </div>
      )}

      {/* Content */}
      {totalEntries > 0 && (
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'overview' ? (
            <div className="space-y-6">
              {filteredData.map((repoGroup) => repoGroup && (
                <BrainRepoGroup
                  key={repoGroup.repoId}
                  repoName={repoGroup.repoName}
                  entries={repoGroup.entries}
                  summary={repoGroup.summary}
                />
              ))}
            </div>
          ) : (
            <BrainTimelineView />
          )}
        </div>
      )}
    </div>
  )
}
