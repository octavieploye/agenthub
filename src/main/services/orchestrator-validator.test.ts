// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { OrchestratorValidator, type BrainDecision, type ValidatorContext } from './orchestrator-validator'
import { SlidingWindowLimiter } from './helpers/rate-limiter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDecision(overrides: Partial<BrainDecision> = {}): BrainDecision {
  return {
    taskId: 'task-1',
    skill: 'team-dev-loop',
    model: 'qwen3:8b',
    reason: 'Highest priority',
    ...overrides
  }
}

function makeContext(overrides: Partial<ValidatorContext> = {}): ValidatorContext {
  return {
    db: {} as Database.Database,
    rateLimiter: new SlidingWindowLimiter(10, 60000),
    maxAgents: 3,
    currentAgentCount: 1,
    runId: 'run-1',
    agenthubPath: process.cwd(),
    provider: null,
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrchestratorValidator', () => {
  let validator: OrchestratorValidator
  let db: Database.Database

  beforeEach(() => {
    validator = new OrchestratorValidator()

    // Create an in-memory DB with minimal schema
    db = new Database(':memory:')
    db.exec(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        repo_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority INTEGER DEFAULT 3,
        status TEXT DEFAULT 'backlog',
        category TEXT,
        agent_id TEXT,
        position INTEGER DEFAULT 0,
        sbar_id TEXT,
        sprint_name TEXT,
        epic_name TEXT,
        project_id TEXT,
        section_target_date TEXT,
        note TEXT,
        requires_approval INTEGER DEFAULT 0,
        model_override TEXT,
        provider_override TEXT,
        date_trigger_fired_at TEXT,
        target_files_json TEXT,
        skills_json TEXT,
        guardrail_json TEXT,
        estimated_tokens INTEGER,
        recommended_model TEXT,
        risk_score REAL,
        risk_factors_json TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    db.exec(`
      CREATE TABLE repos (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        glow_color TEXT,
        hidden INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        last_used_at TEXT
      )
    `)

    db.exec(`
      CREATE TABLE task_dependencies (
        task_id TEXT NOT NULL,
        depends_on_id TEXT NOT NULL,
        PRIMARY KEY (task_id, depends_on_id)
      )
    `)
  })

  afterEach(() => {
    db.close()
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // task-exists check
  // -------------------------------------------------------------------------

  it('task-exists fails when task not in DB', () => {
    const context = makeContext({ db })
    const decision = makeDecision()

    const result = validator.validate(decision, context)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.failures[0]).toContain('task not found')
    }
  })

  it('task-exists fails when task not in dispatchable status', () => {
    db.prepare('INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)')
      .run('repo-1', 'agenthub', process.cwd(), '2026-09-09T00:00:00Z')

    db.prepare(`
      INSERT INTO tasks (
        id, repo_id, title, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run('task-1', 'repo-1', 'Fix bug', 'in_progress', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z')

    const context = makeContext({ db })
    const decision = makeDecision()

    const result = validator.validate(decision, context)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.failures[0]).toContain('not in dispatchable status')
    }
  })

  // -------------------------------------------------------------------------
  // model-allowed check
  // -------------------------------------------------------------------------

  it('model-allowed rejects unknown models when provider is set', () => {
    db.prepare('INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)')
      .run('repo-1', 'agenthub', process.cwd(), '2026-09-09T00:00:00Z')

    db.prepare(`
      INSERT INTO tasks (
        id, repo_id, title, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run('task-1', 'repo-1', 'Fix bug', 'ready', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z')

    const context = makeContext({ db, provider: 'ollama-cloud' })
    const decision = makeDecision({ model: 'gpt-4o' })

    const result = validator.validate(decision, context)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.failures.some(f => f.includes('model not allowed'))).toBe(true)
    }
  })

  it('model-allowed passes when provider is null (ollama-local — runtime validation)', () => {
    db.prepare('INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)')
      .run('repo-1', 'agenthub', process.cwd(), '2026-09-09T00:00:00Z')

    db.prepare(`
      INSERT INTO tasks (
        id, repo_id, title, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run('task-1', 'repo-1', 'Fix bug', 'ready', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z')

    const context = makeContext({ db, provider: null })
    const decision = makeDecision({ model: 'qwen3:8b' })

    const result = validator.validate(decision, context)

    // model-allowed should not fail when provider is null (local models validated at runtime)
    if (!result.valid) {
      expect(result.failures.some(f => f.includes('model not allowed'))).toBe(false)
    }
  })

  // -------------------------------------------------------------------------
  // budget-ok check
  // -------------------------------------------------------------------------

  it('budget-ok rejects when at max agents', () => {
    db.prepare('INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)')
      .run('repo-1', 'agenthub', process.cwd(), '2026-09-09T00:00:00Z')

    db.prepare(`
      INSERT INTO tasks (
        id, repo_id, title, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run('task-1', 'repo-1', 'Fix bug', 'ready', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z')

    const context = makeContext({
      db,
      maxAgents: 3,
      currentAgentCount: 3
    })
    const decision = makeDecision()

    const result = validator.validate(decision, context)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.failures.some(f => f.includes('agent budget exhausted'))).toBe(true)
    }
  })

  // -------------------------------------------------------------------------
  // rate-limit-ok check
  // -------------------------------------------------------------------------

  it('rate-limit-ok rejects when limiter is exhausted', () => {
    db.prepare('INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)')
      .run('repo-1', 'agenthub', process.cwd(), '2026-09-09T00:00:00Z')

    db.prepare(`
      INSERT INTO tasks (
        id, repo_id, title, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run('task-1', 'repo-1', 'Fix bug', 'ready', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z')

    // Create a limiter with 0 capacity
    const limiter = new SlidingWindowLimiter(0, 60000)

    const context = makeContext({
      db,
      rateLimiter: limiter
    })
    const decision = makeDecision()

    const result = validator.validate(decision, context)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.failures.some(f => f.includes('rate limit'))).toBe(true)
    }
  })

  // -------------------------------------------------------------------------
  // repo-exists check
  // -------------------------------------------------------------------------

  it('repo-exists fails when repo not in DB', () => {
    db.prepare(`
      INSERT INTO tasks (
        id, repo_id, title, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run('task-1', 'nonexistent-repo', 'Fix bug', 'ready', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z')

    const context = makeContext({ db })
    const decision = makeDecision()

    const result = validator.validate(decision, context)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.failures.some(f => f.includes('repo not found'))).toBe(true)
    }
  })

  // -------------------------------------------------------------------------
  // skill-exists check
  // -------------------------------------------------------------------------

  it('skill-exists passes when skill is null', () => {
    db.prepare('INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)')
      .run('repo-1', 'agenthub', process.cwd(), '2026-09-09T00:00:00Z')

    db.prepare(`
      INSERT INTO tasks (
        id, repo_id, title, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run('task-1', 'repo-1', 'Fix bug', 'ready', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z')

    const context = makeContext({ db })
    const decision = makeDecision({ skill: null as any })

    const result = validator.validate(decision, context)

    // Should not fail on skill check when skill is null
    if (!result.valid) {
      const hasSkillFailure = result.failures.some(f => f.includes('skill not found'))
      expect(hasSkillFailure).toBe(false)
    }
  })

  // -------------------------------------------------------------------------
  // all-pass
  // -------------------------------------------------------------------------

  it('all-pass returns valid:true when all checks pass', () => {
    db.prepare('INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)')
      .run('repo-1', 'agenthub', process.cwd(), '2026-09-09T00:00:00Z')

    db.prepare(`
      INSERT INTO tasks (
        id, repo_id, title, description, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('task-1', 'repo-1', 'Fix bug', 'Fix the login form', 'ready', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z')

    const context = makeContext({ db })
    const decision = makeDecision({ skill: null as any })

    const result = validator.validate(decision, context)

    expect(result.valid).toBe(true)
    expect(result.failures).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // multiple failures
  // -------------------------------------------------------------------------

  it('multiple failures all reported', () => {
    // Repo exists but task is in wrong status, model is invalid for provider, and budget exhausted
    db.prepare('INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)')
      .run('repo-1', 'agenthub', process.cwd(), '2026-09-09T00:00:00Z')

    db.prepare(`
      INSERT INTO tasks (
        id, repo_id, title, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run('task-1', 'repo-1', 'Fix bug', 'in_progress', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z')

    const context = makeContext({ db, maxAgents: 3, currentAgentCount: 3, provider: 'ollama-cloud' })
    const decision = makeDecision({ model: 'gpt-4o' })

    const result = validator.validate(decision, context)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      // Should have multiple failures: model-allowed, budget-ok, task-exists (dispatchable status)
      expect(result.failures.length).toBeGreaterThanOrEqual(2)
      expect(result.failures.some(f => f.includes('model not allowed'))).toBe(true)
      expect(result.failures.some(f => f.includes('agent budget exhausted'))).toBe(true)
    }
  })

  // -------------------------------------------------------------------------
  // Description fallback to title
  // -------------------------------------------------------------------------

  it('uses title as taskDescription when description is empty', () => {
    db.prepare('INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)')
      .run('repo-1', 'agenthub', process.cwd(), '2026-09-09T00:00:00Z')

    db.prepare(`
      INSERT INTO tasks (
        id, repo_id, title, description, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('task-1', 'repo-1', 'Task Title', '', 'ready', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z')

    const context = makeContext({ db })
    const decision = makeDecision({ skill: null as any })

    const result = validator.validate(decision, context)

    expect(result.valid).toBe(true)
    expect(result.failures).toHaveLength(0)
  })
})
