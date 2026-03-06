import { describe, it, expect, beforeEach } from 'vitest'
import { useViewStore } from './view-store'

describe('useViewStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useViewStore.setState({
      viewMode: 'raid',
      focusedAgentId: null,
      statusFilter: null,
      soundEnabled: true
    })
  })

  describe('viewMode', () => {
    it('defaults to raid', () => {
      const { viewMode } = useViewStore.getState()
      expect(viewMode).toBe('raid')
    })

    it('setViewMode changes the mode to channel', () => {
      useViewStore.getState().setViewMode('channel')
      expect(useViewStore.getState().viewMode).toBe('channel')
    })

    it('setViewMode changes the mode to terminal', () => {
      useViewStore.getState().setViewMode('terminal')
      expect(useViewStore.getState().viewMode).toBe('terminal')
    })
  })

  describe('focusedAgentId', () => {
    it('defaults to null', () => {
      const { focusedAgentId } = useViewStore.getState()
      expect(focusedAgentId).toBeNull()
    })

    it('setFocusedAgent updates focused agent', () => {
      useViewStore.getState().setFocusedAgent('agent-42')
      expect(useViewStore.getState().focusedAgentId).toBe('agent-42')
    })

    it('setFocusedAgent can clear focus with null', () => {
      useViewStore.getState().setFocusedAgent('agent-42')
      useViewStore.getState().setFocusedAgent(null)
      expect(useViewStore.getState().focusedAgentId).toBeNull()
    })
  })

  describe('statusFilter', () => {
    it('defaults to null', () => {
      const { statusFilter } = useViewStore.getState()
      expect(statusFilter).toBeNull()
    })

    it('setStatusFilter sets the filter', () => {
      useViewStore.getState().setStatusFilter('busy')
      expect(useViewStore.getState().statusFilter).toBe('busy')
    })

    it('setStatusFilter with null clears the filter', () => {
      useViewStore.getState().setStatusFilter('locked')
      useViewStore.getState().setStatusFilter(null)
      expect(useViewStore.getState().statusFilter).toBeNull()
    })
  })

  describe('soundEnabled', () => {
    it('defaults to true', () => {
      const { soundEnabled } = useViewStore.getState()
      expect(soundEnabled).toBe(true)
    })

    it('toggleSound flips from true to false', () => {
      useViewStore.getState().toggleSound()
      expect(useViewStore.getState().soundEnabled).toBe(false)
    })

    it('toggleSound flips from false back to true', () => {
      useViewStore.getState().toggleSound()
      useViewStore.getState().toggleSound()
      expect(useViewStore.getState().soundEnabled).toBe(true)
    })
  })
})
