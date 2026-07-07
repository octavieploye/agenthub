import { cpSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import log from 'electron-log/main'

function resolveSourcePath(): string {
  // Lazy require to avoid importing Electron in test environments
  // (tests always supply overrides, so this branch is never reached during tests)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron')
  const isDev = !app.isPackaged
  return isDev
    ? join(app.getAppPath(), 'plugin')
    : join(process.resourcesPath, 'plugin')
}

function resolveDestPath(): string {
  return join(homedir(), '.claude', 'plugins', 'agenthub')
}

function readPluginVersion(pluginJsonPath: string): string | null {
  try {
    const raw = readFileSync(pluginJsonPath, 'utf-8')
    const parsed = JSON.parse(raw) as { version?: string }
    return parsed.version ?? null
  } catch {
    return null
  }
}

export async function installClaudePlugin(
  overrides?: { sourcePath?: string; destPath?: string }
): Promise<void> {
  const src = overrides?.sourcePath ?? resolveSourcePath()
  const dest = overrides?.destPath ?? resolveDestPath()

  if (!existsSync(src)) {
    log.warn('Claude plugin source not found, skipping install', { src })
    return
  }

  const srcVersion = readPluginVersion(join(src, '.claude-plugin', 'plugin.json'))
  const destVersion = readPluginVersion(join(dest, '.claude-plugin', 'plugin.json'))

  if (srcVersion !== null && srcVersion === destVersion) {
    log.info('Claude plugin already up-to-date', { version: srcVersion })
    return
  }

  try {
    mkdirSync(dest, { recursive: true })
    cpSync(src, dest, { recursive: true })
    log.info('Claude plugin installed', {
      version: srcVersion,
      previousVersion: destVersion,
      dest
    })
  } catch (err) {
    log.warn('Claude plugin install failed — continuing without plugin update', { err })
  }
}
