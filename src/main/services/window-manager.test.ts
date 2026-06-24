import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockWindowInstances, windowIdState, MockBrowserWindowCtor } =
  vi.hoisted(() => {
    const windowIdState = { counter: 0 }

    interface MockBrowserWindowShape {
      id: number
      webContents: { id: number }
      isDestroyed: ReturnType<typeof vi.fn>
      focus: ReturnType<typeof vi.fn>
      close: ReturnType<typeof vi.fn>
      on: ReturnType<typeof vi.fn>
      loadURL: ReturnType<typeof vi.fn>
      loadFile: ReturnType<typeof vi.fn>
    }

    const mockWindowInstances: MockBrowserWindowShape[] = []

    function createMockBrowserWindow(): MockBrowserWindowShape {
      windowIdState.counter += 1
      return {
        id: windowIdState.counter,
        webContents: { id: windowIdState.counter + 1000 },
        isDestroyed: vi.fn(() => false),
        focus: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
        loadURL: vi.fn(),
        loadFile: vi.fn()
      }
    }

    // Use a regular function so it can be invoked with `new`
    const MockBrowserWindowCtor = vi.fn(function (this: unknown) {
      const win = createMockBrowserWindow()
      mockWindowInstances.push(win)
      Object.assign(this as object, win)
    })

    return { mockWindowInstances, createMockBrowserWindow, windowIdState, MockBrowserWindowCtor }
  })

vi.mock('electron', () => ({
  BrowserWindow: MockBrowserWindowCtor
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

import { WindowManager } from './window-manager'

function getLastMockWindow() {
  return mockWindowInstances[mockWindowInstances.length - 1]
}

describe('WindowManager', () => {
  let wm: WindowManager
  const deps = { logInfo: vi.fn(), emitToAllRenderers: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    windowIdState.counter = 0
    mockWindowInstances.length = 0
    ;(process.env as Record<string, string>)['ELECTRON_RENDERER_URL'] = 'http://localhost:5173'
    wm = new WindowManager(deps)
  })

  describe('createBreakout', () => {
    it('creates a breakout window and returns info', () => {
      const info = wm.createBreakout('agent-1', 'Test Agent', '/path/to/repo', '#3B82F6')

      expect(info.agentId).toBe('agent-1')
      expect(info.agentName).toBe('Test Agent')
      expect(info.repoPath).toBe('/path/to/repo')
      expect(info.agentColor).toBe('#3B82F6')
      expect(typeof info.windowId).toBe('number')
    })

    it('loads URL with breakout query params in dev mode', () => {
      wm.createBreakout('agent-1', 'Test', '/repo', '#000')

      const mockWin = getLastMockWindow()
      expect(mockWin.loadURL).toHaveBeenCalledWith(
        expect.stringContaining('breakout=true')
      )
      expect(mockWin.loadURL).toHaveBeenCalledWith(
        expect.stringContaining('agentId=agent-1')
      )
    })

    it('reuses existing breakout window for same agent', () => {
      const info1 = wm.createBreakout('agent-1', 'Test', '/repo', '#000')
      const info2 = wm.createBreakout('agent-1', 'Test', '/repo', '#000')

      expect(info1.windowId).toBe(info2.windowId)
      // Only one BrowserWindow should have been constructed
      expect(mockWindowInstances).toHaveLength(1)
      const mockWin = getLastMockWindow()
      expect(mockWin.focus).toHaveBeenCalled()
    })

    it('creates separate windows for different agents', () => {
      wm.createBreakout('agent-1', 'Test 1', '/repo1', '#000')
      wm.createBreakout('agent-2', 'Test 2', '/repo2', '#FFF')

      const list = wm.listBreakouts()
      expect(list).toHaveLength(2)
      expect(mockWindowInstances).toHaveLength(2)
    })

    it('registers closed handler that cleans up', () => {
      wm.createBreakout('agent-1', 'Test', '/repo', '#000')

      const mockWin = getLastMockWindow()
      const closedCall = mockWin.on.mock.calls.find(
        (c: unknown[]) => c[0] === 'closed'
      )
      expect(closedCall).toBeDefined()

      // Simulate the 'closed' event
      const closedHandler = closedCall![1] as () => void
      closedHandler()

      expect(wm.listBreakouts()).toHaveLength(0)
    })

    it('emits breakout-closed event when window closes', () => {
      wm.createBreakout('agent-1', 'Test', '/repo', '#000')

      const mockWin = getLastMockWindow()
      const closedCall = mockWin.on.mock.calls.find(
        (c: unknown[]) => c[0] === 'closed'
      )
      const closedHandler = closedCall![1] as () => void
      closedHandler()

      expect(deps.emitToAllRenderers).toHaveBeenCalledWith(
        'on-windows:breakout-closed',
        'agent-1'
      )
    })

    it('logs breakout creation', () => {
      const info = wm.createBreakout('agent-1', 'Test', '/repo', '#000')

      expect(deps.logInfo).toHaveBeenCalledWith('Breakout window created', {
        agentId: 'agent-1',
        windowId: info.windowId
      })
    })

    it('sets window title from agent name and repo folder', () => {
      wm.createBreakout('agent-1', 'Builder', '/home/user/my-project', '#3B82F6')

      const constructorCall = (MockBrowserWindowCtor.mock.calls as unknown as Record<string, unknown>[][])[0][0]
      expect(constructorCall.title).toContain('Builder')
      expect(constructorCall.title).toContain('my-project')
    })

    it('creates new window if previous was destroyed', () => {
      wm.createBreakout('agent-1', 'Test', '/repo', '#000')
      const firstWin = getLastMockWindow()
      firstWin.isDestroyed.mockReturnValue(true)

      wm.createBreakout('agent-1', 'Test', '/repo', '#000')
      expect(mockWindowInstances).toHaveLength(2)
    })

    it('calls onBreakoutOpened with agentId and webContentsId when breakout is created', () => {
      const onBreakoutOpened = vi.fn()
      const wmWithCb = new WindowManager({ ...deps, onBreakoutOpened })
      wmWithCb.createBreakout('agent-1', 'Test', '/repo', '#000')

      const win = getLastMockWindow()
      expect(onBreakoutOpened).toHaveBeenCalledWith('agent-1', win.webContents.id)
    })

    it('calls onBreakoutOpened only once when reusing existing breakout', () => {
      const onBreakoutOpened = vi.fn()
      const wmWithCb = new WindowManager({ ...deps, onBreakoutOpened })
      wmWithCb.createBreakout('agent-1', 'Test', '/repo', '#000')
      wmWithCb.createBreakout('agent-1', 'Test', '/repo', '#000') // reuse

      expect(onBreakoutOpened).toHaveBeenCalledTimes(1)
    })
  })

  describe('closeBreakout', () => {
    it('closes the window for the agent', () => {
      wm.createBreakout('agent-1', 'Test', '/repo', '#000')
      const mockWin = getLastMockWindow()

      wm.closeBreakout('agent-1')
      expect(mockWin.close).toHaveBeenCalled()
    })

    it('suppresses breakout-closed event on programmatic close', () => {
      wm.createBreakout('agent-1', 'Test', '/repo', '#000')
      const mockWin = getLastMockWindow()
      // Simulate close() triggering the 'closed' handler
      mockWin.close.mockImplementation(() => {
        const closedCall = mockWin.on.mock.calls.find(
          (c: unknown[]) => c[0] === 'closed'
        )
        ;(closedCall![1] as () => void)()
      })

      wm.closeBreakout('agent-1')
      expect(deps.emitToAllRenderers).not.toHaveBeenCalled()
    })

    it('does nothing for unknown agent', () => {
      expect(() => wm.closeBreakout('unknown')).not.toThrow()
    })

    it('removes agent from breakout list after close', () => {
      wm.createBreakout('agent-1', 'Test', '/repo', '#000')
      wm.closeBreakout('agent-1')

      expect(wm.listBreakouts()).toHaveLength(0)
    })

    it('does not call close on already destroyed window', () => {
      wm.createBreakout('agent-1', 'Test', '/repo', '#000')
      const mockWin = getLastMockWindow()
      mockWin.isDestroyed.mockReturnValue(true)

      wm.closeBreakout('agent-1')
      expect(mockWin.close).not.toHaveBeenCalled()
    })

    it('calls onBreakoutClosed with agentId when window closes via user', () => {
      const onBreakoutClosed = vi.fn()
      const wmWithCb = new WindowManager({ ...deps, onBreakoutClosed })
      wmWithCb.createBreakout('agent-1', 'Test', '/repo', '#000')

      const mockWin = getLastMockWindow()
      const closedCall = mockWin.on.mock.calls.find(
        (c: unknown[]) => c[0] === 'closed'
      )
      const closedHandler = closedCall![1] as () => void
      closedHandler()

      expect(onBreakoutClosed).toHaveBeenCalledWith('agent-1')
    })

    it('calls onBreakoutClosed even on programmatic close (ownership must be released)', () => {
      const onBreakoutClosed = vi.fn()
      const wmWithCb = new WindowManager({ ...deps, onBreakoutClosed })
      wmWithCb.createBreakout('agent-1', 'Test', '/repo', '#000')

      const mockWin = getLastMockWindow()
      mockWin.close.mockImplementation(() => {
        const closedCall = mockWin.on.mock.calls.find(
          (c: unknown[]) => c[0] === 'closed'
        )
        ;(closedCall![1] as () => void)()
      })

      wmWithCb.closeBreakout('agent-1')
      expect(onBreakoutClosed).toHaveBeenCalledWith('agent-1')
    })
  })

  describe('focusBreakout', () => {
    it('focuses the window', () => {
      wm.createBreakout('agent-1', 'Test', '/repo', '#000')
      const mockWin = getLastMockWindow()

      wm.focusBreakout('agent-1')
      expect(mockWin.focus).toHaveBeenCalled()
    })

    it('does nothing for unknown agent', () => {
      expect(() => wm.focusBreakout('unknown')).not.toThrow()
    })

    it('does not focus destroyed window', () => {
      wm.createBreakout('agent-1', 'Test', '/repo', '#000')
      const mockWin = getLastMockWindow()
      mockWin.isDestroyed.mockReturnValue(true)

      wm.focusBreakout('agent-1')
      // focus is called once during createBreakout only if reuse path taken;
      // here we check no extra focus call after isDestroyed is true
      const focusCallsBeforeDestroy = mockWin.focus.mock.calls.length
      wm.focusBreakout('agent-1')
      expect(mockWin.focus.mock.calls.length).toBe(focusCallsBeforeDestroy)
    })
  })

  describe('listBreakouts', () => {
    it('returns empty array initially', () => {
      expect(wm.listBreakouts()).toEqual([])
    })

    it('returns all active breakouts', () => {
      wm.createBreakout('agent-1', 'A1', '/r1', '#000')
      wm.createBreakout('agent-2', 'A2', '/r2', '#FFF')

      const list = wm.listBreakouts()
      expect(list).toHaveLength(2)
      expect(list.map((b) => b.agentId)).toContain('agent-1')
      expect(list.map((b) => b.agentId)).toContain('agent-2')
    })

    it('cleans up destroyed windows', () => {
      wm.createBreakout('agent-1', 'A1', '/r1', '#000')
      const mockWin = getLastMockWindow()
      mockWin.isDestroyed.mockReturnValue(true)

      expect(wm.listBreakouts()).toHaveLength(0)
    })

    it('returns correct info fields', () => {
      wm.createBreakout('agent-1', 'Builder', '/workspace/repo', '#FF5733')

      const list = wm.listBreakouts()
      expect(list[0]).toEqual({
        agentId: 'agent-1',
        windowId: expect.any(Number),
        agentName: 'Builder',
        repoPath: '/workspace/repo',
        agentColor: '#FF5733'
      })
    })
  })

  describe('closeAll', () => {
    it('closes all breakout windows', () => {
      wm.createBreakout('agent-1', 'A1', '/r1', '#000')
      wm.createBreakout('agent-2', 'A2', '/r2', '#FFF')

      wm.closeAll()
      expect(wm.listBreakouts()).toHaveLength(0)
    })

    it('calls close on each non-destroyed window', () => {
      wm.createBreakout('agent-1', 'A1', '/r1', '#000')
      wm.createBreakout('agent-2', 'A2', '/r2', '#FFF')

      const [win1, win2] = mockWindowInstances
      wm.closeAll()

      expect(win1.close).toHaveBeenCalled()
      expect(win2.close).toHaveBeenCalled()
    })

    it('skips close on already destroyed windows', () => {
      wm.createBreakout('agent-1', 'A1', '/r1', '#000')
      wm.createBreakout('agent-2', 'A2', '/r2', '#FFF')

      const [win1] = mockWindowInstances
      win1.isDestroyed.mockReturnValue(true)

      wm.closeAll()
      expect(win1.close).not.toHaveBeenCalled()
    })

    it('handles empty breakout list', () => {
      expect(() => wm.closeAll()).not.toThrow()
    })

    it('suppresses breakout-closed events during closeAll', () => {
      wm.createBreakout('agent-1', 'A1', '/r1', '#000')
      wm.createBreakout('agent-2', 'A2', '/r2', '#FFF')

      // Simulate close() triggering the 'closed' handler for each
      for (const win of mockWindowInstances) {
        win.close.mockImplementation(() => {
          const closedCall = win.on.mock.calls.find(
            (c: unknown[]) => c[0] === 'closed'
          )
          ;(closedCall![1] as () => void)()
        })
      }

      wm.closeAll()
      expect(deps.emitToAllRenderers).not.toHaveBeenCalled()
    })
  })
})
