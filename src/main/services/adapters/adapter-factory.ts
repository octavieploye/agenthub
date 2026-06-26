// src/main/services/adapters/adapter-factory.ts
import type Database from 'better-sqlite3'
import type { IAnamnesisAdapter } from './anamnesis-adapter'
import type { IForgejoAdapter } from './forgejo-adapter'
import { NullAnamnesisAdapter } from './anamnesis-adapter'
import { NullForgejoAdapter, ForgejoAdapter } from './forgejo-adapter'
import { AnamnesisWriter } from '../anamnesis-writer'

export type AppMode = 'standalone' | 'system'

export function resolveAppMode(): AppMode {
  return process.env['OPTIMAEUS_SYSTEM'] === 'true' ? 'system' : 'standalone'
}

export function createAnamnesisAdapter(
  mode: AppMode,
  db: Database.Database,
  opts: { anamnesisUrl: string; authSecret?: string; fetch?: typeof globalThis.fetch }
): IAnamnesisAdapter {
  if (mode === 'system') {
    return new AnamnesisWriter(db, opts)
  }
  return new NullAnamnesisAdapter()
}

export function createForgejoAdapter(
  mode: AppMode,
  opts: { baseUrl: string; token: string; fetch?: typeof globalThis.fetch }
): IForgejoAdapter {
  if (mode === 'system') {
    return new ForgejoAdapter(opts.baseUrl, opts.token, { fetch: opts.fetch })
  }
  return new NullForgejoAdapter()
}
