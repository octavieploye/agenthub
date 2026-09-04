import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import log from 'electron-log/main'
import type { CodexHealthStatus } from '../../shared/types/codex-health.types'

const execFileAsync = promisify(execFile)

export type { CodexHealthStatus }

type CodexExecFn = (cmd: string, args: string[], options: { timeout: number }) => Promise<{ stdout: string; stderr: string }>

let codexMcpEnsured = false
let codexMcpLastSocketPath = ''

/** Reset the MCP registration gate — exposed for testing. */
export function resetCodexMcpEnsured(): void {
  codexMcpEnsured = false
  codexMcpLastSocketPath = ''
}

export async function checkCodexHealth(): Promise<CodexHealthStatus> {
  // Check 1: is `codex` binary on PATH?
  let installed = false
  try {
    await execFileAsync('which', ['codex'], { timeout: 5000 })
    installed = true
  } catch {
    return { installed: false, authenticated: false }
  }

  // Check 2: does ~/.codex/auth.json exist?
  const authenticated = existsSync(join(homedir(), '.codex', 'auth.json'))

  // Check 3: get version
  let version: string | undefined
  try {
    const { stdout } = await execFileAsync('codex', ['--version'], { timeout: 5000 })
    version = stdout.trim()
  } catch {
    // binary exists but --version failed — still installed, version unknown
  }

  return { installed, authenticated, version }
}

/**
 * Ensures the anamnesis and agenthub-telegram MCP servers are registered in Codex's
 * global config (~/.codex/config.toml) via `codex mcp add`. Idempotent: skips servers
 * already listed in `codex mcp list` and runs at most once per process lifetime.
 *
 * Non-blocking: all errors are logged as warnings, never thrown.
 */
export async function ensureCodexMcpServers(
  mcpJsonPath: string,
  telegramScriptPath: string,
  kanbanScriptPath: string,
  dbPath: string,
  socketPath: string,
  _exec: CodexExecFn = execFileAsync as CodexExecFn,
  socketToken = ''
): Promise<void> {
  if (codexMcpEnsured && socketPath === codexMcpLastSocketPath) return
  codexMcpEnsured = true
  codexMcpLastSocketPath = socketPath

  try {
    let listOutput = ''
    try {
      const { stdout } = await _exec('codex', ['mcp', 'list'], { timeout: 10000 })
      listOutput = stdout
    } catch (err) {
      log.warn('ensureCodexMcpServers: codex mcp list failed — skipping MCP registration', {
        error: err instanceof Error ? err.message : String(err),
      })
      return
    }

    if (!/\banamnesis\b/.test(listOutput)) {
      try {
        const rawConfig = readFileSync(mcpJsonPath, 'utf-8')
        const mcpJson = JSON.parse(rawConfig) as {
          mcpServers?: {
            anamnesis?: { command?: string; args?: string[]; env?: Record<string, string> }
          }
        }
        const anamnesisCfg = mcpJson?.mcpServers?.anamnesis
        if (anamnesisCfg?.command) {
          const addArgs = ['mcp', 'add', 'anamnesis']
          for (const [k, v] of Object.entries(anamnesisCfg.env ?? {})) {
            addArgs.push('--env', `${k}=${v}`)
          }
          addArgs.push('--', anamnesisCfg.command)
          if (Array.isArray(anamnesisCfg.args) && anamnesisCfg.args.length > 0) {
            addArgs.push(...anamnesisCfg.args)
          }
          await _exec('codex', addArgs, { timeout: 10000 })
        }
      } catch (err) {
        log.warn('ensureCodexMcpServers: failed to register anamnesis MCP server', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    if (!/\bagenthub-telegram\b/.test(listOutput)) {
      try {
        await _exec(
          'codex',
          ['mcp', 'add', 'agenthub-telegram', '--', 'node', telegramScriptPath],
          { timeout: 10000 }
        )
      } catch (err) {
        log.warn('ensureCodexMcpServers: failed to register agenthub-telegram MCP server', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    // agenthub-kanban: always remove the existing entry and re-add with the current
    // socket path and token. Both values are regenerated on every Electron restart
    // (pid-based socket path + randomUUID token), so a "skip if already listed" check
    // leaves stale values in ~/.codex/config.toml → `connection closed: initialize response`.
    try {
      await _exec('codex', ['mcp', 'remove', 'agenthub-kanban'], { timeout: 10000 })
    } catch {
      // Server may not be registered yet — ignore
    }
    try {
      await _exec(
        'codex',
        [
          'mcp', 'add', 'agenthub-kanban',
          '--env', `AGENTHUB_DB_PATH=${dbPath}`,
          '--env', `AGENTHUB_SOCKET_PATH=${socketPath}`,
          '--env', `AGENTHUB_SOCKET_TOKEN=${socketToken}`,
          '--', process.execPath, kanbanScriptPath,
        ],
        { timeout: 10000 }
      )
    } catch (err) {
      log.warn('ensureCodexMcpServers: failed to register agenthub-kanban MCP server', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  } catch (err) {
    log.warn('ensureCodexMcpServers: unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
