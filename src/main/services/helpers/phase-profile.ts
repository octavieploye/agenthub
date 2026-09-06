import type { TaskItem } from '../../../shared/types/task.types'
import { classifyDispatchMode } from '../model-dispatcher'
import type { DispatchMode } from '../model-dispatcher'

export type PhaseProfileType = 'full-loop' | 'security-once' | 'skip-security'

export interface PhaseProfile {
  type: PhaseProfileType
  runSecurity: boolean
  loopBack: boolean
  maxSecurityCycles: number
  dispatchMode: DispatchMode
}

/** Categories where security scan adds no value (no API, no data, no auth). */
const SKIP_SECURITY_CATEGORIES = new Set([
  'design', 'ui', 'style', 'marketing', 'research', 'business', 'content', 'documentation',
])

/** Categories where security runs once but doesn't loop (lower risk refactors). */
const SECURITY_ONCE_CATEGORIES = new Set([
  'refactor', 'chore', 'perf', 'optimization', 'cleanup', 'test',
])

const MAX_SECURITY_CYCLES = 3

/**
 * Determine the phase profile for a task.
 *
 * Accepts either a TaskItem (preferred — computes dispatchMode from full signals)
 * or a raw category string / null (backward-compatible — dispatchMode defaults to 'a').
 *
 * - skip-security: design/ui/style/marketing — no security phase at all
 * - security-once: refactor/chore/perf — security runs once, blocks on CRITICAL only, no loop-back
 * - full-loop: everything else — security with loop-back (max 3 cycles)
 */
export function getPhaseProfile(categoryOrTask: string | null | TaskItem): PhaseProfile {
  const isTask = categoryOrTask !== null && typeof categoryOrTask === 'object'
  const task = isTask ? (categoryOrTask as TaskItem) : null
  const category = isTask ? (categoryOrTask as TaskItem).category : (categoryOrTask as string | null)
  const dispatchMode: DispatchMode = task ? classifyDispatchMode(task) : 'a'

  if (!category) {
    return { type: 'full-loop', runSecurity: true, loopBack: true, maxSecurityCycles: MAX_SECURITY_CYCLES, dispatchMode }
  }

  const lower = category.toLowerCase().trim()

  if (SKIP_SECURITY_CATEGORIES.has(lower)) {
    return { type: 'skip-security', runSecurity: false, loopBack: false, maxSecurityCycles: 0, dispatchMode }
  }

  if (SECURITY_ONCE_CATEGORIES.has(lower)) {
    return { type: 'security-once', runSecurity: true, loopBack: false, maxSecurityCycles: 1, dispatchMode }
  }

  return { type: 'full-loop', runSecurity: true, loopBack: true, maxSecurityCycles: MAX_SECURITY_CYCLES, dispatchMode }
}

/** Check if a phase profile should skip the security phase entirely. */
export function shouldSkipSecurity(profile: PhaseProfile): boolean {
  return !profile.runSecurity
}

/** Check if a phase profile allows loop-back after security findings. */
export function shouldLoopBack(profile: PhaseProfile, currentCycle: number): boolean {
  return profile.loopBack && currentCycle < profile.maxSecurityCycles
}
