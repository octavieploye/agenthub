import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { dirname, join, relative } from 'path'
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

function resolveGlobalClaudeSource(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    const isDev = !app.isPackaged
    return isDev
      ? join(app.getAppPath(), 'global-claude')
      : join(process.resourcesPath, 'global-claude')
  } catch {
    return '' // not in Electron context — sync will be skipped
  }
}

function resolveDestPath(): string {
  return join(homedir(), '.claude', 'plugins', 'agenthub')
}

function resolveRegistryPath(): string {
  return join(homedir(), '.claude', 'plugins', 'installed_plugins.json')
}

function resolveGlobalClaudeDest(): string {
  return join(homedir(), '.claude')
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

// Register the agenthub plugin in installed_plugins.json with global scope so
// Claude Code loads its hooks in every session (including those spawned by agenthub).
function registerPlugin(registryPath: string, installPath: string, version: string | null): void {
  type PluginEntry = {
    scope: string
    installPath: string
    version: string | null
    installedAt: string
    lastUpdated: string
  }
  type Registry = { version: number; plugins: Record<string, PluginEntry[]> }

  let registry: Registry = { version: 2, plugins: {} }
  if (existsSync(registryPath)) {
    try {
      registry = JSON.parse(readFileSync(registryPath, 'utf-8')) as Registry
    } catch {
      // malformed registry — start fresh
    }
  }

  const key = 'agenthub@local'
  const existing: PluginEntry[] = registry.plugins[key] ?? []
  const globalEntry = existing.find(e => e.scope === 'global')

  if (globalEntry && globalEntry.version === version) {
    log.info('Claude plugin already registered globally', { version })
    return
  }

  const now = new Date().toISOString()
  const entry: PluginEntry = {
    scope: 'global',
    installPath,
    version,
    installedAt: globalEntry?.installedAt ?? now,
    lastUpdated: now
  }

  registry.plugins[key] = [entry, ...existing.filter(e => e.scope !== 'global')]

  mkdirSync(dirname(registryPath), { recursive: true })
  writeFileSync(registryPath, JSON.stringify(registry, null, 2))
  log.info('Claude plugin registered globally', { version, installPath })
}

// Sync global-claude/ → ~/.claude/ (idempotent, content-based).
// Writes CLAUDE.md and commands so every Claude Code session opened from
// within agenthub carries the coordinator identity without manual setup.
function syncGlobalClaude(src: string, dest: string): void {
  if (!src || !existsSync(src)) {
    log.warn('global-claude source not found, skipping sync', { src })
    return
  }

  function walk(dir: string, base: string): string[] {
    const entries: string[] = []
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) {
        entries.push(...walk(full, base))
      } else {
        entries.push(relative(base, full))
      }
    }
    return entries
  }

  let written = 0
  for (const rel of walk(src, src)) {
    const srcFile = join(src, rel)
    const destFile = join(dest, rel)
    let needsWrite = true
    if (existsSync(destFile)) {
      needsWrite = readFileSync(srcFile, 'utf-8') !== readFileSync(destFile, 'utf-8')
    }
    if (needsWrite) {
      mkdirSync(dirname(destFile), { recursive: true })
      writeFileSync(destFile, readFileSync(srcFile))
      written++
    }
  }

  if (written > 0) {
    log.info('global-claude synced to ~/.claude', { files: written })
  } else {
    log.info('global-claude already up-to-date')
  }
}

export async function installClaudePlugin(
  overrides?: {
    sourcePath?: string
    destPath?: string
    registryPath?: string
    globalClaudeSource?: string
    globalClaudeDest?: string
  }
): Promise<void> {
  const src = overrides?.sourcePath ?? resolveSourcePath()
  const dest = overrides?.destPath ?? resolveDestPath()
  const registryPath = overrides?.registryPath ?? resolveRegistryPath()
  const gcSrc = overrides?.globalClaudeSource ?? resolveGlobalClaudeSource()
  const gcDest = overrides?.globalClaudeDest ?? resolveGlobalClaudeDest()

  if (!existsSync(src)) {
    log.warn('Claude plugin source not found, skipping install', { src })
    return
  }

  const srcVersion = readPluginVersion(join(src, '.claude-plugin', 'plugin.json'))
  const destVersion = readPluginVersion(join(dest, '.claude-plugin', 'plugin.json'))

  if (srcVersion !== null && srcVersion === destVersion) {
    log.info('Claude plugin already up-to-date', { version: srcVersion })
  } else {
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

  // Register globally so Claude Code loads the plugin and its SessionStart hook
  try {
    registerPlugin(registryPath, dest, srcVersion)
  } catch (err) {
    log.warn('Claude plugin registration failed — plugin hooks may not fire', { err })
  }

  // Sync global-claude/ → ~/.claude/ so coordinator identity is always present
  try {
    syncGlobalClaude(gcSrc, gcDest)
  } catch (err) {
    log.warn('global-claude sync failed — global CLAUDE.md may be missing', { err })
  }
}
