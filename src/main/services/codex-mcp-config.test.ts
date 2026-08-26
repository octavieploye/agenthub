import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { writeCodexMcpConfig, cleanupCodexMcpConfig } from './codex-mcp-config'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'codex-mcp-test-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('writeCodexMcpConfig', () => {
  it('writes valid JSON to the target directory', () => {
    const result = writeCodexMcpConfig({
      targetDir: tempDir,
      agentId: 'agent-123',
      agentName: 'test-agent',
      repoName: 'my-repo',
      telegramSocketPath: '/tmp/telegram.sock',
      telegramScriptPath: '/path/to/index.js',
    })

    expect(result).not.toBeNull()
    const content = JSON.parse(readFileSync(result!, 'utf-8'))
    expect(content.mcpServers).toBeDefined()
  })

  it('includes agenthub-telegram server entry', () => {
    const result = writeCodexMcpConfig({
      targetDir: tempDir,
      agentId: 'agent-456',
      agentName: 'codex-worker',
      repoName: 'agenthub',
      telegramSocketPath: '/tmp/tg.sock',
      telegramScriptPath: '/path/to/index.js',
    })

    const content = JSON.parse(readFileSync(result!, 'utf-8'))
    expect(content.mcpServers['agenthub-telegram']).toBeDefined()
    expect(content.mcpServers['agenthub-telegram'].command).toBe('node')
    expect(content.mcpServers['agenthub-telegram'].args).toContain('/path/to/index.js')
  })

  it('passes agent env vars to the MCP server', () => {
    const result = writeCodexMcpConfig({
      targetDir: tempDir,
      agentId: 'agent-789',
      agentName: 'worker',
      repoName: 'repo',
      telegramSocketPath: '/tmp/sock',
      telegramScriptPath: '/path/to/index.js',
    })

    const content = JSON.parse(readFileSync(result!, 'utf-8'))
    const env = content.mcpServers['agenthub-telegram'].env
    expect(env.AGENTHUB_TELEGRAM_SOCK).toBe('/tmp/sock')
    expect(env.AGENTHUB_AGENT_ID).toBe('agent-789')
    expect(env.AGENTHUB_AGENT_NAME).toBe('worker')
    expect(env.AGENTHUB_AGENT_REPO).toBe('repo')
  })

  it('returns null when no telegram socket path', () => {
    const result = writeCodexMcpConfig({
      targetDir: tempDir,
      agentId: 'agent-000',
      agentName: 'worker',
      repoName: 'repo',
      telegramSocketPath: null,
      telegramScriptPath: '/path/to/index.js',
    })

    expect(result).toBeNull()
  })
})

describe('cleanupCodexMcpConfig', () => {
  it('removes the config file', () => {
    const result = writeCodexMcpConfig({
      targetDir: tempDir,
      agentId: 'cleanup-test',
      agentName: 'worker',
      repoName: 'repo',
      telegramSocketPath: '/tmp/sock',
      telegramScriptPath: '/path/to/index.js',
    })

    expect(existsSync(result!)).toBe(true)
    cleanupCodexMcpConfig(tempDir, 'cleanup-test')
    expect(existsSync(result!)).toBe(false)
  })

  it('does not throw when file is already gone', () => {
    expect(() => cleanupCodexMcpConfig(tempDir, 'nonexistent')).not.toThrow()
  })
})
