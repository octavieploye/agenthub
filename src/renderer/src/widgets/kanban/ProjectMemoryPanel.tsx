import { useState, useEffect, useCallback } from 'react'
import type { WorkspaceMemoryEntry } from '@shared/types/workspace-memory.types'

interface ProjectMemoryPanelProps {
  projectId: string
}

export function ProjectMemoryPanel({ projectId }: ProjectMemoryPanelProps) {
  const [entries, setEntries] = useState<WorkspaceMemoryEntry[]>([])
  const [newContent, setNewContent] = useState('')
  const [busy, setBusy] = useState(false)

  const loadEntries = useCallback(async () => {
    try {
      const response = await window.agentHub.workspaceMemory.list(projectId)
      if (response.success) {
        setEntries(response.data)
      }
    } catch (err) {
      console.error('Failed to load workspace memory entries:', err)
    }
  }, [projectId])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  async function handlePin() {
    if (!newContent.trim() || busy) return

    setBusy(true)
    try {
      const response = await window.agentHub.workspaceMemory.pin(projectId, newContent.trim())
      if (response.success) {
        setNewContent('')
        await loadEntries()
      }
    } catch (err) {
      console.error('Failed to pin learning:', err)
    } finally {
      setBusy(false)
    }
  }

  async function handleUnpin(id: string) {
    setBusy(true)
    try {
      const response = await window.agentHub.workspaceMemory.unpin(id)
      if (response.success) {
        await loadEntries()
      }
    } catch (err) {
      console.error('Failed to unpin learning:', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-base-300 pt-2 mt-2 flex flex-col gap-2">
      {/* Layer 1 Info Bar */}
      <p className="text-xs text-base-content/60 italic">
        Layer 1 session SBARs are auto-included at every agent spawn.
      </p>

      {/* Pinned Learnings Heading */}
      <p className="text-xs font-semibold text-base-content/70 uppercase tracking-wide">
        Pinned Learnings
      </p>

      {/* Entries List */}
      {entries.length === 0 ? (
        <p className="text-xs text-base-content/50">No pinned learnings yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2 text-xs">
              <span className="flex-1 whitespace-pre-wrap break-words">{entry.content}</span>
              <button
                className="btn btn-xs btn-ghost text-error shrink-0"
                onClick={() => handleUnpin(entry.id)}
                aria-label="Unpin"
                disabled={busy}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Pin New Form */}
      <div className="flex gap-2 mt-2">
        <textarea
          className="textarea textarea-bordered textarea-xs flex-1 resize-none"
          rows={2}
          placeholder="Add a learning to pin..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          disabled={busy}
        />
        <button
          className="btn btn-xs btn-primary self-end"
          onClick={handlePin}
          disabled={busy || !newContent.trim()}
        >
          Pin
        </button>
      </div>
    </div>
  )
}
