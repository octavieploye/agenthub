import type {
  QualityPipelineDeps,
  PipelineRun,
  PipelineAttempt,
  PipelineStatus
} from '@shared/types/quality-pipeline.types'

let idCounter = 0
function generateId(): string {
  idCounter += 1
  return `pipeline-${Date.now()}-${idCounter}`
}

const L1_MAX_RETRIES = 3

export class QualityPipeline {
  private runs = new Map<string, PipelineRun>()
  private activeByAgent = new Map<string, string>() // agentId -> runId
  private deps: QualityPipelineDeps

  constructor(deps: QualityPipelineDeps) {
    this.deps = deps
  }

  async startPipeline(agentId: string, errorMessage: string): Promise<PipelineRun> {
    if (this.activeByAgent.has(agentId)) {
      const failedRun: PipelineRun = {
        id: generateId(),
        agentId,
        errorMessage,
        currentLevel: 'L1',
        status: 'failed',
        attempts: [],
        createdAt: Date.now(),
        resolvedAt: null
      }
      this.runs.set(failedRun.id, failedRun)
      return failedRun
    }

    const run: PipelineRun = {
      id: generateId(),
      agentId,
      errorMessage,
      currentLevel: 'L1',
      status: 'running',
      attempts: [],
      createdAt: Date.now(),
      resolvedAt: null
    }

    this.runs.set(run.id, run)
    this.activeByAgent.set(agentId, run.id)

    try {
      await this.executeL1(run)
      if ((run.status as PipelineStatus) === 'resolved') return run

      await this.executeL2(run)
      if ((run.status as PipelineStatus) === 'resolved') return run

      await this.executeL3(run)
      if ((run.status as PipelineStatus) === 'resolved') return run

      this.executeL4(run)
    } finally {
      this.activeByAgent.delete(agentId)
    }

    return run
  }

  getPipelineRun(id: string): PipelineRun | null {
    return this.runs.get(id) ?? null
  }

  getActivePipelines(): PipelineRun[] {
    return [...this.runs.values()].filter((r) => r.status === 'running')
  }

  private async executeL1(run: PipelineRun): Promise<void> {
    run.currentLevel = 'L1'

    for (let i = 1; i <= L1_MAX_RETRIES; i++) {
      const prompt = `Retry attempt ${i}: Fix error "${run.errorMessage}"`
      const success = await this.deps.retryAgent(run.agentId, prompt)

      const attempt: PipelineAttempt = {
        level: 'L1',
        attemptNumber: i,
        action: `Retry with adjusted approach (attempt ${i})`,
        result: success ? 'Retry succeeded' : 'Retry failed',
        resolvedIssue: success,
        timestamp: Date.now()
      }
      run.attempts.push(attempt)

      this.deps.logInfo(`L1 attempt ${i}`, { agentId: run.agentId, success })

      if (success) {
        this.resolve(run)
        return
      }
    }
  }

  private async executeL2(run: PipelineRun): Promise<void> {
    run.currentLevel = 'L2'

    const result = await this.deps.spawnTesterAgent(run.agentId, run.errorMessage)

    const attempt: PipelineAttempt = {
      level: 'L2',
      attemptNumber: 1,
      action: 'Spawn tester agent to reproduce and isolate',
      result: result.isolated
        ? `Isolated: ${result.diagnosis}`
        : `Could not isolate: ${result.diagnosis}`,
      resolvedIssue: result.isolated,
      timestamp: Date.now()
    }
    run.attempts.push(attempt)

    this.deps.logInfo('L2 tester agent', { agentId: run.agentId, isolated: result.isolated })

    if (result.isolated) {
      this.resolve(run)
    }
  }

  private async executeL3(run: PipelineRun): Promise<void> {
    run.currentLevel = 'L3'

    const l2Attempt = run.attempts.find((a) => a.level === 'L2')
    const context = l2Attempt?.result ?? 'No L2 context available'

    const result = await this.deps.spawnDebuggerAgent(run.agentId, run.errorMessage, context)

    const attempt: PipelineAttempt = {
      level: 'L3',
      attemptNumber: 1,
      action: 'Spawn debugger agent with broader codebase context',
      result: result.fixed
        ? `Fixed: ${result.summary}`
        : `Could not fix: ${result.summary}`,
      resolvedIssue: result.fixed,
      timestamp: Date.now()
    }
    run.attempts.push(attempt)

    this.deps.logInfo('L3 debugger agent', { agentId: run.agentId, fixed: result.fixed })

    if (result.fixed) {
      this.resolve(run)
    }
  }

  private executeL4(run: PipelineRun): void {
    run.currentLevel = 'L4'
    run.status = 'escalated'

    const attempt: PipelineAttempt = {
      level: 'L4',
      attemptNumber: 1,
      action: 'Escalate to user with structured summary',
      result: `All automated levels exhausted. ${run.attempts.length} attempts across L1-L3.`,
      resolvedIssue: false,
      timestamp: Date.now()
    }
    run.attempts.push(attempt)

    this.deps.notifyUser(run)
    this.deps.logInfo('L4 escalated to user', { agentId: run.agentId, runId: run.id })
  }

  private resolve(run: PipelineRun): void {
    run.status = 'resolved'
    run.resolvedAt = Date.now()
  }
}
