import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { checkCodexHealth, type CodexHealthStatus } from './codex-health'

// electron-log requires an Electron runtime — mock it for vitest (Node/jsdom)
vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe('checkCodexHealth', () => {
  it('returns a valid CodexHealthStatus object', async () => {
    const result: CodexHealthStatus = await checkCodexHealth()
    expect(typeof result.installed).toBe('boolean')
    expect(typeof result.authenticated).toBe('boolean')
    if (result.version !== undefined) {
      expect(typeof result.version).toBe('string')
    }
  })

  it('version is undefined when installed is false', async () => {
    const result = await checkCodexHealth()
    if (!result.installed) {
      expect(result.version).toBeUndefined()
    }
    // When installed is true, version may still be undefined if --version fails
    // (e.g. broken binary, missing vendor files). This is expected.
  })

  it('authenticated is false when installed is false', async () => {
    const result = await checkCodexHealth()
    if (!result.installed) {
      expect(result.authenticated).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// ensureCodexMcpServers
// ---------------------------------------------------------------------------
// The codex CLI is an external process (not owned by this codebase and not
// guaranteed to be installed). The _exec injectable parameter lets tests
// control what `codex mcp list` and `codex mcp add` return without shelling
// out — an acceptable mock boundary per the testing philosophy.
// vi.resetModules() is required between tests to reset the module-level
// codexMcpEnsured flag.
// ---------------------------------------------------------------------------

const MCP_CONFIG = {
  mcpServers: {
    anamnesis: {
      command: '/usr/local/bin/anamnesis-mcp',
      args: [] as string[],
      env: { ANAMNESIS_URL: 'http://localhost:9300', OPTIMAEUS_CALLER: 'hephaestus' },
    },
  },
}

describe('ensureCodexMcpServers', () => {
  let tmpDir: string
  let mcpJsonPath: string
  let ensureCodexMcpServers: (
    m: string,
    t: string,
    k: string,
    d: string,
    s: string,
    execFn?: (cmd: string, args: string[], opts: { timeout: number }) => Promise<{ stdout: string; stderr: string }>
  ) => Promise<void>

  beforeEach(async () => {
    // Real temp file — no readFileSync mock needed
    tmpDir = mkdtempSync(join(tmpdir(), 'codex-ensure-test-'))
    mcpJsonPath = join(tmpDir, '.mcp.json')
    writeFileSync(mcpJsonPath, JSON.stringify(MCP_CONFIG), 'utf-8')

    // Reset module to clear the codexMcpEnsured flag between tests
    vi.resetModules()
    vi.doMock('electron-log/main', () => ({
      default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }))

    const mod = await import('./codex-health')
    ensureCodexMcpServers = mod.ensureCodexMcpServers
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    vi.doUnmock('electron-log/main')
    vi.resetModules()
  })

  it('skips anamnesis and telegram re-registration but always re-registers agenthub-kanban', async () => {
    const execFn = vi.fn().mockResolvedValue({ stdout: 'anamnesis\nagenthub-telegram\nagenthub-kanban', stderr: '' })
    await ensureCodexMcpServers(mcpJsonPath, '/fake/telegram.js', '/fake/kanban.js', '/fake/db.db', '/fake/socket.sock', execFn)
    // list + remove agenthub-kanban + add agenthub-kanban = 3 calls
    expect(execFn).toHaveBeenCalledTimes(3)
    expect(execFn).toHaveBeenCalledWith('codex', ['mcp', 'list'], expect.any(Object))
    expect(execFn).toHaveBeenCalledWith('codex', ['mcp', 'remove', 'agenthub-kanban'], expect.any(Object))
    const addCall = execFn.mock.calls.find(
      (c: unknown[]) => (c[1] as string[])[1] === 'add' && (c[1] as string[])[2] === 'agenthub-kanban'
    )
    expect(addCall).toBeDefined()
  })

  it('registers anamnesis when absent from list', async () => {
    const execFn = vi.fn().mockImplementation(
      (_cmd: string, args: string[]) =>
        args[1] === 'list'
          ? Promise.resolve({ stdout: 'agenthub-telegram\nagenthub-kanban', stderr: '' })
          : Promise.resolve({ stdout: '', stderr: '' })
    )
    await ensureCodexMcpServers(mcpJsonPath, '/fake/telegram.js', '/fake/kanban.js', '/fake/db.db', '/fake/socket.sock', execFn)

    const addCalls = execFn.mock.calls.filter(
      (c: unknown[]) => (c[1] as string[])[1] === 'add' && (c[1] as string[])[2] === 'anamnesis'
    )
    expect(addCalls).toHaveLength(1)
    const addArgs = addCalls[0][1] as string[]
    expect(addArgs).toContain('--env')
    expect(addArgs).toContain('ANAMNESIS_URL=http://localhost:9300')
    expect(addArgs).toContain('--')
    expect(addArgs).toContain('/usr/local/bin/anamnesis-mcp')
  })

  it('registers agenthub-telegram when absent from list', async () => {
    const execFn = vi.fn().mockImplementation(
      (_cmd: string, args: string[]) =>
        args[1] === 'list'
          ? Promise.resolve({ stdout: 'anamnesis\nagenthub-kanban', stderr: '' })
          : Promise.resolve({ stdout: '', stderr: '' })
    )
    await ensureCodexMcpServers(mcpJsonPath, '/fake/telegram.js', '/fake/kanban.js', '/fake/db.db', '/fake/socket.sock', execFn)

    const addCalls = execFn.mock.calls.filter(
      (c: unknown[]) =>
        (c[1] as string[])[1] === 'add' && (c[1] as string[])[2] === 'agenthub-telegram'
    )
    expect(addCalls).toHaveLength(1)
    const addArgs = addCalls[0][1] as string[]
    expect(addArgs).toContain('node')
    expect(addArgs).toContain('/fake/telegram.js')
  })

  it('does not throw when codex mcp add fails', async () => {
    const execFn = vi.fn().mockImplementation(
      (_cmd: string, args: string[]) =>
        args[1] === 'list'
          ? Promise.resolve({ stdout: '', stderr: '' }) // all absent
          : Promise.reject(new Error('codex mcp add failed'))
    )
    await expect(
      ensureCodexMcpServers(mcpJsonPath, '/fake/telegram.js', '/fake/kanban.js', '/fake/db.db', '/fake/socket.sock', execFn)
    ).resolves.toBeUndefined()
  })

  it('always removes and re-registers agenthub-kanban regardless of list output', async () => {
    const execFn = vi.fn().mockImplementation(
      (_cmd: string, args: string[]) =>
        args[1] === 'list'
          ? Promise.resolve({ stdout: 'anamnesis\nagenthub-telegram', stderr: '' })
          : Promise.resolve({ stdout: '', stderr: '' })
    )
    await ensureCodexMcpServers(mcpJsonPath, '/fake/telegram.js', '/fake/kanban.js', '/fake/db.db', '/fake/socket.sock', execFn)

    const removeCalls = execFn.mock.calls.filter(
      (c: unknown[]) =>
        (c[1] as string[])[1] === 'remove' && (c[1] as string[])[2] === 'agenthub-kanban'
    )
    expect(removeCalls).toHaveLength(1)

    const addCalls = execFn.mock.calls.filter(
      (c: unknown[]) =>
        (c[1] as string[])[1] === 'add' && (c[1] as string[])[2] === 'agenthub-kanban'
    )
    expect(addCalls).toHaveLength(1)
    const addArgs = addCalls[0][1] as string[]
    expect(addArgs).toContain('--env')
    expect(addArgs).toContain('AGENTHUB_DB_PATH=/fake/db.db')
    expect(addArgs).toContain('AGENTHUB_SOCKET_PATH=/fake/socket.sock')
    expect(addArgs).toContain('node')
    expect(addArgs).toContain('/fake/kanban.js')
  })

  it('only runs once per module instance (flag respected)', async () => {
    const execFn = vi.fn().mockResolvedValue({ stdout: 'anamnesis\nagenthub-telegram\nagenthub-kanban', stderr: '' })
    await ensureCodexMcpServers(mcpJsonPath, '/fake/telegram.js', '/fake/kanban.js', '/fake/db.db', '/fake/socket.sock', execFn)
    await ensureCodexMcpServers(mcpJsonPath, '/fake/telegram.js', '/fake/kanban.js', '/fake/db.db', '/fake/socket.sock', execFn)
    await ensureCodexMcpServers(mcpJsonPath, '/fake/telegram.js', '/fake/kanban.js', '/fake/db.db', '/fake/socket.sock', execFn)
    // Module flag is set after first call — subsequent calls return immediately.
    // First call: list + remove agenthub-kanban + add agenthub-kanban = 3 calls.
    expect(execFn).toHaveBeenCalledTimes(3)
  })
})
