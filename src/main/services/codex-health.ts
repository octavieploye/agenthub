import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { CodexHealthStatus } from '../../shared/types/codex-health.types'

const execFileAsync = promisify(execFile)

export type { CodexHealthStatus }

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
