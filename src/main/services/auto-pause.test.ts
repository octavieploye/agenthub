import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AutoPauseService } from './auto-pause'
import type { AutoPauseDeps } from './auto-pause'
import type { HealthAnomaly } from '@shared/types/health.types'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

// ─── Helpers ────────────────────────────────────────────────────────────────

function createDeps(overrides: Partial<AutoPauseDeps> = {}): AutoPauseDeps {
  return {
    pauseAgent: vi.fn(),
    sendNotification: vi.fn(),
    emitToRenderer: vi.fn(),
    logWarning: vi.fn(),
    ...overrides
  }
}

function makeAnomaly(overrides: Partial<HealthAnomaly> = {}): HealthAnomaly {
  return {
    id: 'anomaly-1',
    agentId: 'agent-1',
    type: 'loop',
    tier: 'yellow',
    message: 'File /src/index.ts modified 3 times',
    details: { filePath: '/src/index.ts', modificationCount: 3 },
    detectedAt: Date.now(),
    ...overrides
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AutoPauseService', () => {
  let deps: AutoPauseDeps
  let service: AutoPauseService

  beforeEach(() => {
    vi.useFakeTimers()
    deps = createDeps()
    service = new AutoPauseService(deps)
  })

  afterEach(() => {
    service.stopReminderTimer()
    vi.useRealTimers()
  })

  // ─── handleAnomaly ──────────────────────────────────────────────────

  describe('handleAnomaly', () => {
    it('pauses the agent on first anomaly', () => {
      const anomaly = makeAnomaly({ agentId: 'agent-1' })
      service.handleAnomaly(anomaly)

      expect(deps.pauseAgent).toHaveBeenCalledWith('agent-1')
    })

    it('emits on-agents:paused-by-guardrail event to renderer with anomaly data', () => {
      const anomaly = makeAnomaly({ agentId: 'agent-1' })
      service.handleAnomaly(anomaly)

      expect(deps.emitToRenderer).toHaveBeenCalledWith(
        'on-agents:paused-by-guardrail',
        expect.objectContaining({ agentId: 'agent-1' })
      )
    })

    it('sends desktop notification with agent ID and anomaly message', () => {
      const anomaly = makeAnomaly({
        agentId: 'agent-1',
        message: 'File /src/index.ts modified 3 times'
      })
      service.handleAnomaly(anomaly)

      expect(deps.sendNotification).toHaveBeenCalledWith(
        expect.stringContaining('agent-1'),
        expect.stringContaining('File /src/index.ts modified 3 times')
      )
    })

    it('adds agent to paused agents map', () => {
      const anomaly = makeAnomaly({ agentId: 'agent-1' })
      service.handleAnomaly(anomaly)

      const paused = service.getPausedAgent('agent-1')
      expect(paused).not.toBeNull()
      expect(paused!.agentId).toBe('agent-1')
      expect(paused!.anomalies).toHaveLength(1)
      expect(paused!.anomalies[0]).toEqual(anomaly)
    })

    it('accumulates multiple anomalies for the same agent without pausing twice', () => {
      const anomaly1 = makeAnomaly({ id: 'anomaly-1', agentId: 'agent-1', type: 'loop' })
      const anomaly2 = makeAnomaly({ id: 'anomaly-2', agentId: 'agent-1', type: 'overtime' })

      service.handleAnomaly(anomaly1)
      service.handleAnomaly(anomaly2)

      // pauseAgent should only be called once (on first anomaly)
      expect(deps.pauseAgent).toHaveBeenCalledTimes(1)

      // But both anomalies should be tracked
      const paused = service.getPausedAgent('agent-1')
      expect(paused!.anomalies).toHaveLength(2)
    })

    it('logs warning for each anomaly handled', () => {
      const anomaly = makeAnomaly({ agentId: 'agent-1' })
      service.handleAnomaly(anomaly)

      expect(deps.logWarning).toHaveBeenCalledWith(
        expect.stringContaining('agent-1'),
        expect.objectContaining({ anomalyId: 'anomaly-1' })
      )
    })
  })

  // ─── getPausedAgents / getPausedAgent ───────────────────────────────

  describe('getPausedAgents / getPausedAgent', () => {
    it('returns all paused agents', () => {
      service.handleAnomaly(makeAnomaly({ agentId: 'agent-1' }))
      service.handleAnomaly(makeAnomaly({ id: 'anomaly-2', agentId: 'agent-2' }))

      const pausedMap = service.getPausedAgents()
      expect(pausedMap.size).toBe(2)
      expect(pausedMap.has('agent-1')).toBe(true)
      expect(pausedMap.has('agent-2')).toBe(true)
    })

    it('returns specific paused agent info', () => {
      const anomaly = makeAnomaly({ agentId: 'agent-1' })
      service.handleAnomaly(anomaly)

      const info = service.getPausedAgent('agent-1')
      expect(info).not.toBeNull()
      expect(info!.agentId).toBe('agent-1')
      expect(info!.pausedAt).toBeGreaterThan(0)
      expect(info!.reminderSentAt).toBeNull()
    })

    it('returns null for non-paused agent', () => {
      const info = service.getPausedAgent('non-existent')
      expect(info).toBeNull()
    })
  })

  // ─── resumeAgent ───────────────────────────────────────────────────

  describe('resumeAgent', () => {
    it('removes agent from paused agents map', () => {
      service.handleAnomaly(makeAnomaly({ agentId: 'agent-1' }))
      expect(service.getPausedAgent('agent-1')).not.toBeNull()

      service.resumeAgent('agent-1')
      expect(service.getPausedAgent('agent-1')).toBeNull()
    })

    it('does not call pauseAgent again after resume (no re-pause)', () => {
      service.handleAnomaly(makeAnomaly({ agentId: 'agent-1' }))
      expect(deps.pauseAgent).toHaveBeenCalledTimes(1)

      service.resumeAgent('agent-1')

      // Verify pauseAgent was not called again during resume
      expect(deps.pauseAgent).toHaveBeenCalledTimes(1)
    })
  })

  // ─── dismissAnomaly ────────────────────────────────────────────────

  describe('dismissAnomaly', () => {
    it('removes a specific anomaly from the paused agent', () => {
      const anomaly1 = makeAnomaly({ id: 'anomaly-1', agentId: 'agent-1', type: 'loop' })
      const anomaly2 = makeAnomaly({ id: 'anomaly-2', agentId: 'agent-1', type: 'overtime' })
      service.handleAnomaly(anomaly1)
      service.handleAnomaly(anomaly2)

      service.dismissAnomaly('agent-1', 'anomaly-1')

      const info = service.getPausedAgent('agent-1')
      expect(info).not.toBeNull()
      expect(info!.anomalies).toHaveLength(1)
      expect(info!.anomalies[0].id).toBe('anomaly-2')
    })

    it('removes agent from paused map if all anomalies are dismissed', () => {
      service.handleAnomaly(makeAnomaly({ id: 'anomaly-1', agentId: 'agent-1' }))

      service.dismissAnomaly('agent-1', 'anomaly-1')

      expect(service.getPausedAgent('agent-1')).toBeNull()
    })
  })

  // ─── Reminder timer ────────────────────────────────────────────────

  describe('reminder timer', () => {
    it('sends reminder notification after interval for still-paused agents', () => {
      service.handleAnomaly(makeAnomaly({ agentId: 'agent-1' }))
      // Clear the initial notification call
      ;(deps.sendNotification as ReturnType<typeof vi.fn>).mockClear()

      service.startReminderTimer(5 * 60 * 1000) // 5 minutes

      // Advance 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000)

      expect(deps.sendNotification).toHaveBeenCalledWith(
        expect.stringContaining('agent-1'),
        expect.stringContaining('still paused')
      )
    })

    it('sets reminderSentAt timestamp after reminder', () => {
      service.handleAnomaly(makeAnomaly({ agentId: 'agent-1' }))
      service.startReminderTimer(5 * 60 * 1000)

      const beforeReminder = service.getPausedAgent('agent-1')
      expect(beforeReminder!.reminderSentAt).toBeNull()

      vi.advanceTimersByTime(5 * 60 * 1000)

      const afterReminder = service.getPausedAgent('agent-1')
      expect(afterReminder!.reminderSentAt).not.toBeNull()
      expect(afterReminder!.reminderSentAt).toBeGreaterThan(0)
    })

    it('does not send reminder if agent was already reminded within same period', () => {
      service.handleAnomaly(makeAnomaly({ agentId: 'agent-1' }))
      ;(deps.sendNotification as ReturnType<typeof vi.fn>).mockClear()

      service.startReminderTimer(5 * 60 * 1000)

      // First reminder fires
      vi.advanceTimersByTime(5 * 60 * 1000)
      const callCountAfterFirst = (deps.sendNotification as ReturnType<typeof vi.fn>).mock.calls.length
      expect(callCountAfterFirst).toBe(1)

      // Second interval fires — should NOT send a second reminder
      vi.advanceTimersByTime(5 * 60 * 1000)
      const callCountAfterSecond = (deps.sendNotification as ReturnType<typeof vi.fn>).mock.calls.length
      expect(callCountAfterSecond).toBe(callCountAfterFirst)
    })

    it('stopReminderTimer stops the interval', () => {
      service.handleAnomaly(makeAnomaly({ agentId: 'agent-1' }))
      ;(deps.sendNotification as ReturnType<typeof vi.fn>).mockClear()

      service.startReminderTimer(5 * 60 * 1000)
      service.stopReminderTimer()

      vi.advanceTimersByTime(5 * 60 * 1000)

      // No reminder should have been sent after stopping
      expect(deps.sendNotification).not.toHaveBeenCalled()
    })

    it('uses default 5-minute interval', () => {
      service.handleAnomaly(makeAnomaly({ agentId: 'agent-1' }))
      ;(deps.sendNotification as ReturnType<typeof vi.fn>).mockClear()

      service.startReminderTimer() // no argument — should default to 5 min

      // At 4 minutes — no reminder yet
      vi.advanceTimersByTime(4 * 60 * 1000)
      expect(deps.sendNotification).not.toHaveBeenCalled()

      // At 5 minutes — reminder fires
      vi.advanceTimersByTime(1 * 60 * 1000)
      expect(deps.sendNotification).toHaveBeenCalled()
    })
  })
})
