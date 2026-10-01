import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { readSettingsMcpServers, applyAnamnesisEnv } from './agent-mcp-config'

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

describe('applyAnamnesisEnv (spawned agent MCP environment)', () => {
  const servers = (): Record<string, unknown> => ({
    anamnesis: {
      command: '/bin/anamnesis-mcp',
      env: { ANAMNESIS_URL: 'http://localhost:9300', OPTIMAEUS_CALLER: 'hephaestus' }
    },
    other: { command: 'node', env: { KEEP: '1' } }
  })

  function anamnesisEnv(result: Record<string, unknown>): Record<string, string> {
    return (result['anamnesis'] as { env: Record<string, string> }).env
  }

  it('injects AUTH_SECRET into the anamnesis MCP env', () => {
    expect(anamnesisEnv(applyAnamnesisEnv(servers(), 's3cret'))['AUTH_SECRET']).toBe('s3cret')
  })

  it('sets the caller identity to hephaestus', () => {
    expect(anamnesisEnv(applyAnamnesisEnv(servers(), 's3cret'))['OPTIMAEUS_CALLER']).toBe('hephaestus')
  })

  it('sets the caller to hephaestus even when the settings entry has no env block', () => {
    const bare = { anamnesis: { command: '/bin/anamnesis-mcp' } }
    const env = anamnesisEnv(applyAnamnesisEnv(bare, 's3cret'))
    expect(env['AUTH_SECRET']).toBe('s3cret')
    expect(env['OPTIMAEUS_CALLER']).toBe('hephaestus')
  })

  it('overrides a different caller identity with hephaestus', () => {
    const wrong = { anamnesis: { command: 'x', env: { OPTIMAEUS_CALLER: 'someone-else' } } }
    expect(anamnesisEnv(applyAnamnesisEnv(wrong, 's3cret'))['OPTIMAEUS_CALLER']).toBe('hephaestus')
  })

  it('preserves the existing env vars and the other MCP servers', () => {
    const result = applyAnamnesisEnv(servers(), 's3cret')
    expect(anamnesisEnv(result)['ANAMNESIS_URL']).toBe('http://localhost:9300')
    expect(result['other']).toEqual({ command: 'node', env: { KEEP: '1' } })
  })

  it('does not write an AUTH_SECRET key when no secret is available, but still sets the caller', () => {
    const env = anamnesisEnv(applyAnamnesisEnv(servers(), null))
    expect(env).not.toHaveProperty('AUTH_SECRET')
    expect(env['OPTIMAEUS_CALLER']).toBe('hephaestus')
  })

  it('does not invent an anamnesis server when none is configured', () => {
    const result = applyAnamnesisEnv({ other: { command: 'node' } }, 's3cret')
    expect(result).not.toHaveProperty('anamnesis')
    expect(result['other']).toEqual({ command: 'node' })
  })
})
