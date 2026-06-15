import { useEffect, useRef, useCallback } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import { cancelSpeech, extractLastParagraph } from '../services/voice-speaker'
import { useViewStore } from '../stores/view-store'

export interface AgentTtsActions {
  /** Cmd+Shift+S — stops any in-progress TTS. */
  readActiveAgent: () => void
  /** Cmd+Shift+I — reads the full stored response for the given agent. */
  readFullResponse: (agentId: string | null) => void
}

type AgentHubTts = {
  speak: (o: { text: string; voiceId: string; rate: number; volume: number }) => Promise<{ data?: ArrayBuffer }>
  onResponseReady: (cb: (agentId: string, text: string) => void) => () => void
}

function getTts(): AgentHubTts | undefined {
  return (window as Window & typeof globalThis & { agentHub?: { tts?: AgentHubTts } }).agentHub?.tts
}

async function invokeTts(text: string): Promise<void> {
  const tts = getTts()
  if (!tts) return
  const { piperVoiceId, ttsRate, ttsVolume } = useViewStore.getState()
  const result = await tts.speak({
    text,
    voiceId: piperVoiceId || 'en_US-amy-medium',
    rate: ttsRate,
    volume: ttsVolume,
  })
  if (result?.data) {
    const { playWav } = await import('../services/tts-player')
    await playWav(result.data, ttsVolume)
  }
}

/**
 * Three-stage TTS flow:
 * 1. ResponseCollector emits response-ready → announcement plays, then last paragraph plays.
 * 2. Cmd+Shift+I → reads full stored response for the focused agent.
 * 3. Cmd+Shift+S → cancels any in-progress speech.
 *
 * The busy→completed status transition is no longer used for announcements —
 * onResponseReady owns the full sequence so announcement and text are always in sync.
 */
export function useAgentTts(agents: Map<string, AgentState>): AgentTtsActions {
  // Stores the full response text per agent for Cmd+Shift+I replay
  const lastResponseText = useRef(new Map<string, string>())

  // Listen for response-ready events from ResponseCollector
  useEffect(() => {
    const tts = getTts()
    if (!tts?.onResponseReady) return

    const unsub = tts.onResponseReady(async (agentId: string, text: string) => {
      const agent = agents.get(agentId)
      if (!agent || agent.voiceMode === 'off') return

      // Store full text for Cmd+Shift+I
      lastResponseText.current.set(agentId, text)

      try {
        // Stage 1: announce completion
        await invokeTts(`${agent.name} has completed a response.`)
        // Stage 2: read last paragraph (auto, sequential after announcement)
        const lastParagraph = extractLastParagraph(text)
        if (lastParagraph) await invokeTts(lastParagraph)
      } catch (err) {
        console.warn('[useAgentTts] response sequence error:', err)
      }
    })

    return unsub
  }, [agents])

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
