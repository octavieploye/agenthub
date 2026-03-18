import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardNav } from './useKeyboardNav'

// Mock stores
const mockSetViewMode = vi.fn()
const mockSetFocusedAgent = vi.fn()
const mockViewMode = { current: 'raid' as string }
const mockFocusedAgentId = { current: null as string | null }
const mockAgentIds = { current: ['a1', 'a2', 'a3'] }

vi.mock('@renderer/stores/view-store', () => ({
  useViewStore: vi.fn((selector) => {
    const state = {
      viewMode: mockViewMode.current,
      focusedAgentId: mockFocusedAgentId.current,
      setViewMode: mockSetViewMode,
      setFocusedAgent: mockSetFocusedAgent
    }
    return typeof selector === 'function' ? selector(state) : state
  })
}))

vi.mock('@renderer/stores/agent-store', () => ({
  useAgentStore: vi.fn((selector) => {
    const agentsMap = new Map(mockAgentIds.current.map((id) => [id, { id }]))
    const state = {
      agents: agentsMap,
      activeAgentId: mockFocusedAgentId.current
    }
    return typeof selector === 'function' ? selector(state) : state
  })
}))

function dispatchKey(key: string, opts: Partial<KeyboardEvent> = {}): void {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts
  })
  document.dispatchEvent(event)
}

describe('useKeyboardNav', () => {
  const callbacks = {
    onSpawnDialog: vi.fn(),
    onCommandPalette: vi.fn(),
    onEscape: vi.fn(),
    onExpandFocused: vi.fn(),
    onContextMenuFocused: vi.fn(),
    onDeleteFocused: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockViewMode.current = 'raid'
    mockFocusedAgentId.current = null
  })

  describe('view mode shortcuts', () => {
    it('Cmd+1 switches to raid view', () => {
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('1', { metaKey: true })
      expect(mockSetViewMode).toHaveBeenCalledWith('raid')
    })

    it('Cmd+2 switches to terminal view', () => {
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('2', { metaKey: true })
      expect(mockSetViewMode).toHaveBeenCalledWith('terminal')
    })

    it('does not switch view mode without metaKey', () => {
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('1')
      expect(mockSetViewMode).not.toHaveBeenCalled()
    })
  })

  describe('action shortcuts', () => {
    it('Cmd+N triggers spawn dialog', () => {
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('n', { metaKey: true })
      expect(callbacks.onSpawnDialog).toHaveBeenCalledOnce()
    })

    it('Cmd+K opens command palette', () => {
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('k', { metaKey: true })
      expect(callbacks.onCommandPalette).toHaveBeenCalledOnce()
    })

  })

  describe('navigation keys', () => {
    it('Escape fires onEscape callback', () => {
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('Escape')
      expect(callbacks.onEscape).toHaveBeenCalledOnce()
    })

    it('Tab cycles focusedAgentId forward through agents', () => {
      mockFocusedAgentId.current = 'a1'
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('Tab')
      expect(mockSetFocusedAgent).toHaveBeenCalledWith('a2')
    })

    it('Tab wraps from last agent to first', () => {
      mockFocusedAgentId.current = 'a3'
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('Tab')
      expect(mockSetFocusedAgent).toHaveBeenCalledWith('a1')
    })

    it('Tab focuses first agent when none is focused', () => {
      mockFocusedAgentId.current = null
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('Tab')
      expect(mockSetFocusedAgent).toHaveBeenCalledWith('a1')
    })

    it('Shift+Tab cycles focusedAgentId backward', () => {
      mockFocusedAgentId.current = 'a2'
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('Tab', { shiftKey: true })
      expect(mockSetFocusedAgent).toHaveBeenCalledWith('a1')
    })

    it('Enter fires onExpandFocused when an agent is focused', () => {
      mockFocusedAgentId.current = 'a1'
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('Enter')
      expect(callbacks.onExpandFocused).toHaveBeenCalledOnce()
    })

    it('Space fires onContextMenuFocused when an agent is focused', () => {
      mockFocusedAgentId.current = 'a1'
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey(' ')
      expect(callbacks.onContextMenuFocused).toHaveBeenCalledOnce()
    })

    it('Delete fires onDeleteFocused when an agent is focused', () => {
      mockFocusedAgentId.current = 'a1'
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('Delete')
      expect(callbacks.onDeleteFocused).toHaveBeenCalledOnce()
    })

    it('Backspace also fires onDeleteFocused (macOS compat)', () => {
      mockFocusedAgentId.current = 'a1'
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('Backspace')
      expect(callbacks.onDeleteFocused).toHaveBeenCalledOnce()
    })
  })

  describe('no-op when no agent focused', () => {
    it('Enter does nothing when no agent is focused', () => {
      mockFocusedAgentId.current = null
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('Enter')
      expect(callbacks.onExpandFocused).not.toHaveBeenCalled()
    })

    it('Space does nothing when no agent is focused', () => {
      mockFocusedAgentId.current = null
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey(' ')
      expect(callbacks.onContextMenuFocused).not.toHaveBeenCalled()
    })

    it('Delete does nothing when no agent is focused', () => {
      mockFocusedAgentId.current = null
      renderHook(() => useKeyboardNav(callbacks))
      dispatchKey('Delete')
      expect(callbacks.onDeleteFocused).not.toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('removes event listener on unmount', () => {
      const spy = vi.spyOn(document, 'removeEventListener')
      const { unmount } = renderHook(() => useKeyboardNav(callbacks))
      unmount()
      expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function))
      spy.mockRestore()
    })
  })
})
