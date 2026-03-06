import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

import { getDb, closeDb, resetDb } from '../connection'
import {
  getAllClips,
  getClipById,
  insertClip,
  updateClip,
  deleteClip,
  recordClipLaunch
} from './clips.queries'
import type Database from 'better-sqlite3'

describe('Clips Queries', () => {
  let db: Database.Database

  beforeEach(() => {
    resetDb()
    db = getDb(':memory:')
    db.exec(`CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL,
      default_repo_id TEXT,
      launch_count INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
  })

  afterEach(() => {
    closeDb()
  })

  it('returns empty array when no clips exist', () => {
    expect(getAllClips(db)).toEqual([])
  })

  it('inserts and retrieves a clip', () => {
    const clip = insertClip(db, {
      title: 'Fix Auth',
      description: 'Fixes the authentication module',
      prompt: 'Please fix the auth flow in src/auth.ts'
    })

    expect(clip.id).toBeDefined()
    expect(clip.title).toBe('Fix Auth')
    expect(clip.description).toBe('Fixes the authentication module')
    expect(clip.prompt).toBe('Please fix the auth flow in src/auth.ts')
    expect(clip.defaultRepoId).toBeNull()
    expect(clip.launchCount).toBe(0)
    expect(clip.lastUsedAt).toBeNull()
    expect(clip.createdAt).toBeDefined()
  })

  it('retrieves clip by id', () => {
    const inserted = insertClip(db, {
      title: 'Refactor DB',
      description: 'Refactor database layer',
      prompt: 'Refactor the database connection pooling'
    })
    const found = getClipById(db, inserted.id)
    expect(found).not.toBeNull()
    expect(found!.title).toBe('Refactor DB')
  })

  it('returns null for non-existent clip', () => {
    expect(getClipById(db, 'non-existent-id')).toBeNull()
  })

  it('updates clip title', () => {
    const clip = insertClip(db, {
      title: 'Original Title',
      description: 'Some desc',
      prompt: 'Do something'
    })
    const updated = updateClip(db, clip.id, { title: 'Updated Title' })
    expect(updated).not.toBeNull()
    expect(updated!.title).toBe('Updated Title')
    expect(updated!.description).toBe('Some desc')
    expect(updated!.prompt).toBe('Do something')
  })

  it('updates clip prompt', () => {
    const clip = insertClip(db, {
      title: 'My Clip',
      description: 'Desc',
      prompt: 'Original prompt'
    })
    const updated = updateClip(db, clip.id, { prompt: 'New prompt text' })
    expect(updated).not.toBeNull()
    expect(updated!.prompt).toBe('New prompt text')
    expect(updated!.title).toBe('My Clip')
  })

  it('update returns null for non-existent clip', () => {
    const result = updateClip(db, 'does-not-exist', { title: 'No clip here' })
    expect(result).toBeNull()
  })

  it('deletes a clip', () => {
    const clip = insertClip(db, {
      title: 'To Delete',
      description: 'Will be removed',
      prompt: 'Delete me'
    })
    deleteClip(db, clip.id)
    expect(getClipById(db, clip.id)).toBeNull()
  })

  it('recordClipLaunch increments launch_count', () => {
    const clip = insertClip(db, {
      title: 'Launcher',
      description: 'Test launch count',
      prompt: 'Run this'
    })
    expect(clip.launchCount).toBe(0)

    recordClipLaunch(db, clip.id)
    const after = getClipById(db, clip.id)
    expect(after!.launchCount).toBe(1)
  })

  it('recordClipLaunch updates last_used_at', () => {
    const clip = insertClip(db, {
      title: 'Launcher 2',
      description: 'Test last used',
      prompt: 'Run this too'
    })
    expect(clip.lastUsedAt).toBeNull()

    recordClipLaunch(db, clip.id)
    const after = getClipById(db, clip.id)
    expect(after!.lastUsedAt).not.toBeNull()
    expect(after!.lastUsedAt).toBeDefined()
  })

  it('recordClipLaunch on consecutive calls increments correctly', () => {
    const clip = insertClip(db, {
      title: 'Multi Launch',
      description: 'Test multiple launches',
      prompt: 'Run many times'
    })

    recordClipLaunch(db, clip.id)
    recordClipLaunch(db, clip.id)
    recordClipLaunch(db, clip.id)

    const after = getClipById(db, clip.id)
    expect(after!.launchCount).toBe(3)
  })

  it('lists all clips (multiple)', () => {
    insertClip(db, {
      title: 'Clip A',
      description: 'First clip',
      prompt: 'Prompt A'
    })
    insertClip(db, {
      title: 'Clip B',
      description: 'Second clip',
      prompt: 'Prompt B'
    })
    insertClip(db, {
      title: 'Clip C',
      description: 'Third clip',
      prompt: 'Prompt C'
    })

    const all = getAllClips(db)
    expect(all).toHaveLength(3)
    const titles = all.map((c) => c.title)
    expect(titles).toContain('Clip A')
    expect(titles).toContain('Clip B')
    expect(titles).toContain('Clip C')
  })
})
