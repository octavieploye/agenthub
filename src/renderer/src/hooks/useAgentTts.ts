import { useEffect, useRef, useCallback } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import { cancelSpeech, speak } from '../services/voice-speaker'
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
 * This hook listens for that event and speaks a short status announcement
 * only — it never reads actual agent output aloud.
 *
 * Cmd+Shift+I → reads the full stored response for the focused agent.
 * Cmd+Shift+S → cancels any in-progress speech.
 */
export function useAgentTts(agents: Map<string, AgentState>): AgentTtsActions {
  const agentsRef = useRef(agents)
  agentsRef.current = agents

  // Stores the full clean response text per agent for Cmd+Shift+I replay
  const lastResponseText = useRef(new Map<string, string>())
  // Cooldown: skip re-announcing approval for the same agent within 30 seconds
  const approvalCooldown = useRef(new Map<string, number>())

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

      ttsQueue.enqueue(`${agent.name} has responded.`)
    })

    const unsubApproval = window.agentHub.tts.onApprovalNeeded((agentId) => {
      const { soundEnabled, voiceEnabled } = useViewStore.getState()
      if (!soundEnabled) return

      const agent = agentsRef.current.get(agentId)
      if (!agent) return
      if (agent.voiceMode === 'off' || !voiceEnabled) return

      // Deduplicate: skip if this agent was announced within the last 30 seconds
      const APPROVAL_COOLDOWN_MS = 30_000
      const lastAnnounced = approvalCooldown.current.get(agentId) ?? 0
      if (Date.now() - lastAnnounced < APPROVAL_COOLDOWN_MS) return
      approvalCooldown.current.set(agentId, Date.now())

      const announcement = `${agent.name} is waiting for your approval.`
      ttsQueue.enqueue(announcement)
    })

    return () => {
      unsubResponseReady()
      unsubApproval()
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
