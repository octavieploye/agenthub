import { useEffect, useRef } from 'react'
import { useViewStore } from '@renderer/stores/view-store'
import { useAgentStore } from '@renderer/stores/agent-store'

export interface KeyboardNavCallbacks {
  onSpawnDialog: () => void
  onCommandPalette: () => void
  onBriefingToggle: () => void
  onEscape: () => void
  onExpandFocused: () => void
  onContextMenuFocused: () => void
  onDeleteFocused: () => void
}

export function useKeyboardNav(callbacks: KeyboardNavCallbacks): void {
  const setViewMode = useViewStore((s) => s.setViewMode)
  const setFocusedAgent = useViewStore((s) => s.setFocusedAgent)
  const focusedAgentId = useViewStore((s) => s.focusedAgentId)
  const agents = useAgentStore((s) => s.agents)

  const focusedRef = useRef(focusedAgentId)
  focusedRef.current = focusedAgentId

  const agentsRef = useRef(agents)
  agentsRef.current = agents

  const setViewModeRef = useRef(setViewMode)
  setViewModeRef.current = setViewMode

  const setFocusedAgentRef = useRef(setFocusedAgent)
  setFocusedAgentRef.current = setFocusedAgent

  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const meta = e.metaKey || e.ctrlKey

      // Cmd+1/2/3 — view mode switching
      if (meta && e.key === '1') {
        e.preventDefault()
        setViewModeRef.current('raid')
        return
      }
      if (meta && e.key === '2') {
        e.preventDefault()
        setViewModeRef.current('channel')
        return
      }
      if (meta && e.key === '3') {
        e.preventDefault()
        setViewModeRef.current('terminal')
        return
      }

      // Cmd+N — spawn
      if (meta && e.key === 'n') {
        e.preventDefault()
        callbacksRef.current.onSpawnDialog()
        return
      }

      // Cmd+K — command palette
      if (meta && e.key === 'k') {
        e.preventDefault()
        callbacksRef.current.onCommandPalette()
        return
      }

      // Cmd+B — briefing toggle
      if (meta && e.key === 'b') {
        e.preventDefault()
        callbacksRef.current.onBriefingToggle()
        return
      }

      // Escape
      if (e.key === 'Escape') {
        callbacksRef.current.onEscape()
        return
      }

      // Tab — cycle through agents
      if (e.key === 'Tab') {
        e.preventDefault()
        const agentIds = Array.from(agentsRef.current.keys())
        if (agentIds.length === 0) return

        const currentFocused = focusedRef.current
        const currentIndex = currentFocused ? agentIds.indexOf(currentFocused) : -1

        let nextIndex: number
        if (e.shiftKey) {
          nextIndex = currentIndex <= 0 ? agentIds.length - 1 : currentIndex - 1
        } else {
          nextIndex = currentIndex >= agentIds.length - 1 ? 0 : currentIndex + 1
        }

        setFocusedAgentRef.current(agentIds[nextIndex])
        return
      }

      // Enter — expand focused
      if (e.key === 'Enter') {
        if (focusedRef.current) callbacksRef.current.onExpandFocused()
        return
      }

      // Space — context menu
      if (e.key === ' ') {
        if (focusedRef.current) callbacksRef.current.onContextMenuFocused()
        return
      }

      // Delete / Backspace — kill focused
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (focusedRef.current) callbacksRef.current.onDeleteFocused()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
