import React, { useState, useEffect } from 'react'
import { useReposStore } from '../../../stores/repos-store'

/**
 * Modal for registering new brain entries
 */
export default function BrainRegisterModal({ onClose, onSuccess }: {
  onClose: () => void
  onSuccess: () => void
}) {
  const { repos, fetchRepos } = useReposStore()

  useEffect(() => {
    fetchRepos()
  }, [])
  const [formData, setFormData] = useState({
    repoId: '',
    subject: '',
    type: 'brainstorm' as 'brainstorm' | 'spec' | 'plan' | 'sprint',
    artifactPath: '',
    project: '',
    note: ''
  })
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      const result = await window.agentHub.brain.register({
        repoId: formData.repoId,
        subject: formData.subject,
        type: formData.type,
        artifactPath: formData.artifactPath,
        project: formData.project || undefined,
        note: formData.note || undefined
      })

      setIsCreating(false)
      onSuccess()
    } catch (err) {
      setIsCreating(false)
      setError(err.message || 'Failed to register brain entry')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-lg p-6 w-full max-w-2xl shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Register Brain Artifact</h3>
          <button
            className="btn btn-sm btn-circle btn-ghost"
            onClick={onClose}
            disabled={isCreating}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Repo selector */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Repository</span>
            </label>
            <select
              className="select select-bordered"
              value={formData.repoId}
              onChange={(e) => setFormData({ ...formData, repoId: e.target.value })}
              required
            >
              <option value="" disabled>Select a repository</option>
              {repos.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.name || repo.path}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Subject</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              placeholder="e.g., Token Optimizer Implementation"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
            />
          </div>

          {/* Type and Project row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Type</span>
              </label>
              <select
                className="select select-bordered"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              >
                <option value="brainstorm">Brainstorm</option>
                <option value="spec">Spec</option>
                <option value="plan">Plan</option>
                <option value="sprint">Sprint</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Project (optional)</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                placeholder="Project name"
                value={formData.project}
                onChange={(e) => setFormData({ ...formData, project: e.target.value })}
              />
            </div>
          </div>

          {/* Artifact path */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Artifact Path</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              placeholder="/path/to/artifact.md"
              value={formData.artifactPath}
              onChange={(e) => setFormData({ ...formData, artifactPath: e.target.value })}
              required
            />
          </div>

          {/* Note */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Note (optional)</span>
            </label>
            <textarea
              className="textarea textarea-bordered h-20"
              placeholder="Additional context or review comments..."
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
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
                'Register Artifact'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}