import { describe, it, expect } from 'vitest'
import { runValidation } from './validation-pipeline'
import type { ValidationCheck } from './validation-pipeline'

describe('runValidation', () => {
  it('all-pass returns passed: true with empty failures', () => {
    const checks: ValidationCheck[] = [
      { name: 'check-a', check: () => true },
      { name: 'check-b', check: () => true },
    ]
    const result = runValidation(checks)
    expect(result.passed).toBe(true)
    expect(result.failures).toEqual([])
  })

  it('single failure returns reason', () => {
    const checks: ValidationCheck[] = [
      { name: 'check-a', check: () => 'task not found' },
    ]
    const result = runValidation(checks)
    expect(result.passed).toBe(false)
    expect(result.failures).toEqual(['check-a: task not found'])
  })

  it('multiple failures all collected (no short-circuit)', () => {
    const checks: ValidationCheck[] = [
      { name: 'check-a', check: () => 'reason A' },
      { name: 'check-b', check: () => true },
      { name: 'check-c', check: () => 'reason C' },
    ]
    const result = runValidation(checks)
    expect(result.passed).toBe(false)
    expect(result.failures).toContain('check-a: reason A')
    expect(result.failures).toContain('check-c: reason C')
    expect(result.failures.length).toBe(2)
  })
})
