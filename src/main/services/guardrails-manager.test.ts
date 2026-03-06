import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GuardrailsManager, type GuardrailsManagerDeps } from './guardrails-manager'
import { DEFAULT_GUARDRAILS, type GuardrailConfig } from '@shared/types/config.types'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

// ── helpers ──────────────────────────────────────────────────────────

const VALID_YAML = [
  'maxDurationMinutes: 45',
  'maxFilesChanged: 15',
  'maxConsecutiveErrors: 3',
  'maxTokensPerSession: 50000',
  'protectedPaths:',
  '  - node_modules',
  '  - .env'
].join('\n')

const PARTIAL_YAML = [
  'maxDurationMinutes: 60',
  'maxFilesChanged: 10'
].join('\n')

const INVALID_YAML = ':::not valid yaml at all{{{]]]'

const NEGATIVE_VALUES_YAML = [
  'maxDurationMinutes: -5',
  'maxFilesChanged: -1',
  'maxConsecutiveErrors: 0',
  'maxTokensPerSession: -100',
  'protectedPaths: []'
].join('\n')

const EXCESSIVE_VALUES_YAML = [
  'maxDurationMinutes: 9999',
  'maxFilesChanged: 500',
  'maxConsecutiveErrors: 100',
  'maxTokensPerSession: 99999999',
  'protectedPaths: []'
].join('\n')

function createDeps(overrides: Partial<GuardrailsManagerDeps> = {}): GuardrailsManagerDeps {
  return {
    readFile: vi.fn().mockReturnValue(null),
    writeFile: vi.fn(),
    logInfo: vi.fn(),
    ...overrides
  }
}

// ── tests ────────────────────────────────────────────────────────────

describe('GuardrailsManager', () => {
  let deps: GuardrailsManagerDeps
  let manager: GuardrailsManager

  beforeEach(() => {
    deps = createDeps()
    manager = new GuardrailsManager(deps)
  })

  // ─── loadGuardrails ──────────────────────────────────────────────

  describe('loadGuardrails', () => {
    it('returns defaults when no .agenthub.yaml exists', () => {
      // readFile returns null (file not found)
      const result = manager.loadGuardrails('/repos/my-project')
      expect(result).toEqual(DEFAULT_GUARDRAILS)
    })

    it('parses valid YAML file', () => {
      ;(deps.readFile as ReturnType<typeof vi.fn>).mockReturnValue(VALID_YAML)

      const result = manager.loadGuardrails('/repos/my-project')

      expect(result.maxDurationMinutes).toBe(45)
      expect(result.maxFilesChanged).toBe(15)
      expect(result.maxConsecutiveErrors).toBe(3)
      expect(result.maxTokensPerSession).toBe(50000)
      expect(result.protectedPaths).toEqual(['node_modules', '.env'])
    })

    it('returns defaults for invalid YAML', () => {
      ;(deps.readFile as ReturnType<typeof vi.fn>).mockReturnValue(INVALID_YAML)

      const result = manager.loadGuardrails('/repos/my-project')
      expect(result).toEqual(DEFAULT_GUARDRAILS)
    })

    it('merges partial config with defaults (missing fields get defaults)', () => {
      ;(deps.readFile as ReturnType<typeof vi.fn>).mockReturnValue(PARTIAL_YAML)

      const result = manager.loadGuardrails('/repos/my-project')

      // Overridden from YAML
      expect(result.maxDurationMinutes).toBe(60)
      expect(result.maxFilesChanged).toBe(10)
      // Defaults for missing fields
      expect(result.maxConsecutiveErrors).toBe(DEFAULT_GUARDRAILS.maxConsecutiveErrors)
      expect(result.maxTokensPerSession).toBe(DEFAULT_GUARDRAILS.maxTokensPerSession)
      expect(result.protectedPaths).toEqual(DEFAULT_GUARDRAILS.protectedPaths)
    })

    it('reads from correct path ({repoPath}/.agenthub.yaml)', () => {
      manager.loadGuardrails('/repos/my-project')

      expect(deps.readFile).toHaveBeenCalledWith('/repos/my-project/.agenthub.yaml')
    })

    it('validates config values (rejects negative numbers)', () => {
      ;(deps.readFile as ReturnType<typeof vi.fn>).mockReturnValue(NEGATIVE_VALUES_YAML)

      const result = manager.loadGuardrails('/repos/my-project')

      // Negative/zero values should fall back to defaults
      expect(result.maxDurationMinutes).toBe(DEFAULT_GUARDRAILS.maxDurationMinutes)
      expect(result.maxFilesChanged).toBe(DEFAULT_GUARDRAILS.maxFilesChanged)
      expect(result.maxConsecutiveErrors).toBe(DEFAULT_GUARDRAILS.maxConsecutiveErrors)
      expect(result.maxTokensPerSession).toBe(DEFAULT_GUARDRAILS.maxTokensPerSession)
    })

    it('clamps unreasonable values (e.g., maxDurationMinutes > 480 gets clamped to 480)', () => {
      ;(deps.readFile as ReturnType<typeof vi.fn>).mockReturnValue(EXCESSIVE_VALUES_YAML)

      const result = manager.loadGuardrails('/repos/my-project')

      expect(result.maxDurationMinutes).toBeLessThanOrEqual(480)
    })
  })

  // ─── saveGuardrails ──────────────────────────────────────────────

  describe('saveGuardrails', () => {
    it('writes YAML to correct path', () => {
      const config: GuardrailConfig = {
        maxDurationMinutes: 45,
        maxFilesChanged: 15,
        maxConsecutiveErrors: 3,
        maxTokensPerSession: 50000,
        protectedPaths: ['node_modules']
      }

      manager.saveGuardrails('/repos/my-project', config)

      expect(deps.writeFile).toHaveBeenCalledWith(
        '/repos/my-project/.agenthub.yaml',
        expect.any(String)
      )
    })

    it('written content is valid YAML that can be re-parsed', () => {
      const config: GuardrailConfig = {
        maxDurationMinutes: 45,
        maxFilesChanged: 15,
        maxConsecutiveErrors: 3,
        maxTokensPerSession: 50000,
        protectedPaths: ['node_modules', '.env']
      }

      manager.saveGuardrails('/repos/my-project', config)

      // Capture what was written
      const writtenContent = (deps.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string

      // Now create a new manager that reads the written content back
      const deps2 = createDeps({
        readFile: vi.fn().mockReturnValue(writtenContent)
      })
      const manager2 = new GuardrailsManager(deps2)
      const reparsed = manager2.loadGuardrails('/repos/my-project')

      expect(reparsed).toEqual(config)
    })
  })

  // ─── getGuardrails ───────────────────────────────────────────────

  describe('getGuardrails', () => {
    it('caches the config after first load', () => {
      ;(deps.readFile as ReturnType<typeof vi.fn>).mockReturnValue(VALID_YAML)

      const result1 = manager.getGuardrails('/repos/my-project')
      const result2 = manager.getGuardrails('/repos/my-project')

      expect(result1).toEqual(result2)
    })

    it('returns cached config on subsequent calls without re-reading', () => {
      ;(deps.readFile as ReturnType<typeof vi.fn>).mockReturnValue(VALID_YAML)

      manager.getGuardrails('/repos/my-project')
      manager.getGuardrails('/repos/my-project')
      manager.getGuardrails('/repos/my-project')

      // readFile should only have been called once (first load)
      expect(deps.readFile).toHaveBeenCalledTimes(1)
    })
  })

  // ─── updateGuardrail ─────────────────────────────────────────────

  describe('updateGuardrail', () => {
    beforeEach(() => {
      ;(deps.readFile as ReturnType<typeof vi.fn>).mockReturnValue(VALID_YAML)
      // Pre-load guardrails so we have a baseline
      manager.getGuardrails('/repos/my-project')
    })

    it('updates a single numeric field', () => {
      const result = manager.updateGuardrail('/repos/my-project', 'maxDurationMinutes', 90)

      expect(result.maxDurationMinutes).toBe(90)
      // Other fields unchanged
      expect(result.maxFilesChanged).toBe(15)
      expect(result.maxConsecutiveErrors).toBe(3)
    })

    it('updates protectedPaths array', () => {
      const newPaths = ['dist/', '.env', 'secrets/']
      const result = manager.updateGuardrail('/repos/my-project', 'protectedPaths', newPaths)

      expect(result.protectedPaths).toEqual(['dist/', '.env', 'secrets/'])
    })

    it('saves after update', () => {
      manager.updateGuardrail('/repos/my-project', 'maxFilesChanged', 50)

      expect(deps.writeFile).toHaveBeenCalledWith(
        '/repos/my-project/.agenthub.yaml',
        expect.any(String)
      )
    })

    it('returns the updated config', () => {
      const result = manager.updateGuardrail('/repos/my-project', 'maxTokensPerSession', 200000)

      expect(result.maxTokensPerSession).toBe(200000)
      // Verify it is a full GuardrailConfig
      expect(result.maxDurationMinutes).toBeDefined()
      expect(result.maxFilesChanged).toBeDefined()
      expect(result.maxConsecutiveErrors).toBeDefined()
      expect(result.protectedPaths).toBeDefined()
    })
  })

  // ─── resetGuardrails ─────────────────────────────────────────────

  describe('resetGuardrails', () => {
    beforeEach(() => {
      ;(deps.readFile as ReturnType<typeof vi.fn>).mockReturnValue(VALID_YAML)
      manager.getGuardrails('/repos/my-project')
    })

    it('returns DEFAULT_GUARDRAILS', () => {
      const result = manager.resetGuardrails('/repos/my-project')
      expect(result).toEqual(DEFAULT_GUARDRAILS)
    })

    it('saves defaults to disk', () => {
      manager.resetGuardrails('/repos/my-project')

      expect(deps.writeFile).toHaveBeenCalledWith(
        '/repos/my-project/.agenthub.yaml',
        expect.any(String)
      )
    })

    it('clears cache so next getGuardrails re-reads from disk', () => {
      manager.resetGuardrails('/repos/my-project')

      // Clear the readFile mock call count
      ;(deps.readFile as ReturnType<typeof vi.fn>).mockClear()
      ;(deps.readFile as ReturnType<typeof vi.fn>).mockReturnValue(null)

      // Next getGuardrails should read from disk again (cache was cleared)
      manager.getGuardrails('/repos/my-project')
      expect(deps.readFile).toHaveBeenCalledTimes(1)
    })
  })
})
