import { describe, it, expect } from 'vitest'
import { getPhaseProfile, shouldSkipSecurity, shouldLoopBack } from './phase-profile'

describe('getPhaseProfile', () => {
  it('returns full-loop for null category', () => {
    const p = getPhaseProfile(null)
    expect(p.type).toBe('full-loop')
    expect(p.runSecurity).toBe(true)
    expect(p.loopBack).toBe(true)
    expect(p.maxSecurityCycles).toBe(3)
  })

  it('returns full-loop for backend category', () => {
    expect(getPhaseProfile('backend').type).toBe('full-loop')
  })

  it('returns full-loop for frontend category', () => {
    expect(getPhaseProfile('frontend').type).toBe('full-loop')
  })

  it('returns full-loop for unknown category', () => {
    expect(getPhaseProfile('something-new').type).toBe('full-loop')
  })

  it('returns skip-security for design category', () => {
    const p = getPhaseProfile('design')
    expect(p.type).toBe('skip-security')
    expect(p.runSecurity).toBe(false)
    expect(p.loopBack).toBe(false)
  })

  it('returns skip-security for ui category', () => {
    expect(getPhaseProfile('ui').type).toBe('skip-security')
  })

  it('returns skip-security for style category', () => {
    expect(getPhaseProfile('style').type).toBe('skip-security')
  })

  it('returns skip-security for marketing category', () => {
    expect(getPhaseProfile('marketing').type).toBe('skip-security')
  })

  it('returns skip-security for content category', () => {
    expect(getPhaseProfile('content').type).toBe('skip-security')
  })

  it('returns security-once for refactor category', () => {
    const p = getPhaseProfile('refactor')
    expect(p.type).toBe('security-once')
    expect(p.runSecurity).toBe(true)
    expect(p.loopBack).toBe(false)
    expect(p.maxSecurityCycles).toBe(1)
  })

  it('returns security-once for chore category', () => {
    expect(getPhaseProfile('chore').type).toBe('security-once')
  })

  it('returns security-once for perf category', () => {
    expect(getPhaseProfile('perf').type).toBe('security-once')
  })

  it('returns security-once for test category', () => {
    expect(getPhaseProfile('test').type).toBe('security-once')
  })

  it('handles case-insensitive categories', () => {
    expect(getPhaseProfile('Design').type).toBe('skip-security')
    expect(getPhaseProfile('REFACTOR').type).toBe('security-once')
    expect(getPhaseProfile('Backend').type).toBe('full-loop')
  })
})

describe('shouldSkipSecurity', () => {
  it('returns true for skip-security profile', () => {
    expect(shouldSkipSecurity(getPhaseProfile('design'))).toBe(true)
  })

  it('returns false for full-loop profile', () => {
    expect(shouldSkipSecurity(getPhaseProfile('backend'))).toBe(false)
  })

  it('returns false for security-once profile', () => {
    expect(shouldSkipSecurity(getPhaseProfile('refactor'))).toBe(false)
  })
})

describe('shouldLoopBack', () => {
  it('returns true for full-loop within cycle limit', () => {
    expect(shouldLoopBack(getPhaseProfile('backend'), 0)).toBe(true)
    expect(shouldLoopBack(getPhaseProfile('backend'), 1)).toBe(true)
    expect(shouldLoopBack(getPhaseProfile('backend'), 2)).toBe(true)
  })

  it('returns false for full-loop at max cycles', () => {
    expect(shouldLoopBack(getPhaseProfile('backend'), 3)).toBe(false)
  })

  it('returns false for security-once regardless of cycle', () => {
    expect(shouldLoopBack(getPhaseProfile('refactor'), 0)).toBe(false)
  })

  it('returns false for skip-security regardless of cycle', () => {
    expect(shouldLoopBack(getPhaseProfile('design'), 0)).toBe(false)
  })
})
