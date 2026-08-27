import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { readSettingsMcpServers } from './agent-mcp-config'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'agent-mcp-test-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('readSettingsMcpServers', () => {
  it('returns mcpServers from a valid settings.json with anamnesis', () => {
    const settingsPath = join(tempDir, 'settings.json')
    writeFileSync(settingsPath, JSON.stringify({
      mcpServers: {
        anamnesis: {
          command: '/path/to/anamnesis-mcp',
          env: {
            ANAMNESIS_URL: 'http://localhost:9300',
            AUTH_SECRET: 'secret123',
            OPTIMAEUS_CALLER: 'hephaestus',
          },
        },
      },
    }), 'utf-8')

    const result = readSettingsMcpServers(settingsPath)
    expect(result).toHaveProperty('anamnesis')
    expect((result.anamnesis as Record<string, unknown>).command).toBe('/path/to/anamnesis-mcp')
  })

  it('preserves all env vars in the anamnesis server entry', () => {
    const settingsPath = join(tempDir, 'settings.json')
    writeFileSync(settingsPath, JSON.stringify({
      mcpServers: {
        anamnesis: {
          command: '/path/to/anamnesis-mcp',
          env: {
            ANAMNESIS_URL: 'http://localhost:9300',
            AUTH_SECRET: 'secret123',
            OPTIMAEUS_CALLER: 'hephaestus',
          },
        },
      },
    }), 'utf-8')

    const result = readSettingsMcpServers(settingsPath)
    const env = (result.anamnesis as Record<string, Record<string, string>>).env
    expect(env.ANAMNESIS_URL).toBe('http://localhost:9300')
    expect(env.AUTH_SECRET).toBe('secret123')
    expect(env.OPTIMAEUS_CALLER).toBe('hephaestus')
  })

  it('returns empty object when settings.json has no mcpServers key', () => {
    const settingsPath = join(tempDir, 'settings.json')
    writeFileSync(settingsPath, JSON.stringify({ theme: 'dark', effortLevel: 'high' }), 'utf-8')

    const result = readSettingsMcpServers(settingsPath)
    expect(result).toEqual({})
  })

  it('returns empty object when settings.json is missing', () => {
    const result = readSettingsMcpServers(join(tempDir, 'nonexistent.json'))
    expect(result).toEqual({})
  })

  it('returns empty object when settings.json contains malformed JSON', () => {
    const settingsPath = join(tempDir, 'settings.json')
    writeFileSync(settingsPath, 'not-valid-json{{{', 'utf-8')

    const result = readSettingsMcpServers(settingsPath)
    expect(result).toEqual({})
  })
})
