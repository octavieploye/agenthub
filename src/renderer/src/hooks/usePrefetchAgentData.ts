import { useCallback } from 'react'
import { useTaskStore } from '../stores/task-store'
import { useBugStore } from '../stores/bug-store'
import { useNoteStore } from '../stores/note-store'
import { useGitStore } from '../stores/git-store'
import { useHistoryStore } from '../stores/history-store'

export function usePrefetchAgentData() {
  const fetchTasksOnce = useTaskStore((s) => s.fetchTasksOnce)
  const fetchBugsOnce = useBugStore((s) => s.fetchBugsOnce)
  const fetchAllNotesOnce = useNoteStore((s) => s.fetchAllNotesOnce)
  const fetchGitDataOnce = useGitStore((s) => s.fetchGitDataOnce)
  const fetchHistoryOnce = useHistoryStore((s) => s.fetchHistoryOnce)

  return useCallback((agentId: string, cwd: string) => {
    console.log('[DEBUG-PREFETCH] START for agent', agentId, 'cwd', cwd)
    const t0 = performance.now()
    // Fire all in parallel, catch errors silently
    Promise.all([
      fetchTasksOnce(),
      fetchBugsOnce(),
      fetchAllNotesOnce(agentId, cwd),
      fetchGitDataOnce(cwd),
      fetchHistoryOnce(agentId),
    ]).then(() => {
      console.log(`[DEBUG-PREFETCH] ALL DONE — ${(performance.now() - t0).toFixed(1)}ms`)
    }).catch((err) => console.warn('[prefetch] failed:', err))
  }, [fetchTasksOnce, fetchBugsOnce, fetchAllNotesOnce, fetchGitDataOnce, fetchHistoryOnce])
}
