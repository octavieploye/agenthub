import { create } from 'zustand'
import type { DecisionDomain, DecisionsResult } from '../../../../shared/types/decisions.types'

interface DecisionsStoreState {
  result: DecisionsResult | null
  loading: boolean
  refresh: (repoId: string, domain?: DecisionDomain) => Promise<void>
  reset: () => void
}

const FAILED: DecisionsResult = { state: 'unavailable' }

/** Last-request-wins: a slow earlier response never overwrites a newer repo's result. */
let latestRequest = 0

/** An "ok" result must carry arrays; anything else is a broken response, never rendered. */
function normalizeResult(raw: unknown): DecisionsResult {
  if (typeof raw !== 'object' || raw === null) return FAILED
  const candidate = raw as DecisionsResult
  if (
    candidate.state === 'ok' &&
    (!Array.isArray(candidate.decisions) || !Array.isArray(candidate.statuses))
  ) {
    return FAILED
  }
  return candidate
}

export const useDecisionsStore = create<DecisionsStoreState>((set) => ({
  result: null,
  loading: false,

  refresh: async (repoId, domain) => {
    if (repoId.trim() === '') return
    const request = ++latestRequest
    set({ loading: true })
    let result: DecisionsResult
    try {
      result = normalizeResult(await window.agentHub.decisions.list({ repoId, domain }))
    } catch {
      result = FAILED
    }
    if (request === latestRequest) set({ result, loading: false })
  },

  /** Drops the held result and ignores any in-flight response (repo switch, panel unmount). */
  reset: () => {
    latestRequest++
    set({ result: null, loading: false })
  }
}))
