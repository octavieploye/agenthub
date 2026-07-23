import { useEffect, useRef, useCallback } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import { cancelSpeech, extractLastParagraph, isReadableParagraph, speak } from '../services/voice-speaker'
import { useViewStore } from '../stores/view-store'
import { TtsQueue } from '../services/tts-queue'

export interface AgentTtsActions {
  /** Cmd+Shift+S — stops any in-progress TTS. */
  stopActiveSpeech: () => void
  /** Cmd+Shift+I — reads the full stored response for the given agent. */
  readFullResponse: (agentId: string | null) => void
}

async function invokeTts(text: string): Promise<void> {
  if (!text.trim()) return
  const { piperVoiceId, ttsRate, ttsVolume } = useViewStore.getState()
  await speak(text, { piperVoiceId: piperVoiceId || 'en_US-amy-medium', rate: ttsRate, volume: ttsVolume })
}

// Module-level queue — shared across all hook instances (one in App.tsx)
const ttsQueue = new TtsQueue(invokeTts)

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
  // Tracks agents with pending approval announcements to prevent duplicates
  const pendingApproval = useRef(new Set<string>())

  useEffect(() => {
    const unsubResponseReady = window.agentHub.tts.onResponseReady(async (agentId, cleanText) => {
      const agent = agentsRef.current.get(agentId)
      if (!agent) return

      // Always store text for Cmd+Shift+I replay — independent of voice/sound toggles
      if (cleanText.trim()) {
        lastResponseText.current.set(agentId, cleanText)
      }

      // Voice guards: skip TTS announcement if sound/voice is off
      const { soundEnabled, voiceEnabled } = useViewStore.getState()
      if (!soundEnabled) return
      if (agent.voiceMode === 'off' || !voiceEnabled) return

      const announcement = `${agent.name} has responded.`
      const rawLastParagraph = agent.voiceMode === 'always_on' ? extractLastParagraph(cleanText) : null
      // minWords=4: permits real 4-word spoken responses while blocking 1-3 word UI chrome
      const lastParagraph = rawLastParagraph && isReadableParagraph(rawLastParagraph, 4) ? rawLastParagraph : null

      ttsQueue.enqueue(announcement)
      if (lastParagraph) ttsQueue.enqueue(lastParagraph)
    })

    const unsubApproval = window.agentHub.tts.onApprovalNeeded((agentId) => {
      const { soundEnabled, voiceEnabled } = useViewStore.getState()
      if (!soundEnabled) return

      const agent = agentsRef.current.get(agentId)
      if (!agent) return
      if (agent.voiceMode === 'off' || !voiceEnabled) return

      // Deduplicate: skip if this agent already has a pending approval announcement
      if (pendingApproval.current.has(agentId)) return
      pendingApproval.current.add(agentId)

      const announcement = `${agent.name} is waiting for your approval.`
      ttsQueue.enqueue(announcement)
    })

    // Clear approval dedup when agent leaves awaiting_approval (responseReady fires)
    const unsubResponseClear = window.agentHub.tts.onResponseReady((agentId) => {
      pendingApproval.current.delete(agentId)
    })

    return () => {
      unsubResponseReady()
      unsubApproval()
      unsubResponseClear()
    }
  }, [])

  const stopActiveSpeech = useCallback(() => {
    ttsQueue.clear()
    cancelSpeech()
  }, [])

  const readFullResponse = useCallback((agentId: string | null) => {
    if (!agentId) {
      console.warn('[useAgentTts] readFullResponse:', 'no agent focused — press arrow keys to select an agent first')
      return
    }
    const text = lastResponseText.current.get(agentId)
    if (!text) {
      console.warn('[useAgentTts] readFullResponse:', `no stored text for agent ${agentId}`)
      return
    }
    ttsQueue.clear()
    cancelSpeech()
    invokeTts(text).catch((err) => console.warn('[useAgentTts] readFullResponse error:', err))
  }, [])

  return { stopActiveSpeech, readFullResponse }
}
