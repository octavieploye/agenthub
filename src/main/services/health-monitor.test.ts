import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HealthMonitor } from './health-monitor'
import type { HealthMonitorCallbacks, HealthAnomaly } from '@shared/types/health.types'
import type { GuardrailConfig } from '@shared/types/config.types'
import { DEFAULT_GUARDRAILS } from '@shared/types/config.types'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

function createCallbacks(overrides: Partial<HealthMonitorCallbacks> = {}): HealthMonitorCallbacks {
  return {
    onAnomaly: vi.fn(),
    getGuardrails: vi.fn().mockReturnValue({ ...DEFAULT_GUARDRAILS }),
    logWarning: vi.fn(),
    ...overrides
  }
}

function createGuardrails(overrides: Partial<GuardrailConfig> = {}): GuardrailConfig {
  return { ...DEFAULT_GUARDRAILS, ...overrides }
}

describe('HealthMonitor', () => {
  let callbacks: HealthMonitorCallbacks
  let monitor: HealthMonitor

  beforeEach(() => {
    vi.useFakeTimers()
    callbacks = createCallbacks()
    monitor = new HealthMonitor(callbacks)
  })

  afterEach(() => {
    monitor.stopWatchdog()
    vi.useRealTimers()
  })

  // ─── registration ────────────────────────────────────────────────

  describe('registration', () => {
    it('creates a snapshot when an agent is registered', () => {
      monitor.registerAgent('agent-1')
      const snapshot = monitor.getSnapshot('agent-1')
      expect(snapshot).not.toBeNull()
      expect(snapshot!.agentId).toBe('agent-1')
      expect(snapshot!.filesModified).toBeInstanceOf(Map)
      expect(snapshot!.totalFilesChanged).toBe(0)
      expect(snapshot!.consecutiveErrors).toBe(0)
      expect(snapshot!.anomalies).toEqual([])
    })

    it('removes the snapshot when an agent is unregistered', () => {
      monitor.registerAgent('agent-1')
      monitor.unregisterAgent('agent-1')
      const snapshot = monitor.getSnapshot('agent-1')
      expect(snapshot).toBeNull()
    })

    it('returns null for an unregistered agent', () => {
      const snapshot = monitor.getSnapshot('non-existent')
      expect(snapshot).toBeNull()
    })
  })

  // ─── loop detection ──────────────────────────────────────────────

  describe('loop detection', () => {
    beforeEach(() => {
      monitor.registerAgent('agent-1')
    })

    it('does not flag anomaly when a file is modified 1 time', () => {
      monitor.recordFileModification('agent-1', '/src/index.ts')
      const anomalies = monitor.checkAgent('agent-1')
      const loopAnomalies = anomalies.filter(a => a.type === 'loop')
      expect(loopAnomalies).toHaveLength(0)
    })

    it('does not flag anomaly when a file is modified 2 times', () => {
      monitor.recordFileModification('agent-1', '/src/index.ts')
      monitor.recordFileModification('agent-1', '/src/index.ts')
      const anomalies = monitor.checkAgent('agent-1')
      const loopAnomalies = anomalies.filter(a => a.type === 'loop')
      expect(loopAnomalies).toHaveLength(0)
    })

    it('flags yellow anomaly when a file is modified 3 times', () => {
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }
      const anomalies = monitor.checkAgent('agent-1')
      const loopAnomalies = anomalies.filter(a => a.type === 'loop')
      expect(loopAnomalies).toHaveLength(1)
      expect(loopAnomalies[0].tier).toBe('yellow')
    })

    it('flags orange anomaly when a file is modified 5+ times', () => {
      for (let i = 0; i < 5; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }
      const anomalies = monitor.checkAgent('agent-1')
      const loopAnomalies = anomalies.filter(a => a.type === 'loop')
      expect(loopAnomalies.some(a => a.tier === 'orange')).toBe(true)
    })

    it('flags red anomaly when a file is modified 8+ times', () => {
      for (let i = 0; i < 8; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }
      const anomalies = monitor.checkAgent('agent-1')
      const loopAnomalies = anomalies.filter(a => a.type === 'loop')
      expect(loopAnomalies.some(a => a.tier === 'red')).toBe(true)
    })

    it('tracks multiple files independently', () => {
      // File A: 3 modifications (yellow)
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/a.ts')
      }
      // File B: 1 modification (no anomaly)
      monitor.recordFileModification('agent-1', '/src/b.ts')

      const anomalies = monitor.checkAgent('agent-1')
      const loopAnomalies = anomalies.filter(a => a.type === 'loop')
      expect(loopAnomalies).toHaveLength(1)
      expect(loopAnomalies[0].details['filePath']).toBe('/src/a.ts')
    })

    it('includes file path and modification count in anomaly details', () => {
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }
      const anomalies = monitor.checkAgent('agent-1')
      const loopAnomaly = anomalies.find(a => a.type === 'loop')
      expect(loopAnomaly).toBeDefined()
      expect(loopAnomaly!.details['filePath']).toBe('/src/index.ts')
      expect(loopAnomaly!.details['modificationCount']).toBe(3)
    })
  })

  // ─── overtime detection ──────────────────────────────────────────

  describe('overtime detection', () => {
    beforeEach(() => {
      monitor.registerAgent('agent-1')
    })

    it('does not flag anomaly when within duration limit', () => {
      // Agent started now, check immediately (0 minutes elapsed)
      const anomalies = monitor.checkAgent('agent-1')
      const overtimeAnomalies = anomalies.filter(a => a.type === 'overtime')
      expect(overtimeAnomalies).toHaveLength(0)
    })

    it('does not flag anomaly when under max duration', () => {
      // Advance time to 20 minutes (under 30 min default)
      vi.advanceTimersByTime(20 * 60 * 1000)
      const anomalies = monitor.checkAgent('agent-1')
      const overtimeAnomalies = anomalies.filter(a => a.type === 'overtime')
      expect(overtimeAnomalies).toHaveLength(0)
    })

    it('flags yellow anomaly at 100% of max duration', () => {
      // Advance time to 30 minutes (100% of default 30 min)
      vi.advanceTimersByTime(30 * 60 * 1000)
      const anomalies = monitor.checkAgent('agent-1')
      const overtimeAnomalies = anomalies.filter(a => a.type === 'overtime')
      expect(overtimeAnomalies.some(a => a.tier === 'yellow')).toBe(true)
    })

    it('flags orange anomaly at 150% of max duration', () => {
      // Advance time to 45 minutes (150% of default 30 min)
      vi.advanceTimersByTime(45 * 60 * 1000)
      const anomalies = monitor.checkAgent('agent-1')
      const overtimeAnomalies = anomalies.filter(a => a.type === 'overtime')
      expect(overtimeAnomalies.some(a => a.tier === 'orange')).toBe(true)
    })

    it('flags red anomaly at 200% of max duration', () => {
      // Advance time to 60 minutes (200% of default 30 min)
      vi.advanceTimersByTime(60 * 60 * 1000)
      const anomalies = monitor.checkAgent('agent-1')
      const overtimeAnomalies = anomalies.filter(a => a.type === 'overtime')
      expect(overtimeAnomalies.some(a => a.tier === 'red')).toBe(true)
    })

    it('uses guardrails config for the specific agent', () => {
      const customGuardrails = createGuardrails({ maxDurationMinutes: 10 })
      ;(callbacks.getGuardrails as ReturnType<typeof vi.fn>).mockReturnValue(customGuardrails)

      // Advance 10 minutes (100% of custom 10 min limit)
      vi.advanceTimersByTime(10 * 60 * 1000)
      const anomalies = monitor.checkAgent('agent-1')
      const overtimeAnomalies = anomalies.filter(a => a.type === 'overtime')
      expect(overtimeAnomalies.some(a => a.tier === 'yellow')).toBe(true)
    })
  })

  // ─── error spiral detection ──────────────────────────────────────

  describe('error spiral detection', () => {
    beforeEach(() => {
      monitor.registerAgent('agent-1')
    })

    it('does not flag anomaly for isolated errors under limit', () => {
      // Default maxConsecutiveErrors = 5, record 4
      for (let i = 0; i < 4; i++) {
        monitor.recordError('agent-1', `Error ${i}`)
      }
      const anomalies = monitor.checkAgent('agent-1')
      const errorAnomalies = anomalies.filter(a => a.type === 'error_spiral')
      expect(errorAnomalies).toHaveLength(0)
    })

    it('flags yellow anomaly at maxConsecutiveErrors', () => {
      // Default maxConsecutiveErrors = 5
      for (let i = 0; i < 5; i++) {
        monitor.recordError('agent-1', `Error ${i}`)
      }
      const anomalies = monitor.checkAgent('agent-1')
      const errorAnomalies = anomalies.filter(a => a.type === 'error_spiral')
      expect(errorAnomalies.some(a => a.tier === 'yellow')).toBe(true)
    })

    it('flags orange anomaly at 2x maxConsecutiveErrors', () => {
      // 2x default = 10 errors
      for (let i = 0; i < 10; i++) {
        monitor.recordError('agent-1', `Error ${i}`)
      }
      const anomalies = monitor.checkAgent('agent-1')
      const errorAnomalies = anomalies.filter(a => a.type === 'error_spiral')
      expect(errorAnomalies.some(a => a.tier === 'orange')).toBe(true)
    })

    it('flags red anomaly at 3x maxConsecutiveErrors', () => {
      // 3x default = 15 errors
      for (let i = 0; i < 15; i++) {
        monitor.recordError('agent-1', `Error ${i}`)
      }
      const anomalies = monitor.checkAgent('agent-1')
      const errorAnomalies = anomalies.filter(a => a.type === 'error_spiral')
      expect(errorAnomalies.some(a => a.tier === 'red')).toBe(true)
    })

    it('clearError resets the consecutive error counter', () => {
      for (let i = 0; i < 5; i++) {
        monitor.recordError('agent-1', `Error ${i}`)
      }
      monitor.clearError('agent-1')
      const snapshot = monitor.getSnapshot('agent-1')
      expect(snapshot!.consecutiveErrors).toBe(0)
    })

    it('error after clearError starts a fresh count', () => {
      // Accumulate 5 errors (yellow threshold)
      for (let i = 0; i < 5; i++) {
        monitor.recordError('agent-1', `Error ${i}`)
      }
      // Reset
      monitor.clearError('agent-1')
      // Record 3 errors (under threshold)
      for (let i = 0; i < 3; i++) {
        monitor.recordError('agent-1', `Error ${i}`)
      }
      const anomalies = monitor.checkAgent('agent-1')
      const errorAnomalies = anomalies.filter(a => a.type === 'error_spiral')
      expect(errorAnomalies).toHaveLength(0)
    })
  })

  // ─── scope creep detection ───────────────────────────────────────

  describe('scope creep detection', () => {
    beforeEach(() => {
      monitor.registerAgent('agent-1')
    })

    it('does not flag anomaly when under file limit', () => {
      // Default maxFilesChanged = 20, modify 10 unique files
      for (let i = 0; i < 10; i++) {
        monitor.recordFileModification('agent-1', `/src/file-${i}.ts`)
      }
      const anomalies = monitor.checkAgent('agent-1')
      const scopeAnomalies = anomalies.filter(a => a.type === 'scope_creep')
      expect(scopeAnomalies).toHaveLength(0)
    })

    it('flags yellow anomaly at maxFilesChanged', () => {
      // Default maxFilesChanged = 20
      for (let i = 0; i < 20; i++) {
        monitor.recordFileModification('agent-1', `/src/file-${i}.ts`)
      }
      const anomalies = monitor.checkAgent('agent-1')
      const scopeAnomalies = anomalies.filter(a => a.type === 'scope_creep')
      expect(scopeAnomalies.some(a => a.tier === 'yellow')).toBe(true)
    })

    it('flags orange anomaly at 1.5x maxFilesChanged', () => {
      // 1.5x default = 30 files
      for (let i = 0; i < 30; i++) {
        monitor.recordFileModification('agent-1', `/src/file-${i}.ts`)
      }
      const anomalies = monitor.checkAgent('agent-1')
      const scopeAnomalies = anomalies.filter(a => a.type === 'scope_creep')
      expect(scopeAnomalies.some(a => a.tier === 'orange')).toBe(true)
    })

    it('flags red anomaly at 2x maxFilesChanged', () => {
      // 2x default = 40 files
      for (let i = 0; i < 40; i++) {
        monitor.recordFileModification('agent-1', `/src/file-${i}.ts`)
      }
      const anomalies = monitor.checkAgent('agent-1')
      const scopeAnomalies = anomalies.filter(a => a.type === 'scope_creep')
      expect(scopeAnomalies.some(a => a.tier === 'red')).toBe(true)
    })
  })

  // ─── escalation tier logic ───────────────────────────────────────

  describe('escalation tier logic', () => {
    beforeEach(() => {
      monitor.registerAgent('agent-1')
    })

    it('returns multiple anomalies simultaneously', () => {
      // Trigger loop anomaly (3 modifications to same file)
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }
      // Trigger error spiral (5 consecutive errors)
      for (let i = 0; i < 5; i++) {
        monitor.recordError('agent-1', `Error ${i}`)
      }

      const anomalies = monitor.checkAgent('agent-1')
      const types = anomalies.map(a => a.type)
      expect(types).toContain('loop')
      expect(types).toContain('error_spiral')
    })

    it('each check returns all current anomalies', () => {
      // Trigger overtime (advance to 30 min)
      vi.advanceTimersByTime(30 * 60 * 1000)
      // Trigger scope creep (20 unique files)
      for (let i = 0; i < 20; i++) {
        monitor.recordFileModification('agent-1', `/src/file-${i}.ts`)
      }

      const anomalies = monitor.checkAgent('agent-1')
      const types = anomalies.map(a => a.type)
      expect(types).toContain('overtime')
      expect(types).toContain('scope_creep')
      expect(anomalies.length).toBeGreaterThanOrEqual(2)
    })
  })

  // ─── callbacks ───────────────────────────────────────────────────

  describe('callbacks', () => {
    beforeEach(() => {
      monitor.registerAgent('agent-1')
    })

    it('calls onAnomaly for each new anomaly', () => {
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }
      monitor.checkAgent('agent-1')

      expect(callbacks.onAnomaly).toHaveBeenCalled()
      const calledWith = (callbacks.onAnomaly as ReturnType<typeof vi.fn>).mock.calls[0][0] as HealthAnomaly
      expect(calledWith.type).toBe('loop')
      expect(calledWith.agentId).toBe('agent-1')
    })

    it('does NOT call onAnomaly for already-reported anomalies of same type and tier', () => {
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }
      monitor.checkAgent('agent-1')
      const callCountAfterFirst = (callbacks.onAnomaly as ReturnType<typeof vi.fn>).mock.calls.length

      // Check again without any state change — should not re-report
      monitor.checkAgent('agent-1')
      const callCountAfterSecond = (callbacks.onAnomaly as ReturnType<typeof vi.fn>).mock.calls.length
      expect(callCountAfterSecond).toBe(callCountAfterFirst)
    })

    it('calls onAnomaly when tier escalates for the same anomaly type', () => {
      // Yellow: 3 modifications
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }
      monitor.checkAgent('agent-1')
      const callCountAfterYellow = (callbacks.onAnomaly as ReturnType<typeof vi.fn>).mock.calls.length

      // Escalate to orange: 5 modifications total
      for (let i = 0; i < 2; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }
      monitor.checkAgent('agent-1')
      const callCountAfterOrange = (callbacks.onAnomaly as ReturnType<typeof vi.fn>).mock.calls.length
      expect(callCountAfterOrange).toBeGreaterThan(callCountAfterYellow)
    })

    it('calls logWarning when anomalies are detected', () => {
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }
      monitor.checkAgent('agent-1')

      expect(callbacks.logWarning).toHaveBeenCalled()
    })
  })

  // ─── watchdog ────────────────────────────────────────────────────

  describe('watchdog', () => {
    it('calls checkAgent periodically when started', () => {
      monitor.registerAgent('agent-1')
      monitor.registerAgent('agent-2')

      // Trigger a detectable anomaly on agent-1 for verification
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }

      monitor.startWatchdog(1000) // 1 second interval

      // Advance by 1 tick
      vi.advanceTimersByTime(1000)
      expect(callbacks.onAnomaly).toHaveBeenCalled()
    })

    it('uses default 10s interval when no argument provided', () => {
      monitor.registerAgent('agent-1')
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }

      monitor.startWatchdog()

      // At 5s, should not have been called yet
      vi.advanceTimersByTime(5000)
      expect(callbacks.onAnomaly).not.toHaveBeenCalled()

      // At 10s, should have been called
      vi.advanceTimersByTime(5000)
      expect(callbacks.onAnomaly).toHaveBeenCalled()
    })

    it('stops checking when stopWatchdog is called', () => {
      monitor.registerAgent('agent-1')
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }

      monitor.startWatchdog(1000)
      vi.advanceTimersByTime(1000) // First tick
      const callsAfterFirstTick = (callbacks.onAnomaly as ReturnType<typeof vi.fn>).mock.calls.length

      monitor.stopWatchdog()

      // Advance another 5 seconds — no additional calls
      vi.advanceTimersByTime(5000)
      const callsAfterStop = (callbacks.onAnomaly as ReturnType<typeof vi.fn>).mock.calls.length
      expect(callsAfterStop).toBe(callsAfterFirstTick)
    })
  })

  // ─── anomaly structure ───────────────────────────────────────────

  describe('anomaly structure', () => {
    beforeEach(() => {
      monitor.registerAgent('agent-1')
    })

    it('anomaly has a unique id string', () => {
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }
      const anomalies = monitor.checkAgent('agent-1')
      expect(anomalies[0].id).toBeDefined()
      expect(typeof anomalies[0].id).toBe('string')
      expect(anomalies[0].id.length).toBeGreaterThan(0)
    })

    it('anomaly has the correct agentId', () => {
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }
      const anomalies = monitor.checkAgent('agent-1')
      expect(anomalies[0].agentId).toBe('agent-1')
    })

    it('anomaly has a detectedAt timestamp', () => {
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }
      const anomalies = monitor.checkAgent('agent-1')
      expect(typeof anomalies[0].detectedAt).toBe('number')
      expect(anomalies[0].detectedAt).toBeGreaterThan(0)
    })

    it('anomaly has a human-readable message', () => {
      for (let i = 0; i < 3; i++) {
        monitor.recordFileModification('agent-1', '/src/index.ts')
      }
      const anomalies = monitor.checkAgent('agent-1')
      expect(typeof anomalies[0].message).toBe('string')
      expect(anomalies[0].message.length).toBeGreaterThan(0)
    })
  })

  // ─── snapshot state tracking ─────────────────────────────────────

  describe('snapshot state tracking', () => {
    it('tracks filesModified counts in the snapshot', () => {
      monitor.registerAgent('agent-1')
      monitor.recordFileModification('agent-1', '/src/a.ts')
      monitor.recordFileModification('agent-1', '/src/a.ts')
      monitor.recordFileModification('agent-1', '/src/b.ts')

      const snapshot = monitor.getSnapshot('agent-1')
      expect(snapshot!.filesModified.get('/src/a.ts')).toBe(2)
      expect(snapshot!.filesModified.get('/src/b.ts')).toBe(1)
    })

    it('tracks totalFilesChanged as unique file count', () => {
      monitor.registerAgent('agent-1')
      monitor.recordFileModification('agent-1', '/src/a.ts')
      monitor.recordFileModification('agent-1', '/src/a.ts') // same file again
      monitor.recordFileModification('agent-1', '/src/b.ts')

      const snapshot = monitor.getSnapshot('agent-1')
      expect(snapshot!.totalFilesChanged).toBe(2) // 2 unique files
    })

    it('tracks consecutiveErrors count', () => {
      monitor.registerAgent('agent-1')
      monitor.recordError('agent-1', 'Error 1')
      monitor.recordError('agent-1', 'Error 2')

      const snapshot = monitor.getSnapshot('agent-1')
      expect(snapshot!.consecutiveErrors).toBe(2)
    })

    it('records startedAt and lastActivityAt', () => {
      const now = Date.now()
      monitor.registerAgent('agent-1')
      const snapshot = monitor.getSnapshot('agent-1')
      expect(snapshot!.startedAt).toBeGreaterThanOrEqual(now)
      expect(snapshot!.lastActivityAt).toBeGreaterThanOrEqual(now)
    })

    it('updates lastActivityAt on file modification', () => {
      monitor.registerAgent('agent-1')
      const snapshotBefore = monitor.getSnapshot('agent-1')
      const startTime = snapshotBefore!.lastActivityAt

      vi.advanceTimersByTime(5000)
      monitor.recordFileModification('agent-1', '/src/a.ts')

      const snapshotAfter = monitor.getSnapshot('agent-1')
      expect(snapshotAfter!.lastActivityAt).toBeGreaterThan(startTime)
    })

    it('updates lastActivityAt on error recording', () => {
      monitor.registerAgent('agent-1')
      const snapshotBefore = monitor.getSnapshot('agent-1')
      const startTime = snapshotBefore!.lastActivityAt

      vi.advanceTimersByTime(5000)
      monitor.recordError('agent-1', 'Some error')

      const snapshotAfter = monitor.getSnapshot('agent-1')
      expect(snapshotAfter!.lastActivityAt).toBeGreaterThan(startTime)
    })
  })
})
