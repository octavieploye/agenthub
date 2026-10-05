// @vitest-environment node
//
// Tests for handleTelegramCommand (extend case) in service-orchestrator.ts.
//
// service-orchestrator imports electron, @electron-toolkit/utils, and other
// Electron-only modules. These are boundary mocks — the Electron runtime
// cannot run in Node.js tests (same pattern as container-manager.test.ts).
// The actual extend-case logic (UUID validation → extendRunWallClock call) runs
// for real; only the Electron shell and unrelated service deps are stubbed.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// ── Boundary mocks (must appear before any import from the module) ────────────

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: vi.fn(() => '0.0.0'),
    getPath: vi.fn(() => '/tmp/agenthub-test'),
    getAppPath: vi.fn(() => '/tmp/agenthub-test'),
    quit: vi.fn(),
  },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
  Notification: { isSupported: vi.fn(() => false) },
  Tray: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    destroy: vi.fn(),
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    setImage: vi.fn(),
  })),
  Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString()),
  },
  ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() },
  webContents: { getAllWebContents: vi.fn(() => []) },
  nativeImage: { createFromPath: vi.fn(() => ({})), createEmpty: vi.fn(() => ({})) },
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true, test: true },
  electronApp: { setAppUserModelId: vi.fn() },
}))

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('child_process', () => ({
  default: { spawn: vi.fn(), exec: vi.fn(), execFile: vi.fn() },
  spawn: vi.fn(),
  exec: vi.fn(),
  execFile: vi.fn(),
}))

// ── Module under test ─────────────────────────────────────────────────────────

import {
  handleTelegramCommand,
  computeRunTokenUsage,
  _setOrchestratorSchedulerForTest
} from './service-orchestrator'
import type { OrchestratorScheduler } from './orchestrator-scheduler'

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_UUID = '12345678-1234-1234-1234-123456789abc'

/** Minimal mock DB — the extend case does not query the DB at all. */
const mockDb = {} as Parameters<typeof handleTelegramCommand>[0]

afterEach(() => {
  _setOrchestratorSchedulerForTest(null)
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('handleTelegramCommand — extend', () => {
  it('calls extendRunWallClock once with the runId for a valid UUID', () => {
    const extendRunWallClock = vi.fn(() => true)
    _setOrchestratorSchedulerForTest({ extendRunWallClock } as unknown as OrchestratorScheduler)

    handleTelegramCommand(mockDb, { type: 'command', command: 'extend', runId: VALID_UUID })

    expect(extendRunWallClock).toHaveBeenCalledOnce()
    expect(extendRunWallClock).toHaveBeenCalledWith(VALID_UUID)
  })

  it('does NOT call extendRunWallClock for an invalid runId', () => {
    const extendRunWallClock = vi.fn(() => false)
    _setOrchestratorSchedulerForTest({ extendRunWallClock } as unknown as OrchestratorScheduler)

    handleTelegramCommand(mockDb, { type: 'command', command: 'extend', runId: 'not-a-uuid' })

    expect(extendRunWallClock).not.toHaveBeenCalled()
  })
})

describe('computeRunTokenUsage', () => {
  const realHome = process.env.HOME

  afterEach(() => {
    process.env.HOME = realHome
  })

  it('skips transcript files last modified before the run started', () => {
    const home = mkdtempSync(join(tmpdir(), 'agenthub-run-tokens-'))
    process.env.HOME = home
    const repoPath = '/work/some-repo'
    const projectDir = join(home, '.claude', 'projects', repoPath.replace(/\//g, '-'))
    mkdirSync(projectDir, { recursive: true })

    const now = Date.now()
    const startedAt = new Date(now - 60 * 60_000).toISOString()
    const usageLine = (minutesAgo: number, outputTokens: number): string =>
      JSON.stringify({
        type: 'assistant',
        timestamp: new Date(now - minutesAgo * 60_000).toISOString(),
        sessionId: 's',
        message: { role: 'assistant', usage: { input_tokens: 1, output_tokens: outputTokens } }
      }) + '\n'

    // A file untouched since before the run cannot hold entries from the run.
    // The in-window entry here only exists to prove the file is never read.
    const stale = join(projectDir, 'stale.jsonl')
    writeFileSync(stale, usageLine(30, 500))
    const twoHoursAgo = new Date(now - 120 * 60_000)
    utimesSync(stale, twoHoursAgo, twoHoursAgo)
    writeFileSync(join(projectDir, 'live.jsonl'), usageLine(10, 70))

    const rows: Record<string, Record<string, unknown>> = {
      orchestrator_runs: { id: 'run-1', repo_id: 'repo-1', status: 'running', started_at: startedAt },
      repos: { id: 'repo-1', name: 'some-repo', path: repoPath, hidden: 0 }
    }
    const db = {
      prepare: (sql: string) => ({
        get: () => rows[sql.includes('orchestrator_runs') ? 'orchestrator_runs' : 'repos']
      })
    } as unknown as Parameters<typeof computeRunTokenUsage>[0]

    expect(computeRunTokenUsage(db, 'run-1')).toBe(70)
  })
})
