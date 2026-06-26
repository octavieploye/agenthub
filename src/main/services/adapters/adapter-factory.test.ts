// src/main/services/adapters/adapter-factory.test.ts
import { it, expect, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../db/migration-runner'
import { resolveAppMode, createAnamnesisAdapter, createForgejoAdapter } from './adapter-factory'
import { NullAnamnesisAdapter } from './anamnesis-adapter'
import { NullForgejoAdapter, ForgejoAdapter } from './forgejo-adapter'
import { AnamnesisWriter } from '../anamnesis-writer'

afterEach(() => {
  delete process.env['OPTIMAEUS_SYSTEM']
})

it('resolveAppMode returns standalone when OPTIMAEUS_SYSTEM is unset', () => {
  delete process.env['OPTIMAEUS_SYSTEM']
  expect(resolveAppMode()).toBe('standalone')
})

it('resolveAppMode returns standalone when OPTIMAEUS_SYSTEM is empty string', () => {
  process.env['OPTIMAEUS_SYSTEM'] = ''
  expect(resolveAppMode()).toBe('standalone')
})

it('resolveAppMode returns system when OPTIMAEUS_SYSTEM=true', () => {
  process.env['OPTIMAEUS_SYSTEM'] = 'true'
  expect(resolveAppMode()).toBe('system')
})

it('createAnamnesisAdapter returns NullAnamnesisAdapter in standalone mode', () => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, __dirname + '/../../db/migrations')
  const adapter = createAnamnesisAdapter('standalone', db, { anamnesisUrl: 'http://localhost:9300' })
  expect(adapter).toBeInstanceOf(NullAnamnesisAdapter)
  db.close()
})

it('createAnamnesisAdapter returns AnamnesisWriter in system mode', () => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, __dirname + '/../../db/migrations')
  const adapter = createAnamnesisAdapter('system', db, { anamnesisUrl: 'http://localhost:9300' })
  expect(adapter).toBeInstanceOf(AnamnesisWriter)
  db.close()
})

it('createForgejoAdapter returns NullForgejoAdapter in standalone mode', () => {
  const adapter = createForgejoAdapter('standalone', { baseUrl: 'http://forgejo.local:3000', token: 'tok' })
  expect(adapter).toBeInstanceOf(NullForgejoAdapter)
})

it('createForgejoAdapter returns ForgejoAdapter in system mode', () => {
  const adapter = createForgejoAdapter('system', { baseUrl: 'http://forgejo.local:3000', token: 'tok' })
  expect(adapter).toBeInstanceOf(ForgejoAdapter)
})

it('createForgejoAdapter in system mode forwards fetch dep to ForgejoAdapter', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
  const adapter = createForgejoAdapter('system', { baseUrl: 'http://forgejo.local:3000', token: 'tok', fetch: fetchMock })
  expect(await adapter.isAvailable()).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
