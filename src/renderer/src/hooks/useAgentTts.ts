import { useEffect, useRef, useCallback } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import { cancelSpeech } from '../services/voice-speaker'
import { useViewStore } from '../stores/view-store'

export interface AgentTtsActions {
  /** Triggered by Cmd+Shift+S — stops any in-progress TTS. */
  readActiveAgent: () => void
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
  const { ttsVoiceURI, ttsRate, ttsVolume } = useViewStore.getState()
  try {
    const result = await tts.speak({
      text,
      voiceId: ttsVoiceURI || 'en_US-amy-medium',
      rate: ttsRate,
      volume: ttsVolume,
    })
    if (result?.data) {
      const { playWav } = await import('../services/tts-player')
      await playWav(result.data, ttsVolume)
    }
  } catch (err) {
    console.warn('[useAgentTts] speak error:', err)
  }
}

/**
 * Two responsibilities:
 * 1. Announces agent completion by name on busy→completed transition.
 * 2. Listens for on-tts:response-ready IPC events and reads the full response text.
 *
 * Only fires for agents with voiceMode !== 'off'.
 */
export function useAgentTts(agents: Map<string, AgentState>): AgentTtsActions {
  const prevStatuses = useRef(new Map<string, string>())

  // Announce completion by name on busy → completed only
  useEffect(() => {
    for (const [agentId, agent] of agents) {
      const prev = prevStatuses.current.get(agentId)
      const curr = agent.status

      if (prev === 'busy' && curr === 'completed' && agent.voiceMode !== 'off') {
        invokeTts(`${agent.name} has completed a response.`)
      }

      prevStatuses.current.set(agentId, curr)
    }
  }, [agents])

  // Listen for response-ready events from ResponseCollector
  useEffect(() => {
    const tts = getTts()
    if (!tts?.onResponseReady) return

    const unsub = tts.onResponseReady((agentId: string, text: string) => {
      const agent = agents.get(agentId)
      if (!agent || agent.voiceMode === 'off') return
      invokeTts(text)
    })

    return unsub
  }, [agents])

  const readActiveAgent = useCallback(() => {
    cancelSpeech()
  }, [])

  return { readActiveAgent }
}
