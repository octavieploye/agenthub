import { useEffect, useRef, useCallback } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import { cancelSpeech, extractLastParagraph, speak } from '../services/voice-speaker'
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
 * TTS driven by the main-process TTS.RESPONSE_READY IPC event.
 *
 * The main process accumulates ANSI-stripped PTY text and emits
 * TTS.RESPONSE_READY exactly once per response (on locked/completed).
 * This hook listens for that event, speaks the announcement, and in
 * always_on mode speaks the last paragraph of the clean response text.
 *
 * Cmd+Shift+I → reads the full stored response for the focused agent.
 * Cmd+Shift+S → cancels any in-progress speech.
 */
export function useAgentTts(agents: Map<string, AgentState>): AgentTtsActions {
  const agentsRef = useRef(agents)
  agentsRef.current = agents

  // Stores the full clean response text per agent for Cmd+Shift+I replay
  const lastResponseText = useRef(new Map<string, string>())

  useEffect(() => {
    const unsubResponseReady = window.agentHub.tts.onResponseReady(async (agentId, cleanText) => {
      if (!cleanText.trim()) return

      const agent = agentsRef.current.get(agentId)
      if (!agent || agent.voiceMode === 'off') return

      lastResponseText.current.set(agentId, cleanText)

      try {
        await invokeTts(`${agent.name} has completed a response.`)
        if (agent.voiceMode === 'always_on') {
          const lastParagraph = extractLastParagraph(cleanText)
          if (lastParagraph) await invokeTts(lastParagraph)
        }
      } catch (err) {
        console.warn('[useAgentTts] TTS error:', err)
      }
    })

    return () => {
      unsubResponseReady()
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
