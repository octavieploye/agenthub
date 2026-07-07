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

describe('installClaudePlugin', () => {
  let testDir: string
  let src: string
  let dest: string

  beforeEach(() => {
    testDir = join(tmpdir(), `plugin-installer-test-${Date.now()}`)
    src = join(testDir, 'src')
    dest = join(testDir, 'dest')
    mkdirSync(src, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('installs plugin when dest does not exist', async () => {
    makePluginSource(src, '1.0.0')

    await installClaudePlugin({ sourcePath: src, destPath: dest })

    expect(existsSync(join(dest, '.claude-plugin', 'plugin.json'))).toBe(true)
    const installed = JSON.parse(readFileSync(join(dest, '.claude-plugin', 'plugin.json'), 'utf-8'))
    expect(installed.version).toBe('1.0.0')
    expect(existsSync(join(dest, 'hooks', 'session-start'))).toBe(true)
    expect(existsSync(join(dest, 'context', 'builder-mode.md'))).toBe(true)
  })

  it('skips install when version is already up-to-date', async () => {
    makePluginSource(src, '1.0.0')
    await installClaudePlugin({ sourcePath: src, destPath: dest })

    // write a sentinel file that must NOT be overwritten on a no-op re-run
    writeFileSync(join(dest, 'SENTINEL'), 'do-not-overwrite')

    await installClaudePlugin({ sourcePath: src, destPath: dest })

    expect(existsSync(join(dest, 'SENTINEL'))).toBe(true)
  })

  it('reinstalls when version differs', async () => {
    makePluginSource(src, '1.0.0')
    await installClaudePlugin({ sourcePath: src, destPath: dest })

    // bump version in source
    writeFileSync(
      join(src, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'agenthub', version: '1.1.0' })
    )

    await installClaudePlugin({ sourcePath: src, destPath: dest })

    const installed = JSON.parse(readFileSync(join(dest, '.claude-plugin', 'plugin.json'), 'utf-8'))
    expect(installed.version).toBe('1.1.0')
  })

  it('does not throw when source path does not exist', async () => {
    await expect(
      installClaudePlugin({ sourcePath: '/nonexistent/plugin-source', destPath: dest })
    ).resolves.not.toThrow()
    expect(existsSync(dest)).toBe(false)
  })

  it('creates dest directory tree if it does not exist', async () => {
    makePluginSource(src, '1.0.0')
    const deepDest = join(testDir, 'a', 'b', 'c', 'agenthub')

    await installClaudePlugin({ sourcePath: src, destPath: deepDest })

    expect(existsSync(deepDest)).toBe(true)
    expect(existsSync(join(deepDest, '.claude-plugin', 'plugin.json'))).toBe(true)
  })
})
