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
  /** Triggered by Cmd+Shift+S on the focused agent. Cycles: announce→last→full→cancel. */
  readActiveAgent: () => void
}

/**
 * Monitors all agents for busy→idle/locked transitions and fires TTS based on
 * each agent's voiceMode setting.
 *
 * - off:       silent
 * - speak_up:  announces completion only; user triggers read with Cmd+Shift+S
 * - always_on: announces + auto-reads last paragraph; Cmd+Shift+S reads full
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
  // Pending debounce timers per agent — cleared if agent goes busy again before firing
  const pendingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  // Guards against multiple TTS fires per busy cycle (status can flicker busy→idle multiple times)
  const hasFiredTts = useRef(new Set<string>())

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

  // Detect status transitions and fire TTS on busy→confirmed idle/locked
  useEffect(() => {
    for (const [agentId, agent] of agents) {
      const prev = prevStatuses.current.get(agentId)
      const curr = agent.status

      // Reset accumulator and cancel any pending timer when a new busy cycle starts
      if (curr === 'busy' && prev !== 'busy') {
        accumulators.current.set(agentId, '')
        readStages.current.delete(agentId)
        const existing = pendingTimers.current.get(agentId)
        if (existing) {
          clearTimeout(existing)
          pendingTimers.current.delete(agentId)
        }
      }

      // Only fire TTS on confirmed transitions — inferred/unknown flickers during streaming
      if (
        prev === 'busy' &&
        (curr === 'idle' || curr === 'locked') &&
        agent.confidence === 'confirmed'
      ) {
        const { voiceMode, name } = agent
        if (voiceMode === 'off') {
          accumulators.current.delete(agentId)
          prevStatuses.current.set(agentId, curr)
          continue
        }

        // Debounce 400ms so final IPC output chunks arrive before reading the accumulator
        const timer = setTimeout(() => {
          pendingTimers.current.delete(agentId)
          speak(`${name} has completed a response.`, opts)
          readStages.current.set(agentId, 'announced')

          if (voiceMode === 'always_on') {
            const raw = accumulators.current.get(agentId) ?? ''
            const lastPara = extractLastParagraph(stripAnsi(raw))
            if (lastPara) {
              speakQueued(lastPara, opts)
            }
            readStages.current.set(agentId, 'last')
          }
        }, 400)
        pendingTimers.current.set(agentId, timer)
      }

      prevStatuses.current.set(agentId, curr)
    }
    return () => {
      for (const timer of pendingTimers.current.values()) {
        clearTimeout(timer)
      }
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
