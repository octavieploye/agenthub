import { useLifecycleStore } from '@renderer/stores/lifecycle-store'

export default function MemoryRefreshButton() {
  const loading = useLifecycleStore((s) => s.loading)
  const fetchAll = useLifecycleStore((s) => s.fetchAll)

  return (
    <button
      data-testid="memory-refresh-button"
      onClick={fetchAll}
      disabled={loading}
      className="btn btn-ghost btn-sm gap-1.5"
      title="Refresh lifecycle data from Anamnesis"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={loading ? 'animate-spin' : ''}
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      {loading ? 'Loading...' : 'Refresh'}
    </button>
  )
}
