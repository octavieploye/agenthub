import { useEffect, useRef, useCallback } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import { cancelSpeech, extractLastParagraph, isReadableParagraph, speak } from '../services/voice-speaker'
import { useViewStore } from '../stores/view-store'

export interface AgentTtsOptions {
  /** Called when voiceMode is 'off' and an agent responds — plays a notification sound instead of speaking. */
  onNotificationSound?: () => void
}

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
export function useAgentTts(agents: Map<string, AgentState>, options?: AgentTtsOptions): AgentTtsActions {
  const agentsRef = useRef(agents)
  agentsRef.current = agents
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Stores the full clean response text per agent for Cmd+Shift+I replay
  const lastResponseText = useRef(new Map<string, string>())

  useEffect(() => {
    const unsubResponseReady = window.agentHub.tts.onResponseReady(async (agentId, cleanText) => {
      const agent = agentsRef.current.get(agentId)
      if (!agent) return

      if (agent.voiceMode === 'off') {
        optionsRef.current?.onNotificationSound?.()
        return
      }

      if (cleanText.trim()) {
        lastResponseText.current.set(agentId, cleanText)
      }

      const announcement = `${agent.name} has responded.`
      const rawLastParagraph = agent.voiceMode === 'always_on' ? extractLastParagraph(cleanText) : null
      const lastParagraph = rawLastParagraph && isReadableParagraph(rawLastParagraph) ? rawLastParagraph : null
      console.log('[TTS] onResponseReady', {
        agentId,
        agentName: agent.name,
        voiceMode: agent.voiceMode,
        cleanTextLen: cleanText.length,
        cleanTextPreview: cleanText.slice(0, 200).replace(/\n/g, '↵'),
        announcement,
        lastParagraph: lastParagraph ?? '(none)',
      })

      try {
        // Announce that the agent has responded (not "completed" — the task may still be ongoing)
        await invokeTts(announcement)
        if (lastParagraph) await invokeTts(lastParagraph)
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
