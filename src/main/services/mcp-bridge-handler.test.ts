// @vitest-environment node
import net from 'net'
import { tmpdir } from 'os'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { McpBridgeHandler } from './mcp-bridge-handler'
import type { BridgeDeps } from './mcp-bridge-handler'

// ─── Mock electron-log (no Electron in test env) ─────────────────────────────

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

// ─── Minimal in-memory DB ─────────────────────────────────────────────────────

function buildDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS repos (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      path         TEXT NOT NULL,
      glow_color   TEXT,
      hidden       INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      created_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      path        TEXT,
      context_doc TEXT,
      context_doc_updated_at TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id                  TEXT PRIMARY KEY,
      repo_id             TEXT,
      title               TEXT NOT NULL,
      description         TEXT,
      priority            INTEGER NOT NULL DEFAULT 3,
      status              TEXT NOT NULL DEFAULT 'backlog',
      category            TEXT,
      agent_id            TEXT,
      position            INTEGER NOT NULL DEFAULT 0,
      sbar_id             TEXT,
      sprint_name         TEXT,
      epic_name           TEXT,
      project_id          TEXT,
      section_target_date TEXT,
      note                TEXT,
      requires_approval   INTEGER NOT NULL DEFAULT 0,
      model_override      TEXT,
      provider_override   TEXT,
      date_trigger_fired_at TEXT,
      target_files_json   TEXT,
      skills_json         TEXT,
      guardrail_json      TEXT,
      estimated_tokens    INTEGER,
      recommended_model   TEXT,
      risk_score          REAL,
      risk_factors_json   TEXT,
      created_by          TEXT,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_dependencies (
      task_id       TEXT NOT NULL,
      depends_on_id TEXT NOT NULL,
      PRIMARY KEY (task_id, depends_on_id)
    );

    CREATE TABLE IF NOT EXISTS activity_events (
      id          TEXT PRIMARY KEY,
      event_type  TEXT NOT NULL,
      entity_type TEXT,
      entity_id   TEXT,
      repo_id     TEXT,
      details     TEXT,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orchestrator_runs (
      id               TEXT PRIMARY KEY,
      sprint_name      TEXT NOT NULL,
      project_id       TEXT,
      repo_id          TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'idle',
      concurrency_cap  INTEGER NOT NULL DEFAULT 3,
      telegram_notify  INTEGER NOT NULL DEFAULT 0,
      agents_spawned   INTEGER NOT NULL DEFAULT 0,
      single_task_id   TEXT,
      started_by       TEXT,
      trigger_source   TEXT,
      task_ids_json    TEXT,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      started_at       TEXT,
      completed_at     TEXT
    );

    CREATE TABLE IF NOT EXISTS orchestrator_task_log (
      id                 TEXT PRIMARY KEY,
      run_id             TEXT NOT NULL,
      task_id            TEXT NOT NULL,
      phase              TEXT NOT NULL,
      status             TEXT NOT NULL DEFAULT 'pending',
      agent_id           TEXT,
      model_used         TEXT,
      provider_used      TEXT,
      summary_json       TEXT,
      issues_json        TEXT,
      files_changed_json TEXT,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL,
      started_at         TEXT,
      completed_at       TEXT
    );
  `)

  // Seed: one setting
  db.prepare("INSERT INTO settings (key, value) VALUES ('orchestrator.enabled', 'true')").run()

  return db
}

// ─── Minimal scheduler stub ────────────────────────────────────────────────────

function makeScheduler() {
  return {
    start: vi.fn((input: unknown) => ({ started: true, input })),
    startSingleTask: vi.fn((input: unknown) => ({ started: true, input })),
    approveTaskDispatch: vi.fn((_runId: string, _taskId: string, _approved: boolean) => {}),
  }
}

// ─── Helper: connect and send one JSON-line request, read one JSON-line response

function sendRequest(
  socketPath: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath, () => {
      client.write(JSON.stringify(payload) + '\n')
    })

    let buf = ''
    client.on('data', (chunk: Buffer) => {
      buf += chunk.toString()
      const nl = buf.indexOf('\n')
      if (nl !== -1) {
        const line = buf.slice(0, nl)
        client.end()
        try {
          resolve(JSON.parse(line) as Record<string, unknown>)
        } catch (e) {
          reject(e)
        }
      }
    })

    client.on('error', reject)
    client.setTimeout(2000, () => {
      client.destroy()
      reject(new Error('test timeout waiting for response'))
    })
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('McpBridgeHandler', () => {
  let handler: McpBridgeHandler
  let deps: BridgeDeps

  beforeEach(async () => {
    deps = {
      db: buildDb(),
      scheduler: makeScheduler(),
    }
    handler = new McpBridgeHandler(deps)

    // start() cleans old socket then calls listen — wait for it to be ready
    await new Promise<void>((resolve) => {
      handler.start()
      // Poll for socket file existence (listen fires asynchronously after file deletion)
      const interval = setInterval(() => {
        if (existsSync(handler.socketPath)) {
          clearInterval(interval)
          resolve()
        }
      }, 10)
    })
  })

  afterEach(async () => {
    handler.stop()
    await new Promise((r) => setTimeout(r, 30))
    if (existsSync(handler.socketPath)) {
      await unlink(handler.socketPath).catch(() => {})
    }
  })

  it('starts a socket server in tmpdir', () => {
    expect(handler.socketPath).toContain(tmpdir())
    expect(existsSync(handler.socketPath)).toBe(true)
  })

  it('token is a non-empty string', () => {
    expect(typeof handler.token).toBe('string')
    expect(handler.token.length).toBeGreaterThan(0)
  })

  it('rejects requests with wrong auth token', async () => {
    const resp = await sendRequest(handler.socketPath, {
      id: 'r1',
      token: 'wrong-token',
      method: 'listTasks',
      params: {},
    })
    expect(resp).toMatchObject({ id: 'r1', error: 'unauthorized' })
    expect(resp['result']).toBeUndefined()
  })

  it('responds to listTasks method with an array', async () => {
    const resp = await sendRequest(handler.socketPath, {
      id: 'r2',
      token: handler.token,
      method: 'listTasks',
      params: {},
    })
    expect(resp['id']).toBe('r2')
    expect(resp['error']).toBeUndefined()
    expect(Array.isArray(resp['result'])).toBe(true)
  })

  it('responds to getActiveRun method (returns null when no run)', async () => {
    const resp = await sendRequest(handler.socketPath, {
      id: 'r3',
      token: handler.token,
      method: 'getActiveRun',
      params: {},
    })
    expect(resp['id']).toBe('r3')
    expect(resp['error']).toBeUndefined()
    // No seeded run → null
    expect(resp['result']).toBeNull()
  })

  it('returns explicit error for unknown method', async () => {
    const resp = await sendRequest(handler.socketPath, {
      id: 'r4',
      token: handler.token,
      method: 'doesNotExist',
      params: {},
    })
    expect(resp).toMatchObject({ id: 'r4' })
    expect(typeof resp['error']).toBe('string')
    expect(resp['error']).toMatch(/unknown method/)
  })

  it('stop() closes the server — subsequent connections are rejected', async () => {
    handler.stop()
    await new Promise((r) => setTimeout(r, 50))

    await expect(
      sendRequest(handler.socketPath, {
        id: 'r5',
        token: handler.token,
        method: 'listTasks',
        params: {},
      })
    ).rejects.toThrow()
  })
})
