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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasStrings(value: unknown, keys: string[]): boolean {
  return isRecord(value) && keys.every((key) => typeof value[key] === 'string')
}

const DECISION_KEYS = ['id', 'domain', 'title', 'status']
const STATUS_KEYS = ['project_id', 'domain', 'state']

/**
 * An "ok" result must carry arrays; anything else is a broken response, never rendered.
 * Malformed elements (null, primitives, rows missing the fields the panel reads) are dropped.
 */
function normalizeResult(raw: unknown): DecisionsResult {
  if (!isRecord(raw)) return FAILED
  const candidate = raw as DecisionsResult
  if (candidate.state !== 'ok') return candidate
  if (!Array.isArray(candidate.decisions) || !Array.isArray(candidate.statuses)) return FAILED
  return {
    state: 'ok',
    decisions: candidate.decisions.filter((row) => hasStrings(row, DECISION_KEYS)),
    statuses: candidate.statuses.filter((row) => hasStrings(row, STATUS_KEYS))
  }
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
