import React, { useState } from 'react'
import { BrainEntry } from '../../../../shared/types/brain.types'

interface BrainTaskModalProps {
  brainEntry: BrainEntry
  onClose: () => void
  onSuccess: () => void
}

export default function BrainTaskModal({ brainEntry, onClose, onSuccess }: BrainTaskModalProps) {
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      const taskId = await window.electron.ipcRenderer.invoke('brain:create-task', {
        brainEntryId: brainEntry.id,
        subject: `Implement: ${brainEntry.subject}`,
        description: description || `Task created from brain entry: ${brainEntry.subject}`
      })

      setIsCreating(false)
      onSuccess()
    } catch (err) {
      setIsCreating(false)
      setError(err.message || 'Failed to create task')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-xl font-bold mb-4">Create Task from Brain Entry</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Brain entry info */}
          <div className="bg-base-200 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold">Subject:</span>
              <span className="truncate">{brainEntry.subject}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Type:</span>
              <span className="badge badge-sm">{brainEntry.type}</span>
              <span>Status:</span>
              <span className="badge badge-sm">{brainEntry.status}</span>
            </div>
          </div>

          {/* Description field */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <textarea
              className="textarea textarea-bordered h-24"
              placeholder="Task description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            ></textarea>
          </div>

          {/* Error display */}
          {error && (
            <div className="alert alert-error">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{error}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isCreating}
            >
              {isCreating ? (
                <span className="loading loading-spinner"></span>
              ) : (
                'Create Task'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}