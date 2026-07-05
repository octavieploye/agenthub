import React, { useState, useEffect } from 'react'
import { useBrainStore } from './brain-store'
import BrainRepoGroup from './BrainRepoGroup'
import BrainTimelineView from './BrainTimelineView'
import BrainRegisterModal from './BrainRegisterModal'

/**
 * Main Brain Panel component - shows cross-repo intelligence index
 */
export default function BrainPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline'>('overview')
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const {
    brainData,
    loading,
    error,
    refreshBrainData,
    registerBrainEntry
  } = useBrainStore()

  useEffect(() => {
    refreshBrainData()
  }, [])

  const handleRegisterSuccess = () => {
    setIsRegisterModalOpen(false)
    refreshBrainData()
  }

  return (
    <div className="brain-panel w-full h-full flex flex-col bg-base-100">
      {/* Header with tabs and controls */}
      <div className="brain-header flex items-center justify-between p-4 border-b border-base-300">
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

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setIsRegisterModalOpen(true)}
          >
            + Register artifact
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={refreshBrainData}
            disabled={loading}
          >
            ↻ {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="alert alert-error max-w-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && brainData.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="mb-2">No brain entries found</p>
            <p className="text-sm">Register artifacts to track brainstorms, specs, and plans</p>
          </div>
        </div>
      )}

      {/* Content - Overview or Timeline */}
      {!loading && !error && brainData.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'overview' ? (
            <div className="space-y-6">
              {brainData.map((repoGroup) => (
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

      {/* Register modal */}
      {isRegisterModalOpen && (
        <BrainRegisterModal
          onClose={() => setIsRegisterModalOpen(false)}
          onSuccess={handleRegisterSuccess}
        />
      )}
    </div>
  )
}