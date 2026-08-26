import { describe, it, expect } from 'vitest'
import { checkCodexHealth, type CodexHealthStatus } from './codex-health'

describe('checkCodexHealth', () => {
  it('returns a valid CodexHealthStatus object', async () => {
    const result: CodexHealthStatus = await checkCodexHealth()
    expect(typeof result.installed).toBe('boolean')
    expect(typeof result.authenticated).toBe('boolean')
    if (result.version !== undefined) {
      expect(typeof result.version).toBe('string')
    }
  })

  it('version is undefined when installed is false', async () => {
    const result = await checkCodexHealth()
    if (!result.installed) {
      expect(result.version).toBeUndefined()
    }
    // When installed is true, version may still be undefined if --version fails
    // (e.g. broken binary, missing vendor files). This is expected.
  })

  it('authenticated is false when installed is false', async () => {
    const result = await checkCodexHealth()
    if (!result.installed) {
      expect(result.authenticated).toBe(false)
    }
  })
})
