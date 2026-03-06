import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { executeKillHierarchy, type KillHierarchyCallbacks } from './kill-hierarchy'

describe('Kill Hierarchy', () => {
  let callbacks: KillHierarchyCallbacks

  beforeEach(() => {
    vi.useFakeTimers()
    callbacks = {
      sendSignal: vi.fn(),
      updateStatus: vi.fn(),
      isProcessAlive: vi.fn().mockReturnValue(true),
      onWarning: vi.fn()
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('full escalation sequence', () => {
    it('sends SIGTSTP first', async () => {
      const promise = executeKillHierarchy('agent-1', 1234, callbacks)
      // SIGTSTP should be sent immediately
      expect(callbacks.sendSignal).toHaveBeenCalledWith(1234, 'SIGTSTP')
      // Clean up
      callbacks.isProcessAlive = vi.fn().mockReturnValue(false)
      await vi.runAllTimersAsync()
      await promise
    })

    it('updates status to paused after SIGTSTP', async () => {
      const promise = executeKillHierarchy('agent-1', 1234, callbacks)
      expect(callbacks.updateStatus).toHaveBeenCalledWith('agent-1', 'paused', 'confirmed')
      callbacks.isProcessAlive = vi.fn().mockReturnValue(false)
      await vi.runAllTimersAsync()
      await promise
    })

    it('sends SIGINT if process survives SIGTSTP', async () => {
      const promise = executeKillHierarchy('agent-1', 1234, callbacks)
      // Advance past SIGTSTP wait period
      await vi.advanceTimersByTimeAsync(2000)
      expect(callbacks.sendSignal).toHaveBeenCalledWith(1234, 'SIGINT')
      callbacks.isProcessAlive = vi.fn().mockReturnValue(false)
      await vi.runAllTimersAsync()
      await promise
    })

    it('waits 2 seconds after SIGINT before escalating to SIGTERM', async () => {
      const promise = executeKillHierarchy('agent-1', 1234, callbacks)
      // Advance past SIGTSTP wait
      await vi.advanceTimersByTimeAsync(2000)
      // SIGINT sent, advance 1.5s — SIGTERM should NOT be sent yet
      await vi.advanceTimersByTimeAsync(1500)
      expect(callbacks.sendSignal).not.toHaveBeenCalledWith(1234, 'SIGTERM')
      // Advance remaining 0.5s
      await vi.advanceTimersByTimeAsync(500)
      expect(callbacks.sendSignal).toHaveBeenCalledWith(1234, 'SIGTERM')
      callbacks.isProcessAlive = vi.fn().mockReturnValue(false)
      await vi.runAllTimersAsync()
      await promise
    })

    it('waits 5 seconds after SIGTERM before sending SIGKILL', async () => {
      const promise = executeKillHierarchy('agent-1', 1234, callbacks)
      // SIGTSTP wait
      await vi.advanceTimersByTimeAsync(2000)
      // SIGINT wait (2s)
      await vi.advanceTimersByTimeAsync(2000)
      // SIGTERM sent, advance 4s — SIGKILL not yet
      await vi.advanceTimersByTimeAsync(4000)
      expect(callbacks.sendSignal).not.toHaveBeenCalledWith(1234, 'SIGKILL')
      // Advance remaining 1s
      await vi.advanceTimersByTimeAsync(1000)
      expect(callbacks.sendSignal).toHaveBeenCalledWith(1234, 'SIGKILL')
      await promise
    })

    it('emits warning before SIGKILL about potential work loss', async () => {
      const promise = executeKillHierarchy('agent-1', 1234, callbacks)
      // Run through full sequence
      await vi.advanceTimersByTimeAsync(2000) // SIGTSTP wait
      await vi.advanceTimersByTimeAsync(2000) // SIGINT wait
      await vi.advanceTimersByTimeAsync(5000) // SIGTERM wait → SIGKILL
      expect(callbacks.onWarning).toHaveBeenCalledWith(
        'agent-1',
        expect.stringContaining('work may be lost')
      )
      await promise
    })
  })

  describe('early exit on process death', () => {
    it('stops escalation if process dies after SIGTSTP', async () => {
      const promise = executeKillHierarchy('agent-1', 1234, callbacks)
      // Process dies after SIGTSTP
      callbacks.isProcessAlive = vi.fn().mockReturnValue(false)
      await vi.advanceTimersByTimeAsync(2000)
      expect(callbacks.sendSignal).not.toHaveBeenCalledWith(1234, 'SIGINT')
      await promise
    })

    it('stops escalation if process dies after SIGINT', async () => {
      const promise = executeKillHierarchy('agent-1', 1234, callbacks)
      await vi.advanceTimersByTimeAsync(2000) // SIGINT sent
      // Process dies after SIGINT
      callbacks.isProcessAlive = vi.fn().mockReturnValue(false)
      await vi.advanceTimersByTimeAsync(2000)
      expect(callbacks.sendSignal).not.toHaveBeenCalledWith(1234, 'SIGTERM')
      await promise
    })

    it('stops escalation if process dies after SIGTERM', async () => {
      const promise = executeKillHierarchy('agent-1', 1234, callbacks)
      await vi.advanceTimersByTimeAsync(2000) // SIGTSTP wait
      await vi.advanceTimersByTimeAsync(2000) // SIGINT wait, SIGTERM sent
      // Process dies after SIGTERM
      callbacks.isProcessAlive = vi.fn().mockReturnValue(false)
      await vi.advanceTimersByTimeAsync(5000)
      expect(callbacks.sendSignal).not.toHaveBeenCalledWith(1234, 'SIGKILL')
      await promise
    })
  })

  describe('status updates at each transition', () => {
    it('updates status at every escalation step', async () => {
      const promise = executeKillHierarchy('agent-1', 1234, callbacks)

      // After SIGTSTP
      expect(callbacks.updateStatus).toHaveBeenCalledWith('agent-1', 'paused', 'confirmed')

      // After SIGINT
      await vi.advanceTimersByTimeAsync(2000)
      expect(callbacks.updateStatus).toHaveBeenCalledWith('agent-1', 'interrupted', 'confirmed')

      // After SIGTERM
      await vi.advanceTimersByTimeAsync(2000)
      // Still interrupted status

      // After SIGKILL
      await vi.advanceTimersByTimeAsync(5000)
      // Final status should be interrupted/confirmed
      // 4 calls: paused (SIGTSTP) + 3x interrupted (SIGINT, SIGTERM, SIGKILL)
      expect(callbacks.updateStatus).toHaveBeenCalledTimes(4)
      await promise
    })
  })

  describe('edge cases', () => {
    it('throws if agentId is empty', async () => {
      await expect(executeKillHierarchy('', 1234, callbacks)).rejects.toThrow()
    })

    it('handles pid of 0 gracefully', async () => {
      await expect(executeKillHierarchy('agent-1', 0, callbacks)).rejects.toThrow()
    })
  })
})
