// System-boundary mocks — must precede the agent-manager import.
// node-pty, electron, electron-log, and better-sqlite3 are external binaries
// that cannot run inside the vitest/jsdom process.
import { vi } from 'vitest'

vi.mock('node-pty', () => ({
  spawn: vi.fn()
}))

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  app: { getPath: vi.fn(() => '/tmp') }
}))

vi.mock('electron-log/main', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('better-sqlite3', () => ({
  default: vi.fn()
}))

// Internal services that reach into electron or the DB at module-load time
vi.mock('../db/connection', () => ({
  getDb: vi.fn(),
  isDbShuttingDown: vi.fn(() => false)
}))

vi.mock('../utils/emit-to-all-renderers', () => ({
  emitToAllRenderers: vi.fn()
}))

vi.mock('./service-orchestrator', () => ({
  getWindowManager: vi.fn(() => null),
  getAnamnesisWriter: vi.fn(() => null)
}))

vi.mock('./model-dispatcher', () => ({
  buildSpawnEnv: vi.fn(() => ({ modelFlag: '' }))
}))

vi.mock('./kill-hierarchy', () => ({
  executeKillHierarchy: vi.fn(() => Promise.resolve())
}))

vi.mock('./auto-triage', () => ({
  triageAgentEvent: vi.fn(() => ({}))
}))

vi.mock('./notification-router', () => ({
  routeNotification: vi.fn(() => ({}))
}))

const MockPtyProxyCtor = vi.hoisted(() =>
  vi.fn(function (this: unknown) {
    Object.assign(this as object, {
      startProxy: vi.fn(),
      stopProxy: vi.fn(),
      stopAll: vi.fn(),
      getSocketPath: vi.fn(() => null)
    })
  })
)

vi.mock('./pty-proxy', () => ({
  PtyProxy: MockPtyProxyCtor
}))

vi.mock('./sbar-generator', () => ({
  createAndStoreSBAR: vi.fn()
}))

vi.mock('../db/queries/agents.queries', () => ({
  insertAgent: vi.fn(),
  updateAgentStatus: vi.fn(),
  updateAgentPid: vi.fn(),
  updateAgentColor: vi.fn(),
  updateAgentModel: vi.fn(),
  updateAgentTaskDescription: vi.fn(),
  updateAgentName: vi.fn(),
  updateAgentVoiceMode: vi.fn(),
  getAgentById: vi.fn(),
  getAllAgents: vi.fn(() => [])
}))

vi.mock('../db/queries/repos.queries', () => ({
  getRepoById: vi.fn(),
  getRepoByPath: vi.fn(),
  insertRepo: vi.fn(),
  updateRepoLastUsed: vi.fn()
}))

vi.mock('../db/queries/history.queries', () => ({
  insertTerminalOutput: vi.fn()
}))

vi.mock('../db/queries/activity.queries', () => ({
  insertActivityEvent: vi.fn()
}))

vi.mock('../db/queries/sbar.queries', () => ({
  getSBARByAgentId: vi.fn()
}))

vi.mock('../db/queries/tasks.queries', () => ({
  getTaskByAgentId: vi.fn(() => null),
  updateTask: vi.fn()
}))

vi.mock('../db/queries/task-events.queries', () => ({
  insertTaskEvent: vi.fn()
}))

vi.mock('../parsers/cli-output-parser', () => ({
  createParser: vi.fn(() => ({ parse: vi.fn(() => null) }))
}))

vi.mock('../utils/strip-ansi', () => ({
  stripAnsi: vi.fn((s: string) => s)
}))

vi.mock('../utils/tts-response-filter', () => ({
  filterTtsResponse: vi.fn((s: string) => s)
}))

vi.mock('../utils/tts-buffer-reset', () => ({
  shouldResetTtsBuffer: vi.fn(() => false)
}))

const MockTtsTriggerCtor = vi.hoisted(() =>
  vi.fn(function (this: unknown) {
    Object.assign(this as object, {
      onStatusChange: vi.fn()
    })
  })
)

vi.mock('../utils/tts-trigger', () => ({
  TtsTrigger: MockTtsTriggerCtor
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { setPtyOwner, clearPtyOwner, canResizePty } from './agent-manager'

// These three functions operate on a module-level Map with no external
// dependencies — no mocking needed beyond loading the module.

describe('PTY resize ownership', () => {
  beforeEach(() => {
    // Reset ownership state between tests by clearing any lingering owner
    clearPtyOwner('agent-1')
    clearPtyOwner('agent-2')
  })

  describe('canResizePty', () => {
    it('returns true when no owner is registered', () => {
      expect(canResizePty('agent-1', 99)).toBe(true)
    })

    it('returns true when no owner and no caller id', () => {
      expect(canResizePty('agent-1', undefined)).toBe(true)
    })

    it('returns true for the registered owner', () => {
      setPtyOwner('agent-1', 42)
      expect(canResizePty('agent-1', 42)).toBe(true)
    })

    it('returns false for a different caller when owner is registered', () => {
      setPtyOwner('agent-1', 42)
      expect(canResizePty('agent-1', 99)).toBe(false)
    })

    it('returns false when caller id is undefined and owner is registered', () => {
      setPtyOwner('agent-1', 42)
      expect(canResizePty('agent-1', undefined)).toBe(false)
    })

    it('ownership is per-agent — different agents are independent', () => {
      setPtyOwner('agent-1', 10)
      // agent-2 has no owner, any caller can resize
      expect(canResizePty('agent-2', 99)).toBe(true)
      // agent-1 is owned by 10
      expect(canResizePty('agent-1', 99)).toBe(false)
    })
  })

  describe('clearPtyOwner', () => {
    it('allows any caller after ownership is cleared', () => {
      setPtyOwner('agent-1', 42)
      clearPtyOwner('agent-1')
      expect(canResizePty('agent-1', 99)).toBe(true)
    })

    it('is a no-op for unknown agentId', () => {
      expect(() => clearPtyOwner('unknown-agent')).not.toThrow()
    })

    it('does not affect other agents', () => {
      setPtyOwner('agent-1', 10)
      setPtyOwner('agent-2', 20)
      clearPtyOwner('agent-1')
      // agent-2 still owned by 20
      expect(canResizePty('agent-2', 99)).toBe(false)
      expect(canResizePty('agent-2', 20)).toBe(true)
    })
  })
})
