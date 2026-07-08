import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { installClaudePlugin } from '../plugin-installer'

function makePluginSource(dir: string, version: string): void {
  mkdirSync(join(dir, '.claude-plugin'), { recursive: true })
  mkdirSync(join(dir, 'hooks'), { recursive: true })
  mkdirSync(join(dir, 'context'), { recursive: true })
  writeFileSync(
    join(dir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'agenthub', version })
  )
  writeFileSync(join(dir, 'hooks', 'session-start'), '#!/usr/bin/env bash\nexit 0')
  writeFileSync(join(dir, 'context', 'builder-mode.md'), '## Builder Mode')
}

function makeGlobalClaudeSource(dir: string): void {
  mkdirSync(join(dir, 'commands'), { recursive: true })
  writeFileSync(join(dir, 'CLAUDE.md'), '# Global Rules\n')
  writeFileSync(join(dir, 'commands', 'optimize.md'), '# Optimize\n')
}

describe('installClaudePlugin', () => {
  let testDir: string
  let src: string
  let dest: string
  let registryPath: string
  let gcSrc: string
  let gcDest: string

  beforeEach(() => {
    testDir = join(tmpdir(), `plugin-installer-test-${Date.now()}`)
    src = join(testDir, 'src')
    dest = join(testDir, 'dest')
    registryPath = join(testDir, 'installed_plugins.json')
    gcSrc = join(testDir, 'global-claude')
    gcDest = join(testDir, 'dot-claude')
    mkdirSync(src, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  // ── Plugin copy ────────────────────────────────────────────────────────────

  it('installs plugin when dest does not exist', async () => {
    makePluginSource(src, '1.0.0')

    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    expect(existsSync(join(dest, '.claude-plugin', 'plugin.json'))).toBe(true)
    const installed = JSON.parse(readFileSync(join(dest, '.claude-plugin', 'plugin.json'), 'utf-8'))
    expect(installed.version).toBe('1.0.0')
    expect(existsSync(join(dest, 'hooks', 'session-start'))).toBe(true)
    expect(existsSync(join(dest, 'context', 'builder-mode.md'))).toBe(true)
  })

  it('skips install when version is already up-to-date', async () => {
    makePluginSource(src, '1.0.0')
    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    // write a sentinel file that must NOT be overwritten on a no-op re-run
    writeFileSync(join(dest, 'SENTINEL'), 'do-not-overwrite')

    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    expect(existsSync(join(dest, 'SENTINEL'))).toBe(true)
  })

  it('reinstalls when version differs', async () => {
    makePluginSource(src, '1.0.0')
    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    // bump version in source
    writeFileSync(
      join(src, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'agenthub', version: '1.1.0' })
    )

    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    const installed = JSON.parse(readFileSync(join(dest, '.claude-plugin', 'plugin.json'), 'utf-8'))
    expect(installed.version).toBe('1.1.0')
  })

  it('does not throw when source path does not exist', async () => {
    await expect(
      installClaudePlugin({ sourcePath: '/nonexistent/plugin-source', destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })
    ).resolves.not.toThrow()
    expect(existsSync(dest)).toBe(false)
  })

  it('creates dest directory tree if it does not exist', async () => {
    makePluginSource(src, '1.0.0')
    const deepDest = join(testDir, 'a', 'b', 'c', 'agenthub')

    await installClaudePlugin({ sourcePath: src, destPath: deepDest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    expect(existsSync(deepDest)).toBe(true)
    expect(existsSync(join(deepDest, '.claude-plugin', 'plugin.json'))).toBe(true)
  })

  // ── Plugin registration ────────────────────────────────────────────────────

  it('writes global entry to installed_plugins.json after install', async () => {
    makePluginSource(src, '1.0.0')

    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    const registry = JSON.parse(readFileSync(registryPath, 'utf-8'))
    const entries = registry.plugins['agenthub@local']
    expect(entries).toBeDefined()
    const globalEntry = entries.find((e: { scope: string }) => e.scope === 'global')
    expect(globalEntry).toBeDefined()
    expect(globalEntry.version).toBe('1.0.0')
    expect(globalEntry.installPath).toBe(dest)
  })

  it('registration is idempotent — same version preserves installedAt', async () => {
    makePluginSource(src, '1.0.0')
    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    const before = JSON.parse(readFileSync(registryPath, 'utf-8'))
    const installedAt = before.plugins['agenthub@local'][0].installedAt

    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    const after = JSON.parse(readFileSync(registryPath, 'utf-8'))
    expect(after.plugins['agenthub@local'][0].installedAt).toBe(installedAt)
  })

  it('updates registry entry when version bumps', async () => {
    makePluginSource(src, '1.0.0')
    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    writeFileSync(join(src, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'agenthub', version: '2.0.0' }))
    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    const registry = JSON.parse(readFileSync(registryPath, 'utf-8'))
    const globalEntry = registry.plugins['agenthub@local'].find((e: { scope: string }) => e.scope === 'global')
    expect(globalEntry.version).toBe('2.0.0')
  })

  it('preserves existing non-global entries in registry', async () => {
    // Pre-populate registry with a local-scoped entry
    mkdirSync(join(testDir), { recursive: true })
    writeFileSync(registryPath, JSON.stringify({
      version: 2,
      plugins: {
        'agenthub@local': [{ scope: 'local', projectPath: '/some/project', installPath: dest, version: '1.0.0', installedAt: '2026-01-01T00:00:00.000Z', lastUpdated: '2026-01-01T00:00:00.000Z' }]
      }
    }))

    makePluginSource(src, '1.0.0')
    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    const registry = JSON.parse(readFileSync(registryPath, 'utf-8'))
    const entries = registry.plugins['agenthub@local']
    expect(entries.some((e: { scope: string }) => e.scope === 'local')).toBe(true)
    expect(entries.some((e: { scope: string }) => e.scope === 'global')).toBe(true)
  })

  // ── global-claude sync ─────────────────────────────────────────────────────

  it('syncs global-claude files to dest on first install', async () => {
    makePluginSource(src, '1.0.0')
    makeGlobalClaudeSource(gcSrc)

    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    expect(existsSync(join(gcDest, 'CLAUDE.md'))).toBe(true)
    expect(existsSync(join(gcDest, 'commands', 'optimize.md'))).toBe(true)
    expect(readFileSync(join(gcDest, 'CLAUDE.md'), 'utf-8')).toBe('# Global Rules\n')
  })

  it('global-claude sync is idempotent — unchanged files are not rewritten', async () => {
    makePluginSource(src, '1.0.0')
    makeGlobalClaudeSource(gcSrc)
    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    // Write a sentinel alongside the synced files
    writeFileSync(join(gcDest, 'SENTINEL'), 'untouched')

    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    expect(existsSync(join(gcDest, 'SENTINEL'))).toBe(true)
  })

  it('global-claude sync overwrites changed files', async () => {
    makePluginSource(src, '1.0.0')
    makeGlobalClaudeSource(gcSrc)
    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    // Change the source CLAUDE.md
    writeFileSync(join(gcSrc, 'CLAUDE.md'), '# Updated Rules\n')
    await installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: gcSrc, globalClaudeDest: gcDest })

    expect(readFileSync(join(gcDest, 'CLAUDE.md'), 'utf-8')).toBe('# Updated Rules\n')
  })

  it('skips global-claude sync when source does not exist', async () => {
    makePluginSource(src, '1.0.0')

    await expect(
      installClaudePlugin({ sourcePath: src, destPath: dest, registryPath, globalClaudeSource: '/nonexistent/global-claude', globalClaudeDest: gcDest })
    ).resolves.not.toThrow()
    expect(existsSync(join(gcDest, 'CLAUDE.md'))).toBe(false)
  })
})
