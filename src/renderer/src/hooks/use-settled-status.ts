import { useEffect, useRef, useState } from 'react'
import type { AgentLifecycleStatus } from '@shared/types/agent.types'

const SETTLE_MS = 1000

/**
 * Returns a "settled" status that only updates after the raw status
 * has remained stable for SETTLE_MS. Prevents glow flickering from
 * Claude CLI TUI redraws that cause rapid status changes.
 */
export function useSettledStatus(rawStatus: AgentLifecycleStatus): AgentLifecycleStatus {
  const [settled, setSettled] = useState(rawStatus)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setSettled(rawStatus)
    }, SETTLE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [rawStatus])

  return settled
}
