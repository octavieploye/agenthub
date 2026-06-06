import { useEffect, useRef, useCallback } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import {
  stripAnsi,
  extractLastParagraph,
  speak,
  speakQueued,
  cancelSpeech,
} from '../services/voice-speaker'
import type { SpeakOptions } from '../services/voice-speaker'

type ReadStage = 'announced' | 'last' | 'full'

export interface AgentTtsActions {
  /** Triggered by Cmd+Shift+R on the focused agent. Cycles: announce→last→full→cancel. */
  readActiveAgent: () => void
}

/**
 * Monitors all agents for busy→idle/locked transitions and fires TTS based on
 * each agent's voiceMode setting.
 *
 * - off:       silent
 * - speak_up:  announces completion only; user triggers read with Cmd+Shift+R
 * - always_on: announces + auto-reads last paragraph; Cmd+Shift+R reads full
 */
export function useAgentTts(
  activeAgentId: string | null,
  agents: Map<string, AgentState>,
  opts: SpeakOptions = {}
): AgentTtsActions {
  // Accumulated raw PTY output per agent for the current busy cycle
  const accumulators = useRef(new Map<string, string>())
  // Read stage per agent: undefined = not started, 'announced', 'last', 'full'
  const readStages = useRef(new Map<string, ReadStage>())
  // Previous status per agent — used to detect transitions
  const prevStatuses = useRef(new Map<string, string>())

  // Accumulate PTY output during busy periods
  useEffect(() => {
    const unsub = window.agentHub.on.agentOutput((agentId: string, data: string) => {
      const agent = agents.get(agentId)
      if (!agent || agent.voiceMode === 'off') return
      if (agent.status !== 'busy') return
      const existing = accumulators.current.get(agentId) ?? ''
      accumulators.current.set(agentId, existing + data)
    })
    return () => unsub()
  }, [agents])

  // Detect status transitions and fire TTS on busy→idle/locked
  useEffect(() => {
    for (const [agentId, agent] of agents) {
      const prev = prevStatuses.current.get(agentId)
      const curr = agent.status

      // Reset accumulator when a new busy cycle starts
      if (curr === 'busy' && prev !== 'busy') {
        accumulators.current.set(agentId, '')
        readStages.current.delete(agentId)
      }

      // Fire TTS on busy→idle or busy→locked
      if (prev === 'busy' && (curr === 'idle' || curr === 'locked')) {
        const { voiceMode } = agent
        if (voiceMode === 'off') {
          accumulators.current.delete(agentId)
          prevStatuses.current.set(agentId, curr)
          continue
        }

        // Always announce completion first
        speak(`${agent.name} has completed a response.`, opts)
        readStages.current.set(agentId, 'announced')

        if (voiceMode === 'always_on') {
          const raw = accumulators.current.get(agentId) ?? ''
          const lastPara = extractLastParagraph(stripAnsi(raw))
          if (lastPara) {
            speakQueued(lastPara, opts)
          }
          readStages.current.set(agentId, 'last')
        }
      }

      prevStatuses.current.set(agentId, curr)
    }
  }, [agents, opts])

  const readActiveAgent = useCallback(() => {
    if (!activeAgentId) return
    const agent = agents.get(activeAgentId)
    if (!agent || agent.voiceMode === 'off') return

    const stage = readStages.current.get(activeAgentId)
    const raw = accumulators.current.get(activeAgentId) ?? ''
    const clean = stripAnsi(raw)

    if (stage === 'full') {
      cancelSpeech()
      readStages.current.delete(activeAgentId)
      return
    }

    if (stage === 'last' || stage === 'announced') {
      // Advance to full read
      speak(clean, opts)
      readStages.current.set(activeAgentId, 'full')
      return
    }

    // No stage yet (speak_up mode, first manual trigger) — read last paragraph
    const lastPara = extractLastParagraph(clean)
    if (lastPara) {
      speak(lastPara, opts)
      readStages.current.set(activeAgentId, 'last')
    }
  }, [activeAgentId, agents, opts])

  return { readActiveAgent }
}
