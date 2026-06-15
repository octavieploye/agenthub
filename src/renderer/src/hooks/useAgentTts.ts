import { useEffect, useRef, useCallback } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import { cancelSpeech, extractLastParagraph, stripAnsi, speak } from '../services/voice-speaker'
import { useViewStore } from '../stores/view-store'

export interface AgentTtsActions {
  /** Cmd+Shift+S — stops any in-progress TTS. */
  readActiveAgent: () => void
  /** Cmd+Shift+I — reads the full stored response for the given agent. */
  readFullResponse: (agentId: string | null) => void
}

async function invokeTts(text: string): Promise<void> {
  if (!text.trim()) return
  const { piperVoiceId, ttsRate, ttsVolume } = useViewStore.getState()
  await speak(text, { piperVoiceId: piperVoiceId || 'en_US-amy-medium', rate: ttsRate, volume: ttsVolume })
}

/**
 * TTS flow driven by PTY output + status transitions (no API key required):
 * 1. On busy start: subscribe to agentOutput IPC and accumulate PTY text per agent.
 * 2. On busy → idle/locked: unsubscribe, wait 400ms for trailing PTY chunks,
 *    strip ANSI, then speak announcement + last paragraph (always_on) or
 *    announcement only (speak_up).
 * 3. Cmd+Shift+I → reads full stored response for the focused agent.
 * 4. Cmd+Shift+S → cancels any in-progress speech.
 */
export function useAgentTts(agents: Map<string, AgentState>): AgentTtsActions {
  const agentsRef = useRef(agents)
  agentsRef.current = agents

  // Stores the full response text per agent for Cmd+Shift+I replay
  const lastResponseText = useRef(new Map<string, string>())
  // PTY text accumulated during each busy period, per agent
  const accumulators = useRef(new Map<string, string>())
  // Unsubscribe functions for active agentOutput listeners, per agent
  const outputUnsubs = useRef(new Map<string, () => void>())
  // Previous status per agent to detect transitions
  const prevStatus = useRef(new Map<string, string>())
  // Pending flush timers per agent
  const flushTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const unsubStatus = window.agentHub.on.agentStatusChange((agentId, status) => {
      const prev = prevStatus.current.get(agentId)
      prevStatus.current.set(agentId, status)

      const agent = agentsRef.current.get(agentId)
      if (!agent || agent.voiceMode === 'off') return

      // busy start — begin accumulating PTY output
      if (status === 'busy' && prev !== 'busy') {
        // Clear any pending flush from a previous cycle
        const existing = flushTimers.current.get(agentId)
        if (existing) {
          clearTimeout(existing)
          flushTimers.current.delete(agentId)
        }
        accumulators.current.set(agentId, '')

        const unsubOutput = window.agentHub.on.agentOutput((outputAgentId, data) => {
          if (outputAgentId !== agentId) return
          const current = accumulators.current.get(agentId) ?? ''
          accumulators.current.set(agentId, current + data)
        })
        outputUnsubs.current.set(agentId, unsubOutput)
      }

      // busy → idle/locked — schedule TTS after PTY flush window
      if ((status === 'idle' || status === 'locked') && prev === 'busy') {
        const unsubOutput = outputUnsubs.current.get(agentId)
        if (unsubOutput) {
          unsubOutput()
          outputUnsubs.current.delete(agentId)
        }

        const timer = setTimeout(async () => {
          flushTimers.current.delete(agentId)
          const raw = accumulators.current.get(agentId) ?? ''
          const clean = stripAnsi(raw).trim()
          if (!clean) return

          lastResponseText.current.set(agentId, clean)

          const currentAgent = agentsRef.current.get(agentId)
          if (!currentAgent || currentAgent.voiceMode === 'off') return

          try {
            await invokeTts(`${currentAgent.name} has completed a response.`)
            if (currentAgent.voiceMode === 'always_on') {
              const lastParagraph = extractLastParagraph(clean)
              if (lastParagraph) await invokeTts(lastParagraph)
            }
          } catch (err) {
            console.warn('[useAgentTts] TTS error:', err)
          }
        }, 400)
        flushTimers.current.set(agentId, timer)
      }
    })

    return () => {
      unsubStatus()
      outputUnsubs.current.forEach((unsub) => unsub())
      outputUnsubs.current.clear()
      flushTimers.current.forEach((t) => clearTimeout(t))
      flushTimers.current.clear()
    }
  }, [])

  const readActiveAgent = useCallback(() => {
    cancelSpeech()
  }, [])

  const readFullResponse = useCallback((agentId: string | null) => {
    if (!agentId) return
    const text = lastResponseText.current.get(agentId)
    if (!text) return
    cancelSpeech()
    invokeTts(text).catch((err) => console.warn('[useAgentTts] readFullResponse error:', err))
  }, [])

  return { readActiveAgent, readFullResponse }
}
