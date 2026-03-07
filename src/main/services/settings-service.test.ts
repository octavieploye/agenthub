import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '1.0.0') }
}))

import { SettingsService } from './settings-service'

function createMockDb() {
  const store = new Map<string, string>()

  const mockPrepare = vi.fn((sql: string) => {
    if (sql.includes('SELECT key, value FROM settings')) {
      return {
        all: vi.fn(() =>
          Array.from(store.entries()).map(([key, value]) => ({ key, value }))
        )
      }
    }
    if (sql.includes('SELECT value FROM settings WHERE key')) {
      return {
        get: vi.fn((key: string) => {
          const val = store.get(key)
          return val !== undefined ? { value: val } : undefined
        })
      }
    }
    if (sql.includes('INSERT INTO settings')) {
      return {
        run: vi.fn((key: string, value: string) => {
          store.set(key, value)
        })
      }
    }
    if (sql.includes('DELETE FROM settings')) {
      return {
        run: vi.fn((key: string) => {
          store.delete(key)
        })
      }
    }
    return { run: vi.fn(), get: vi.fn(), all: vi.fn(() => []) }
  })

  return {
    prepare: mockPrepare,
    transaction: vi.fn((fn: (...args: unknown[]) => void) => {
      // better-sqlite3's transaction() returns a new function that wraps
      // the callback in a transaction. We simply return a function that
      // calls the callback directly.
      return (...args: unknown[]) => fn(...args)
    }),
    _store: store
  }
}

describe('SettingsService', () => {
  let svc: SettingsService
  let mockDb: ReturnType<typeof createMockDb>
  const deps = { logInfo: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = createMockDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    svc = new SettingsService(mockDb as any, deps)
  })

  describe('set and get', () => {
    it('stores and retrieves a setting', () => {
      svc.set('theme', 'dark')
      expect(svc.get('theme')).toBe('dark')
    })

    it('returns null for unknown key', () => {
      expect(svc.get('nonexistent')).toBeNull()
    })

    it('overwrites existing value with same key', () => {
      svc.set('theme', 'dark')
      svc.set('theme', 'light')
      expect(svc.get('theme')).toBe('light')
    })

    it('logs when setting is updated', () => {
      svc.set('sound', 'true')
      expect(deps.logInfo).toHaveBeenCalledWith('Setting updated', { key: 'sound' })
    })
  })

  describe('getAll', () => {
    it('returns empty object when no settings', () => {
      expect(svc.getAll()).toEqual({})
    })

    it('returns all settings as key-value pairs', () => {
      svc.set('theme', 'dark')
      svc.set('sound', 'true')

      const all = svc.getAll()
      expect(all.theme).toBe('dark')
      expect(all.sound).toBe('true')
    })

    it('returns correct number of entries', () => {
      svc.set('a', '1')
      svc.set('b', '2')
      svc.set('c', '3')

      const all = svc.getAll()
      expect(Object.keys(all)).toHaveLength(3)
    })
  })

  describe('delete', () => {
    it('removes a setting', () => {
      svc.set('theme', 'dark')
      svc.delete('theme')
      expect(svc.get('theme')).toBeNull()
    })

    it('does not throw for nonexistent key', () => {
      expect(() => svc.delete('nonexistent')).not.toThrow()
    })
  })

  describe('exportSettings', () => {
    it('returns settings export with version and timestamp', () => {
      svc.set('theme', 'ember')

      const exported = svc.exportSettings()
      expect(exported.version).toBe('1.0.0')
      expect(exported.exportedAt).toBeDefined()
      expect(typeof exported.exportedAt).toBe('string')
      expect(exported.settings.theme).toBe('ember')
    })

    it('includes all current settings', () => {
      svc.set('theme', 'matrix')
      svc.set('sound', 'false')
      svc.set('lang', 'en')

      const exported = svc.exportSettings()
      expect(Object.keys(exported.settings)).toHaveLength(3)
    })

    it('returns empty settings when none exist', () => {
      const exported = svc.exportSettings()
      expect(exported.settings).toEqual({})
      expect(exported.version).toBe('1.0.0')
    })

    it('exportedAt is a valid ISO string', () => {
      const exported = svc.exportSettings()
      const parsed = new Date(exported.exportedAt)
      expect(parsed.toISOString()).toBe(exported.exportedAt)
    })
  })

  describe('importSettings', () => {
    it('imports settings from export data', () => {
      svc.importSettings({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        settings: { theme: 'matrix', sound: 'false' }
      })

      expect(svc.get('theme')).toBe('matrix')
      expect(svc.get('sound')).toBe('false')
    })

    it('logs import count', () => {
      svc.importSettings({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        settings: { a: '1', b: '2', c: '3' }
      })

      expect(deps.logInfo).toHaveBeenCalledWith('Settings imported', { count: 3 })
    })

    it('overwrites existing settings on import', () => {
      svc.set('theme', 'dark')

      svc.importSettings({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        settings: { theme: 'light' }
      })

      expect(svc.get('theme')).toBe('light')
    })

    it('uses a transaction for batch import', () => {
      svc.importSettings({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        settings: { x: '1', y: '2' }
      })

      expect(mockDb.transaction).toHaveBeenCalled()
    })

    it('handles empty settings import', () => {
      svc.importSettings({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        settings: {}
      })

      expect(deps.logInfo).toHaveBeenCalledWith('Settings imported', { count: 0 })
      expect(svc.getAll()).toEqual({})
    })
  })
})
