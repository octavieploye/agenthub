import { useState } from 'react'
import type { ClipItem } from '@shared/types/clip.types'

interface ClipLauncherProps {
  clips: ClipItem[]
  onCreateClip: (input: { title: string; description: string; prompt: string }) => void
  onLaunchClip: (clipId: string) => void
  onDeleteClip: (clipId: string) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function ClipLauncher({
  clips,
  onCreateClip,
  onLaunchClip,
  onDeleteClip
}: ClipLauncherProps): React.JSX.Element {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')

  function handleCreate(): void {
    if (!title.trim() || !prompt.trim()) return
    onCreateClip({ title: title.trim(), description: description.trim(), prompt: prompt.trim() })
    setTitle('')
    setDescription('')
    setPrompt('')
    setShowForm(false)
  }

  return (
    <div data-testid="clip-launcher" className="panel-glass p-4 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold tracking-wide">Clips</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-xs btn-primary rounded-full"
        >
          {showForm ? 'Cancel' : '+ New Clip'}
        </button>
      </div>

      {showForm && (
        <div className="panel-glass p-3 rounded-lg mb-3 flex flex-col gap-2">
          <input
            data-testid="clip-form-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Clip title"
            className="input input-bordered input-sm w-full rounded-lg bg-base-200/50 text-sm"
          />
          <input
            data-testid="clip-form-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            className="input input-bordered input-sm w-full rounded-lg bg-base-200/50 text-sm"
          />
          <textarea
            data-testid="clip-form-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Prompt text..."
            rows={3}
            className="textarea textarea-bordered w-full rounded-lg bg-base-200/50 text-sm"
          />
          <button
            data-testid="clip-form-submit"
            onClick={handleCreate}
            disabled={!title.trim() || !prompt.trim()}
            className="btn btn-xs btn-primary rounded-full self-end"
          >
            Save Clip
          </button>
        </div>
      )}

      {clips.length === 0 ? (
        <div
          data-testid="clip-launcher-empty"
          className="text-sm text-base-content/40 text-center py-4"
        >
          No clips yet. Create one to save a reusable prompt.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {clips.map((clip) => (
            <div
              key={clip.id}
              data-testid={`clip-item-${clip.id}`}
              className="panel-glass p-3 rounded-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{clip.title}</div>
                  <div className="text-xs text-base-content/50 mt-0.5">{clip.description}</div>
                  <div className="text-xs text-base-content/40 mt-1 truncate">{clip.prompt}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    data-testid={`launch-clip-${clip.id}`}
                    onClick={() => onLaunchClip(clip.id)}
                    className="btn btn-xs btn-ghost rounded-full"
                  >
                    Launch
                  </button>
                  <button
                    data-testid={`delete-clip-${clip.id}`}
                    onClick={() => onDeleteClip(clip.id)}
                    className="btn btn-xs btn-ghost text-error/60 rounded-full"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="flex gap-3 mt-2 text-xs text-base-content/40">
                <span>{clip.launchCount} launches</span>
                <span>{clip.lastUsedAt ? formatDate(clip.lastUsedAt) : 'Never used'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ClipLauncher
