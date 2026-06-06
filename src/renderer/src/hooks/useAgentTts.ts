import { useEffect, useRef, useCallback } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import { speak, cancelSpeech } from '../services/voice-speaker'
import type { SpeakOptions } from '../services/voice-speaker'

export interface AgentTtsActions {
  /** Triggered by Cmd+Shift+S — cancels any in-progress speech. */
  readActiveAgent: () => void
}

/**
 * Monitors all agents for busy→idle/locked/completed transitions and announces
 * completion via TTS based on each agent's voiceMode setting.
 *
 * - off:       silent
 * - speak_up:  announces completion
 * - always_on: announces completion
 *
 * Response content reading is deferred to the Piper TTS integration
 * (see docs/superpowers/plans/2026-06-06-piper-tts-integration.md).
 */
export function useAgentTts(
  activeAgentId: string | null,
  agents: Map<string, AgentState>,
  opts: SpeakOptions = {}
): AgentTtsActions {
  // Previous status per agent — used to detect transitions
  const prevStatuses = useRef(new Map<string, string>())

  // Detect status transitions and announce completion
  useEffect(() => {
    for (const [agentId, agent] of agents) {
      const prev = prevStatuses.current.get(agentId)
      const curr = agent.status

      if (
        prev === 'busy' &&
        (curr === 'idle' || curr === 'locked' || curr === 'completed')
      ) {
        if (agent.voiceMode !== 'off') {
          speak(`${agent.name} has completed a response.`, opts)
        }
      }

      prevStatuses.current.set(agentId, curr)
    }
  }, [agents, opts])

  const readActiveAgent = useCallback(() => {
    // Cancel any in-progress speech
    cancelSpeech()
  }, [])

  return { readActiveAgent }
}
