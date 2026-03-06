import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QualityPipeline } from './quality-pipeline'
import type {
  QualityPipelineDeps,
  PipelineRun
} from '@shared/types/quality-pipeline.types'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

function createDeps(overrides: Partial<QualityPipelineDeps> = {}): QualityPipelineDeps {
  return {
    retryAgent: vi.fn().mockResolvedValue(false),
    spawnTesterAgent: vi.fn().mockResolvedValue({ isolated: false, diagnosis: '' }),
    spawnDebuggerAgent: vi.fn().mockResolvedValue({ fixed: false, summary: '' }),
    notifyUser: vi.fn(),
    logInfo: vi.fn(),
    ...overrides
  }
}

describe('QualityPipeline', () => {
  let deps: QualityPipelineDeps
  let pipeline: QualityPipeline

  beforeEach(() => {
    deps = createDeps()
    pipeline = new QualityPipeline(deps)
  })

  // ─── L1 - Retry ──────────────────────────────────────────────────

  describe('L1 - Retry', () => {
    it('resolves at L1 when first retry succeeds', async () => {
      ;(deps.retryAgent as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)

      const run = await pipeline.startPipeline('agent-1', 'TypeError: undefined')

      expect(run.status).toBe('resolved')
      expect(run.currentLevel).toBe('L1')
      expect(deps.retryAgent).toHaveBeenCalledTimes(1)
    })

    it('retries up to 3 times at L1', async () => {
      ;(deps.retryAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)

      await pipeline.startPipeline('agent-1', 'TypeError: undefined')

      expect(deps.retryAgent).toHaveBeenCalledTimes(3)
    })

    it('moves to L2 after 3 failed L1 retries', async () => {
      ;(deps.retryAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
      ;(deps.spawnTesterAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ isolated: true, diagnosis: 'found the bug' })

      const run = await pipeline.startPipeline('agent-1', 'TypeError: undefined')

      expect(deps.spawnTesterAgent).toHaveBeenCalled()
      expect(run.attempts.some(a => a.level === 'L2')).toBe(true)
    })

    it('records each L1 attempt in the pipeline run', async () => {
      ;(deps.retryAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)

      const run = await pipeline.startPipeline('agent-1', 'TypeError: undefined')

      const l1Attempts = run.attempts.filter(a => a.level === 'L1')
      expect(l1Attempts).toHaveLength(3)
      expect(l1Attempts[0].attemptNumber).toBe(1)
      expect(l1Attempts[1].attemptNumber).toBe(2)
      expect(l1Attempts[2].attemptNumber).toBe(3)
      expect(l1Attempts[2].resolvedIssue).toBe(true)
    })

    it('calls retryAgent with the agentId', async () => {
      ;(deps.retryAgent as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)

      await pipeline.startPipeline('agent-42', 'some error')

      expect(deps.retryAgent).toHaveBeenCalledWith(
        'agent-42',
        expect.any(String)
      )
    })
  })

  // ─── L2 - Tester Agent ───────────────────────────────────────────

  describe('L2 - Tester Agent', () => {
    beforeEach(() => {
      // Ensure L1 always fails so we reach L2
      ;(deps.retryAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValue(false)
    })

    it('resolves at L2 when tester isolates the issue', async () => {
      ;(deps.spawnTesterAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ isolated: true, diagnosis: 'null ref in parser' })

      const run = await pipeline.startPipeline('agent-1', 'NullPointerException')

      expect(run.status).toBe('resolved')
      expect(run.currentLevel).toBe('L2')
    })

    it('moves to L3 when tester cannot isolate', async () => {
      ;(deps.spawnTesterAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ isolated: false, diagnosis: 'could not reproduce' })
      ;(deps.spawnDebuggerAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ fixed: true, summary: 'fixed via patch' })

      const run = await pipeline.startPipeline('agent-1', 'NullPointerException')

      expect(deps.spawnDebuggerAgent).toHaveBeenCalled()
      expect(run.attempts.some(a => a.level === 'L3')).toBe(true)
    })

    it('calls spawnTesterAgent with agentId and errorMessage', async () => {
      ;(deps.spawnTesterAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ isolated: true, diagnosis: 'found it' })

      await pipeline.startPipeline('agent-7', 'SyntaxError: unexpected token')

      expect(deps.spawnTesterAgent).toHaveBeenCalledWith(
        'agent-7',
        'SyntaxError: unexpected token'
      )
    })

    it('records L2 attempt with diagnosis in result', async () => {
      ;(deps.spawnTesterAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ isolated: true, diagnosis: 'race condition in db layer' })

      const run = await pipeline.startPipeline('agent-1', 'deadlock detected')

      const l2Attempt = run.attempts.find(a => a.level === 'L2')
      expect(l2Attempt).toBeDefined()
      expect(l2Attempt!.result).toContain('race condition in db layer')
      expect(l2Attempt!.resolvedIssue).toBe(true)
    })
  })

  // ─── L3 - Debugger Agent ─────────────────────────────────────────

  describe('L3 - Debugger Agent', () => {
    beforeEach(() => {
      // L1 always fails
      ;(deps.retryAgent as ReturnType<typeof vi.fn>).mockResolvedValue(false)
      // L2 always fails to isolate
      ;(deps.spawnTesterAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ isolated: false, diagnosis: 'unable to reproduce' })
    })

    it('resolves at L3 when debugger fixes the issue', async () => {
      ;(deps.spawnDebuggerAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ fixed: true, summary: 'patched memory leak' })

      const run = await pipeline.startPipeline('agent-1', 'OutOfMemoryError')

      expect(run.status).toBe('resolved')
      expect(run.currentLevel).toBe('L3')
    })

    it('moves to L4 when debugger cannot fix', async () => {
      ;(deps.spawnDebuggerAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ fixed: false, summary: 'root cause unclear' })

      const run = await pipeline.startPipeline('agent-1', 'OutOfMemoryError')

      expect(run.currentLevel).toBe('L4')
      expect(run.status).toBe('escalated')
    })

    it('calls spawnDebuggerAgent with agentId, errorMessage, and context from L2', async () => {
      ;(deps.spawnTesterAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ isolated: false, diagnosis: 'flaky in CI only' })
      ;(deps.spawnDebuggerAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ fixed: true, summary: 'env var mismatch' })

      await pipeline.startPipeline('agent-5', 'AssertionError')

      expect(deps.spawnDebuggerAgent).toHaveBeenCalledWith(
        'agent-5',
        'AssertionError',
        expect.stringContaining('flaky in CI only')
      )
    })

    it('records L3 attempt with summary in result', async () => {
      ;(deps.spawnDebuggerAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ fixed: true, summary: 'fixed off-by-one in loop' })

      const run = await pipeline.startPipeline('agent-1', 'IndexOutOfBoundsException')

      const l3Attempt = run.attempts.find(a => a.level === 'L3')
      expect(l3Attempt).toBeDefined()
      expect(l3Attempt!.result).toContain('fixed off-by-one in loop')
      expect(l3Attempt!.resolvedIssue).toBe(true)
    })
  })

  // ─── L4 - User Escalation ────────────────────────────────────────

  describe('L4 - User Escalation', () => {
    beforeEach(() => {
      // All levels fail
      ;(deps.retryAgent as ReturnType<typeof vi.fn>).mockResolvedValue(false)
      ;(deps.spawnTesterAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ isolated: false, diagnosis: 'no repro' })
      ;(deps.spawnDebuggerAgent as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ fixed: false, summary: 'could not determine cause' })
    })

    it('calls notifyUser with the full pipeline run', async () => {
      const run = await pipeline.startPipeline('agent-1', 'CriticalFailure')

      expect(deps.notifyUser).toHaveBeenCalledTimes(1)
      const notifiedRun = (deps.notifyUser as ReturnType<typeof vi.fn>).mock.calls[0][0] as PipelineRun
      expect(notifiedRun.id).toBe(run.id)
      expect(notifiedRun.agentId).toBe('agent-1')
      expect(notifiedRun.errorMessage).toBe('CriticalFailure')
    })

    it('marks pipeline status as escalated', async () => {
      const run = await pipeline.startPipeline('agent-1', 'CriticalFailure')

      expect(run.status).toBe('escalated')
      expect(run.currentLevel).toBe('L4')
    })

    it('pipeline run contains all previous attempts from L1 through L4', async () => {
      const run = await pipeline.startPipeline('agent-1', 'CriticalFailure')

      const levels = run.attempts.map(a => a.level)
      expect(levels).toContain('L1')
      expect(levels).toContain('L2')
      expect(levels).toContain('L3')
      expect(levels).toContain('L4')
      // L1 has 3 attempts, L2 has 1, L3 has 1, L4 has 1 = minimum 6
      expect(run.attempts.length).toBeGreaterThanOrEqual(6)
    })
  })

  // ─── Pipeline management ─────────────────────────────────────────

  describe('Pipeline management', () => {
    it('startPipeline returns a PipelineRun with unique id', async () => {
      ;(deps.retryAgent as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      const run1 = await pipeline.startPipeline('agent-1', 'error-a')
      const run2 = await pipeline.startPipeline('agent-2', 'error-b')

      expect(run1.id).toBeDefined()
      expect(typeof run1.id).toBe('string')
      expect(run1.id.length).toBeGreaterThan(0)
      expect(run1.id).not.toBe(run2.id)
    })

    it('getPipelineRun returns the run by id', async () => {
      ;(deps.retryAgent as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)

      const run = await pipeline.startPipeline('agent-1', 'some error')
      const retrieved = pipeline.getPipelineRun(run.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved!.id).toBe(run.id)
      expect(retrieved!.agentId).toBe('agent-1')
      expect(retrieved!.errorMessage).toBe('some error')
    })

    it('getPipelineRun returns null for unknown id', () => {
      const result = pipeline.getPipelineRun('non-existent-id')
      expect(result).toBeNull()
    })

    it('getActivePipelines returns running pipelines', async () => {
      // We need a pipeline that stays in running state.
      // Use a never-resolving promise for retryAgent to keep it running.
      let resolveRetry!: (value: boolean) => void
      ;(deps.retryAgent as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () => new Promise<boolean>(resolve => { resolveRetry = resolve })
      )

      const pipelinePromise = pipeline.startPipeline('agent-1', 'stuck error')

      // While it's running, getActivePipelines should include it
      const active = pipeline.getActivePipelines()
      expect(active.length).toBe(1)
      expect(active[0].agentId).toBe('agent-1')
      expect(active[0].status).toBe('running')

      // Resolve to clean up
      resolveRetry(true)
      await pipelinePromise
    })

    it('pipeline status is resolved when issue is fixed at any level', async () => {
      // Fix at L1
      ;(deps.retryAgent as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
      const runL1 = await pipeline.startPipeline('agent-1', 'err')
      expect(runL1.status).toBe('resolved')
      expect(runL1.resolvedAt).not.toBeNull()
      expect(runL1.resolvedAt).toBeGreaterThan(0)
    })
  })

  // ─── Guard rails ─────────────────────────────────────────────────

  describe('Guard rails', () => {
    it('does not start a new pipeline for an agent that already has one running', async () => {
      let resolveRetry!: (value: boolean) => void
      ;(deps.retryAgent as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () => new Promise<boolean>(resolve => { resolveRetry = resolve })
      )

      const firstPipeline = pipeline.startPipeline('agent-1', 'first error')

      // Try to start a second pipeline for the same agent while first is running
      const secondPipeline = pipeline.startPipeline('agent-1', 'second error')
      const secondRun = await secondPipeline

      // Second pipeline should be rejected / not start
      // The first pipeline should be the only active one
      const active = pipeline.getActivePipelines()
      expect(active.length).toBe(1)
      expect(secondRun.status).toBe('failed')

      // Clean up
      resolveRetry(true)
      await firstPipeline
    })
  })
})
