import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

// Mock electron-log before importing module under test
import { vi } from 'vitest'
vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

import { ClaudeMonitor } from './claude-monitor'

let testDir: string

afterEach(() => {
  // Clean up temp directory
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true })
  }
})

function createTestDir(): string {
  const dir = join(tmpdir(), `claude-monitor-test-${randomUUID()}`)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function writeJsonlEntry(filePath: string): void {
  const entry = JSON.stringify({
    type: 'assistant',
    timestamp: new Date().toISOString(),
    sessionId: 'sess-test',
    message: {
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: 100, output_tokens: 50 }
    }
  })
  fs.writeFileSync(filePath, entry + '\n', 'utf-8')
}

describe('ClaudeMonitor — recursive readJsonlFiles', () => {
  it('reads jsonl files nested inside UUID subdirectory (new Claude format)', async () => {
    testDir = createTestDir()

    // Simulate new format: <projects>/<project-slug>/<UUID>/subagents/session.jsonl
    const projectDir = join(testDir, 'projects')
    const projectSlug = join(projectDir, 'my-project')
    const uuidDir = join(projectSlug, 'abc-123-uuid')
    const subagentsDir = join(uuidDir, 'subagents')
    fs.mkdirSync(subagentsDir, { recursive: true })

    const jsonlPath = join(subagentsDir, 'session.jsonl')
    writeJsonlEntry(jsonlPath)

    const monitor = new ClaudeMonitor({ claudeDir: testDir })
    await monitor.refresh()
    const snapshot = monitor.getSnapshot()

    // If recursive is working, it finds the nested JSONL and counts 1 message
    expect(snapshot.totalMessages).toBe(1)
  })

  it('still reads flat jsonl files at the top level (old Claude format)', async () => {
    testDir = createTestDir()

    const projectDir = join(testDir, 'projects')
    const projectSlug = join(projectDir, 'flat-project')
    fs.mkdirSync(projectSlug, { recursive: true })

    const jsonlPath = join(projectSlug, 'session.jsonl')
    writeJsonlEntry(jsonlPath)

    const monitor = new ClaudeMonitor({ claudeDir: testDir })
    await monitor.refresh()
    const snapshot = monitor.getSnapshot()

    expect(snapshot.totalMessages).toBe(1)
  })

  it('reads both flat and nested files in the same project directory', async () => {
    testDir = createTestDir()

    const projectDir = join(testDir, 'projects')
    const projectSlug = join(projectDir, 'mixed-project')
    const uuidDir = join(projectSlug, 'some-uuid-456')
    const subagentsDir = join(uuidDir, 'subagents')
    fs.mkdirSync(subagentsDir, { recursive: true })

    // flat file
    writeJsonlEntry(join(projectSlug, 'flat.jsonl'))
    // nested file
    writeJsonlEntry(join(subagentsDir, 'nested.jsonl'))

    const monitor = new ClaudeMonitor({ claudeDir: testDir })
    await monitor.refresh()
    const snapshot = monitor.getSnapshot()

    // Should count both files → 2 messages
    expect(snapshot.totalMessages).toBe(2)
  })
})
