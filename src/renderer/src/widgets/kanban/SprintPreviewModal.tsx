// src/renderer/src/widgets/kanban/SprintPreviewModal.tsx
import { useState, useEffect } from 'react'
import type { SprintPendingPayload } from '@shared/types/task.types'

export function SprintPreviewModal() {
  const [pending, setPending] = useState<SprintPendingPayload | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return window.agentHub.on.sprintPending((payload) => {
      setPending(payload as SprintPendingPayload)
      setError(null)
    })
  }, [])

  async function handleConfirm() {
    if (!pending) return
    setImporting(true)
    setError(null)
    const res = await window.agentHub.kanban.sprintConfirm(pending.pendingId)
    setImporting(false)
    if (!res.success) {
      setError(res.error.message)
      return
    }
    setPending(null)
  }

  function handleReject() {
    if (!pending) return
    window.agentHub.kanban.sprintReject(pending.pendingId)
    setPending(null)
  }

  if (!pending) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel-glass flex flex-col w-full max-w-sm rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-base-content/10">
          <span className="text-sm font-semibold">Sprint ready to import</span>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className="text-base font-medium">{pending.sprintName}</div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-base-content/5 rounded p-2">
              <div className="text-lg font-bold">{pending.epicCount}</div>
              <div className="text-[10px] text-base-content/50">Epics</div>
            </div>
            <div className="bg-base-content/5 rounded p-2">
              <div className="text-lg font-bold">{pending.taskCount}</div>
              <div className="text-[10px] text-base-content/50">Tasks</div>
            </div>
            <div className="bg-base-content/5 rounded p-2">
              <div className="text-lg font-bold">{pending.dependencyCount}</div>
              <div className="text-[10px] text-base-content/50">Dependencies</div>
            </div>
          </div>

          <div className="text-xs text-base-content/50">
            All tasks will be added to the <span className="font-medium">Backlog</span> column.
          </div>

          {error && <p className="text-xs text-error">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-base-content/10">
          <button className="btn btn-sm btn-ghost text-error" onClick={handleReject} disabled={importing}>
            Discard
          </button>
          <button className="btn btn-sm btn-primary" onClick={handleConfirm} disabled={importing}>
            {importing ? 'Importing…' : 'Import to Kanban'}
          </button>
        </div>
      </div>
    </div>
  )
}
