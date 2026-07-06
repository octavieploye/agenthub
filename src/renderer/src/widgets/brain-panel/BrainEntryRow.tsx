import React, { useState } from 'react'
import { BrainEntry } from '../../../../shared/types/brain.types'
import { useBrainStore } from './brain-store'
import BrainTaskModal from './BrainTaskModal'

interface BrainEntryRowProps {
  entry: BrainEntry
}

export default function BrainEntryRow({ entry }: BrainEntryRowProps) {
  const { updateBrainEntryStatus } = useBrainStore()
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)

  // Calculate progress percentage
  const progress = entry.tasksTotal > 0
    ? Math.round((entry.tasksDone / entry.tasksTotal) * 100)
    : 0

  // Get status badge classes
  const getStatusBadgeClass = () => {
    switch (entry.status) {
      case 'active': return 'badge-primary'
      case 'parked': return 'badge-neutral'
      case 'implemented': return 'badge-success'
      case 'draft': return 'badge-ghost'
      default: return 'badge-warning'
    }
  }

  // Get type badge class
  const getTypeBadgeClass = () => {
    switch (entry.type) {
      case 'brainstorm': return 'badge-info'
      case 'spec': return 'badge-accent'
      case 'plan': return 'badge-warning'
      case 'sprint': return 'badge-success'
      case 'strategy': return 'badge-secondary'
      case 'marketing': return 'badge-primary'
      case 'how-to': return 'badge-info badge-outline'
      case 'reference': return 'badge-ghost'
      case 'learning': return 'badge-accent badge-outline'
      default: return 'badge-ghost'
    }
  }

  const handleOpenArtifact = () => {
    window.agentHub.system.openPath(entry.artifactPath)
  }

  const handleStatusChange = (newStatus: string) => {
    updateBrainEntryStatus(entry.id, newStatus)
    setIsStatusDropdownOpen(false)
  }

  const handleCreateTask = () => {
    setIsTaskModalOpen(true)
  }

  const handleTaskCreated = () => {
    setIsTaskModalOpen(false)
    // Refresh data - this would be handled by parent component in real implementation
  }

  return (
    <div className="brain-entry-row bg-base-100 rounded-lg p-4 border border-base-300 hover:border-primary transition-colors relative">
      {/* Main content */}
      <div className="entry-main">
        <div className="flex items-start justify-between gap-4">
          {/* Left side - subject and metadata */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg truncate max-w-xs">
                {entry.subject}
              </h3>

              {/* Type badge */}
              <span className={`badge ${getTypeBadgeClass()} badge-sm`}>
                {entry.type}
              </span>

              {/* Sprint indicator if this is a spec/plan with tasks */}
              {entry.tasksTotal > 0 && (
                <span className="badge badge-outline badge-sm">
                  {entry.type}→sprint
                </span>
              )}
            </div>

            {/* Progress bar */}
            {entry.tasksTotal > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <progress
                    className="progress progress-primary w-32 h-2"
                    value={progress}
                    max="100"
                  ></progress>
                  <span className="text-sm text-gray-500">
                    {entry.tasksDone}/{entry.tasksTotal} tasks
                  </span>
                </div>
              </div>
            )}

            {/* Path display — show short relative path */}
            <div className="text-xs text-base-content/40 mb-1 truncate max-w-md font-mono">
              {entry.artifactPath.replace(/^.*?\/(docs|brainstorm|development-stack|monetize|marketing|TODOS|ai-team-expert)/, '$1')}
            </div>
          </div>

          {/* Right side - status and actions */}
          <div className="flex flex-col items-end gap-2">
            {/* Status badge with dropdown */}
            <div className="dropdown dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className={`badge ${getStatusBadgeClass()} badge-lg cursor-pointer`}
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              >
                {entry.status === 'not_actioned' ? '⚠ NOT ACTIONED' : entry.status.toUpperCase()}
              </div>
              {isStatusDropdownOpen && (
                <ul
                  tabIndex={0}
                  className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-40 mt-1 z-50"
                >
                  <li onClick={() => handleStatusChange('active')}>
                    <a>Active</a>
                  </li>
                  <li onClick={() => handleStatusChange('parked')}>
                    <a>Parked</a>
                  </li>
                  <li onClick={() => handleStatusChange('implemented')}>
                    <a>Implemented</a>
                  </li>
                </ul>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                className="btn btn-xs btn-outline btn-primary"
                onClick={handleOpenArtifact}
              >
                [open]
              </button>
              <button
                className="btn btn-xs btn-outline"
                onClick={handleCreateTask}
              >
                [+ Task]
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Task creation modal */}
      {isTaskModalOpen && (
        <BrainTaskModal
          brainEntry={entry}
          onClose={() => setIsTaskModalOpen(false)}
          onSuccess={handleTaskCreated}
        />
      )}
    </div>
  )
}