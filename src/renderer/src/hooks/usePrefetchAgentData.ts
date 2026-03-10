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
    // Fire all in parallel, catch errors silently
    Promise.all([
      fetchTasksOnce(),
      fetchBugsOnce(),
      fetchAllNotesOnce(agentId, cwd),
      fetchGitDataOnce(cwd),
      fetchHistoryOnce(agentId),
    ]).catch((err) => console.warn('[prefetch] failed:', err))
  }, [fetchTasksOnce, fetchBugsOnce, fetchAllNotesOnce, fetchGitDataOnce, fetchHistoryOnce])
}
