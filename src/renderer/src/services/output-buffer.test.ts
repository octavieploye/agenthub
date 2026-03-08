import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the IPC boundary — window.agentHub.on.agentOutput is an Electron
// preload bridge, which qualifies as an external boundary per project rules.
let capturedIpcCallback: ((agentId: string, data: string) => void) | null = null
const mockUnsubscribe = vi.fn()

beforeEach(() => {
  capturedIpcCallback = null
  mockUnsubscribe.mockClear()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).window = {
    agentHub: {
      on: {
        agentOutput: vi.fn((cb: (agentId: string, data: string) => void) => {
          capturedIpcCallback = cb
          return mockUnsubscribe
        })
      }
    }
  }
})

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).window
})

// Dynamic import so each test suite gets a fresh module with the mock in place
async function createBuffer() {
  // Clear module cache to get a fresh singleton each time
  const modulePath = './output-buffer'
  vi.resetModules()
  const mod = await import(modulePath)
  const buffer = mod.outputBuffer
  return buffer
}

function simulateData(agentId: string, data: string): void {
  if (!capturedIpcCallback) throw new Error('IPC callback not registered — call start() first')
  capturedIpcCallback(agentId, data)
}

describe('OutputBuffer', () => {
  let buffer: Awaited<ReturnType<typeof createBuffer>>

  beforeEach(async () => {
    buffer = await createBuffer()
    buffer.start()
  })

  afterEach(() => {
    buffer.stop()
  })

  it('should subscribe to IPC on start()', () => {
    expect(capturedIpcCallback).not.toBeNull()
  })

  it('should unsubscribe on stop()', () => {
    buffer.stop()
    expect(mockUnsubscribe).toHaveBeenCalledOnce()
  })

  it('should not subscribe twice if start() is called multiple times', () => {
    buffer.start()
    buffer.start()
    // agentOutput mock was called once (in beforeEach start), not three times
    expect(window.agentHub.on.agentOutput).toHaveBeenCalledTimes(1)
  })

  describe('buffering', () => {
    it('should buffer data and return it on drain', () => {
      simulateData('agent-1', 'hello ')
      simulateData('agent-1', 'world')

      const cb = vi.fn()
      const result = buffer.drain('agent-1', cb)
      expect(result).toBe('hello world')
    })

    it('should return empty string when draining agent with no data', () => {
      const cb = vi.fn()
      const result = buffer.drain('agent-unknown', cb)
      expect(result).toBe('')
    })

    it('should buffer data per agent independently', () => {
      simulateData('agent-1', 'data-1')
      simulateData('agent-2', 'data-2')

      const cb1 = vi.fn()
      const cb2 = vi.fn()
      expect(buffer.drain('agent-1', cb1)).toBe('data-1')
      expect(buffer.drain('agent-2', cb2)).toBe('data-2')
    })
  })

  describe('2MB cap', () => {
    it('should drop oldest chunks when buffer exceeds 2MB', () => {
      const chunkSize = 512 * 1024 // 512KB
      const chunk = 'A'.repeat(chunkSize)

      // Write 5 chunks = 2.5MB, exceeding the 2MB limit
      for (let i = 0; i < 5; i++) {
        simulateData('agent-1', chunk)
      }

      const cb = vi.fn()
      const result = buffer.drain('agent-1', cb)

      // Should have dropped at least the first chunk to get under 2MB
      expect(result.length).toBeLessThanOrEqual(2 * 1024 * 1024)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should keep data under cap after multiple writes', () => {
      const MB = 1024 * 1024
      // Write 1MB chunks one at a time
      for (let i = 0; i < 4; i++) {
        simulateData('agent-1', 'X'.repeat(MB))
      }

      const cb = vi.fn()
      const result = buffer.drain('agent-1', cb)
      expect(result.length).toBeLessThanOrEqual(2 * MB)
    })
  })

  describe('passthrough', () => {
    it('should forward data to callback after drain', () => {
      simulateData('agent-1', 'buffered')

      const cb = vi.fn()
      buffer.drain('agent-1', cb)

      // New data should go to callback, not buffer
      simulateData('agent-1', 'live-data')
      expect(cb).toHaveBeenCalledWith('live-data')
    })

    it('should not buffer data while passthrough is active', () => {
      const cb1 = vi.fn()
      buffer.drain('agent-1', cb1)

      simulateData('agent-1', 'live')

      // Stop passthrough — should revert to buffering
      buffer.stopPassthrough('agent-1', cb1)

      simulateData('agent-1', 'buffered-again')

      const cb2 = vi.fn()
      const result = buffer.drain('agent-1', cb2)
      // Should only contain data that arrived after passthrough stopped
      expect(result).toBe('buffered-again')
    })
  })

  describe('multiple passthroughs', () => {
    it('should forward data to all registered callbacks', () => {
      const cb1 = vi.fn()
      const cb2 = vi.fn()

      buffer.drain('agent-1', cb1)
      buffer.drain('agent-1', cb2)

      simulateData('agent-1', 'broadcast')

      expect(cb1).toHaveBeenCalledWith('broadcast')
      expect(cb2).toHaveBeenCalledWith('broadcast')
    })

    it('should keep forwarding to remaining callback after one is removed', () => {
      const cb1 = vi.fn()
      const cb2 = vi.fn()

      buffer.drain('agent-1', cb1)
      buffer.drain('agent-1', cb2)

      buffer.stopPassthrough('agent-1', cb1)

      simulateData('agent-1', 'only-cb2')

      expect(cb1).not.toHaveBeenCalled()
      expect(cb2).toHaveBeenCalledWith('only-cb2')
    })
  })

  describe('stopPassthrough', () => {
    it('should revert to buffering when all passthroughs are removed', () => {
      const cb = vi.fn()
      buffer.drain('agent-1', cb)
      buffer.stopPassthrough('agent-1', cb)

      simulateData('agent-1', 'back-to-buffer')

      const cb2 = vi.fn()
      const result = buffer.drain('agent-1', cb2)
      expect(result).toBe('back-to-buffer')
    })

    it('should be a no-op for unknown agent or callback', () => {
      const cb = vi.fn()
      // Should not throw
      buffer.stopPassthrough('unknown', cb)
    })
  })

  describe('clear / clearAll', () => {
    it('should clear buffer for a specific agent', () => {
      simulateData('agent-1', 'data-1')
      simulateData('agent-2', 'data-2')

      buffer.clear('agent-1')

      const cb1 = vi.fn()
      const cb2 = vi.fn()
      expect(buffer.drain('agent-1', cb1)).toBe('')
      expect(buffer.drain('agent-2', cb2)).toBe('data-2')
    })

    it('should clear all buffers', () => {
      simulateData('agent-1', 'data-1')
      simulateData('agent-2', 'data-2')

      buffer.clearAll()

      const cb1 = vi.fn()
      const cb2 = vi.fn()
      expect(buffer.drain('agent-1', cb1)).toBe('')
      expect(buffer.drain('agent-2', cb2)).toBe('')
    })

    it('should be safe to call clear on non-existent agent', () => {
      buffer.clear('nonexistent')
      // No error thrown
    })
  })
})
