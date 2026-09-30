// @vitest-environment node
// C-T1 (RED for bootstrap cases): secret-store.ts is the ONLY Anamnesis secret source (plan flag 4).
//
// Contract under test (implemented in C-T4):
//   loadAnamnesisSecret()                          — reads ONLY settings.anamnesis_auth_secret (safeStorage); env is never a source
//   bootstrapAnamnesisSecretFromEnv(env?): boolean — one-time import of env.ANAMNESIS_AUTH_SECRET into the store;
//                                                    true = imported now, false = nothing done (env unset OR a secret already stored)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Electron boundary — safeStorage needs a running Electron process. Reversible fake, not a no-op.
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (plain: string) => Buffer.from(`enc:${plain}`, 'utf8'),
    decryptString: (buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''),
  },
}))

import { getDb, closeDb, resetDb } from '../db/connection'
import {
  loadAnamnesisSecret,
  storeAnamnesisSecret,
  bootstrapAnamnesisSecretFromEnv,
  stripAgentSecretEnv,
} from './secret-store'
import { buildDockerExecEnv } from './adapters/docker-agent-adapter'

describe('secret-store', () => {
  beforeEach(() => {
    resetDb()
    getDb(':memory:')
  })

  afterEach(() => {
    closeDb()
  })

  it('round-trips a stored secret and never stores it in plaintext', () => {
    storeAnamnesisSecret('s3cret-value')

    expect(loadAnamnesisSecret()).toBe('s3cret-value')
    const raw = getDb()
      .prepare('SELECT anamnesis_auth_secret AS blob FROM settings WHERE anamnesis_auth_secret IS NOT NULL')
      .get() as { blob: Buffer }
    expect(raw.blob.toString('utf8')).not.toBe('s3cret-value')
  })

  it('returns an empty string when nothing is stored', () => {
    expect(loadAnamnesisSecret()).toBe('')
  })

  it('does not treat ANAMNESIS_AUTH_SECRET / AUTH_SECRET env vars as a source', () => {
    const env = { ANAMNESIS_AUTH_SECRET: 'from-env', AUTH_SECRET: 'also-env' }
    vi.stubEnv('ANAMNESIS_AUTH_SECRET', env.ANAMNESIS_AUTH_SECRET)
    vi.stubEnv('AUTH_SECRET', env.AUTH_SECRET)
    try {
      expect(loadAnamnesisSecret()).toBe('')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  describe('bootstrapAnamnesisSecretFromEnv', () => {
    it('imports the env secret into the store once', () => {
      const imported = bootstrapAnamnesisSecretFromEnv({ ANAMNESIS_AUTH_SECRET: 'from-env' })

      expect(imported).toBe(true)
      expect(loadAnamnesisSecret()).toBe('from-env')
    })

    it('runs once: a later call with a different env value does not overwrite', () => {
      bootstrapAnamnesisSecretFromEnv({ ANAMNESIS_AUTH_SECRET: 'first' })

      const again = bootstrapAnamnesisSecretFromEnv({ ANAMNESIS_AUTH_SECRET: 'second' })

      expect(again).toBe(false)
      expect(loadAnamnesisSecret()).toBe('first')
    })

    it('never overrides a secret saved through the store (Settings UI wins)', () => {
      storeAnamnesisSecret('from-settings-ui')

      const imported = bootstrapAnamnesisSecretFromEnv({ ANAMNESIS_AUTH_SECRET: 'from-env' })

      expect(imported).toBe(false)
      expect(loadAnamnesisSecret()).toBe('from-settings-ui')
    })

    it('does nothing when the env var is unset or blank', () => {
      expect(bootstrapAnamnesisSecretFromEnv({})).toBe(false)
      expect(bootstrapAnamnesisSecretFromEnv({ ANAMNESIS_AUTH_SECRET: '   ' })).toBe(false)
      expect(loadAnamnesisSecret()).toBe('')
    })
  })
})

// C-T5f (RED): S86 — ANAMNESIS_AUTH_SECRET must not stay in the process env after the bootstrap,
// and must never reach an agent PTY / docker exec env.
describe('S86: Anamnesis secret never stays in an agent env', () => {
  beforeEach(() => {
    resetDb()
    getDb(':memory:')
  })

  afterEach(() => {
    closeDb()
  })

  it('removes ANAMNESIS_AUTH_SECRET from the env after importing it', () => {
    const env: Record<string, string | undefined> = { ANAMNESIS_AUTH_SECRET: 'from-env', PATH: '/bin' }

    bootstrapAnamnesisSecretFromEnv(env)

    expect('ANAMNESIS_AUTH_SECRET' in env).toBe(false)
    expect(env.PATH).toBe('/bin')
    expect(loadAnamnesisSecret()).toBe('from-env')
  })

  it('removes ANAMNESIS_AUTH_SECRET from the env even when a stored secret wins', () => {
    storeAnamnesisSecret('from-settings-ui')
    const env: Record<string, string | undefined> = { ANAMNESIS_AUTH_SECRET: 'from-env' }

    bootstrapAnamnesisSecretFromEnv(env)

    expect('ANAMNESIS_AUTH_SECRET' in env).toBe(false)
  })

  it('strips every agent-hidden credential, including ANAMNESIS_AUTH_SECRET, from a spawn env', () => {
    const env = stripAgentSecretEnv({
      ANAMNESIS_AUTH_SECRET: 'a',
      AUTH_SECRET: 'b',
      FORGEJO_TOKEN: 'c',
      FORGEJO_URL: 'd',
      OLLAMA_CLOUD_KEY: 'e',
      OLLAMA_API_KEY: 'f',
      PATH: '/bin',
    })

    expect(env).toEqual({ PATH: '/bin' })
  })

  it('the docker exec env never contains ANAMNESIS_AUTH_SECRET', () => {
    vi.stubEnv('ANAMNESIS_AUTH_SECRET', 'env-secret')
    try {
      const env = buildDockerExecEnv()
      expect(env.ANAMNESIS_AUTH_SECRET).toBeUndefined()
      expect(Object.values(env)).not.toContain('env-secret')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
