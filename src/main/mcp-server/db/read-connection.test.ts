import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  getActiveOrchestratorRunReadOnly,
  getOrchestratorRunReadOnly,
  getQuotaReadOnly,
  getTaskByIdReadOnly,
  listTasksReadOnly,
  openReadOnly,
} from './read-connection'

describe('read-only MCP database connection', () => {
  let directory: string
  let dbPath: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'agenthub-mcp-db-'))
    dbPath = join(directory, 'agenthub.db')
    const db = new Database(dbPath)

    db.exec(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY, repo_id TEXT, title TEXT, description TEXT, priority INTEGER,
        status TEXT, category TEXT, agent_id TEXT, position INTEGER, sbar_id TEXT,
        sprint_name TEXT, epic_name TEXT, project_id TEXT, section_target_date TEXT,
        note TEXT, requires_approval INTEGER, model_override TEXT, provider_override TEXT,
        date_trigger_fired_at TEXT, target_files_json TEXT, skills_json TEXT,
        guardrail_json TEXT, estimated_tokens INTEGER, recommended_model TEXT,
        risk_score REAL, risk_factors_json TEXT, created_by TEXT, created_at TEXT, updated_at TEXT
      );
      CREATE TABLE task_dependencies (task_id TEXT, depends_on_id TEXT);
      CREATE TABLE orchestrator_runs (
        id TEXT PRIMARY KEY, sprint_name TEXT, project_id TEXT, repo_id TEXT, status TEXT,
        concurrency_cap INTEGER, telegram_notify INTEGER, created_at TEXT, updated_at TEXT,
        started_at TEXT, completed_at TEXT, single_task_id TEXT, started_by TEXT,
        trigger_source TEXT, task_ids_json TEXT
      );
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `)
    db.prepare(
      `INSERT INTO tasks (id, repo_id, title, priority, status, target_files_json, guardrail_json, created_at, updated_at)
       VALUES ('task-1', 'repo-1', 'Test task', 1, 'backlog', '["src/a.ts"]', '{"maxFilesChanged": 2}', '2026-01-01', '2026-01-01')`
    ).run()
    db.prepare("INSERT INTO task_dependencies VALUES ('task-1', 'task-0')").run()
    db.prepare(
      `INSERT INTO orchestrator_runs VALUES
       ('run-1', 'Sprint 1', NULL, 'repo-1', 'running', 3, 1, '2026-01-01', '2026-01-02', NULL, NULL, NULL, 'user', 'manual', '["task-1"]')`
    ).run()
    db.prepare("INSERT INTO settings VALUES ('quota.sessionCap', 'invalid')").run()
    db.close()
  })

  afterEach(() => rmSync(directory, { recursive: true, force: true }))

  it('opens only an existing database and rejects writes', () => {
    const db = openReadOnly(dbPath)
    expect(() => db.prepare("INSERT INTO settings VALUES ('new', 'value')").run()).toThrow()
    db.close()
    expect(() => openReadOnly(join(directory, 'missing.db'))).toThrow()
  })

  it('returns typed tasks with persisted dependencies and validated JSON', () => {
    const db = openReadOnly(dbPath)
    expect(listTasksReadOnly(db, { limit: Number.NaN })).toHaveLength(1)
    expect(getTaskByIdReadOnly(db, 'task-1')).toMatchObject({
      id: 'task-1',
      blockedBy: ['task-0'],
      targetFiles: ['src/a.ts'],
      guardrailOverrides: { maxFilesChanged: 2 },
    })
    db.close()
  })

  it('returns typed orchestrator-run rows and a finite quota fallback', () => {
    const db = openReadOnly(dbPath)
    expect(getOrchestratorRunReadOnly(db, 'run-1')).toMatchObject({
      id: 'run-1',
      status: 'running',
      telegramNotify: true,
      taskIds: ['task-1'],
    })
    expect(getActiveOrchestratorRunReadOnly(db)?.id).toBe('run-1')
    expect(getQuotaReadOnly(db).sessionCap).toBe(100_000)
    db.close()
  })
})
