import { useState } from 'react'
import { useLifecycleStore } from '@renderer/stores/lifecycle-store'

const LAYERS = ['all', 'semantic', 'procedural', 'intelligence'] as const

export default function ArchiveBrowser() {
  const archived = useLifecycleStore((s) => s.archived)
  const fetchArchived = useLifecycleStore((s) => s.fetchArchived)
  const restoreRecord = useLifecycleStore((s) => s.restoreRecord)
  const loading = useLifecycleStore((s) => s.loading)
  const [layerFilter, setLayerFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  function handleFetch(layer: string, p: number) {
    setLayerFilter(layer)
    setPage(p)
    fetchArchived({
      layer: layer === 'all' ? undefined : layer,
      page: p,
      page_size: 10,
    })
  }

  function handleRestore(archiveId: string) {
    restoreRecord(archiveId).then((result) => {
      if (result) {
        handleFetch(layerFilter, page)
      }
    })
  }

  const totalPages = archived ? Math.ceil(archived.total / archived.page_size) : 0

  return (
    <div data-testid="archive-browser" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Cold Archive Browser</h3>
        <div className="flex items-center gap-1">
          {LAYERS.map((l) => (
            <button
              key={l}
              onClick={() => handleFetch(l, 1)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${
                layerFilter === l
                  ? 'bg-primary text-primary-content'
                  : 'text-base-content/50 hover:text-base-content/80 bg-base-content/5'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {!archived || archived.records.length === 0 ? (
        <div className="text-sm text-base-content/40 py-4 text-center">
          {archived ? 'No archived records found' : 'Click a layer filter to browse archived records'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table table-xs w-full">
              <thead>
                <tr className="text-base-content/50">
                  <th>Layer</th>
                  <th>Table</th>
                  <th>Relevance</th>
                  <th>Reason</th>
                  <th>Archived</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {archived.records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-base-200/30">
                    <td className="capitalize">{rec.layer}</td>
                    <td className="font-mono text-[10px]">{rec.original_table}</td>
                    <td className="font-mono">{rec.relevance_score.toFixed(3)}</td>
                    <td className="max-w-[200px] truncate text-[10px]" title={rec.archive_reason}>
                      {rec.archive_reason}
                    </td>
                    <td className="font-mono text-[10px]">
                      {new Date(rec.archived_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        onClick={() => handleRestore(rec.id)}
                        disabled={loading}
                        className="btn btn-ghost btn-xs text-primary"
                        title="Restore this record"
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => handleFetch(layerFilter, page - 1)}
                disabled={page <= 1}
                className="btn btn-ghost btn-xs"
              >
                Prev
              </button>
              <span className="text-xs text-base-content/50">
                Page {page} of {totalPages} ({archived.total} records)
              </span>
              <button
                onClick={() => handleFetch(layerFilter, page + 1)}
                disabled={page >= totalPages}
                className="btn btn-ghost btn-xs"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
