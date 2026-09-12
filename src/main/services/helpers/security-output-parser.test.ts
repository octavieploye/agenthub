import { describe, it, expect } from 'vitest'
import { parseSecurityOutput } from './security-output-parser'

describe('parseSecurityOutput', () => {
  it('returns review recommendation for null input', () => {
    const result = parseSecurityOutput(null)
    expect(result.recommendation).toBe('review')
    expect(result.findings).toEqual([])
    expect(result.hasCritical).toBe(false)
  })

  it('returns review recommendation for empty string', () => {
    const result = parseSecurityOutput('')
    expect(result.recommendation).toBe('review')
  })

  it('parses valid JSON with pass recommendation', () => {
    const output = '{ "findings": [], "recommendation": "pass" }'
    const result = parseSecurityOutput(output)
    expect(result.recommendation).toBe('pass')
    expect(result.findings).toEqual([])
    expect(result.hasCritical).toBe(false)
  })

  it('parses valid JSON with block recommendation and critical finding', () => {
    const output = JSON.stringify({
      findings: [
        { severity: 'critical', category: 'injection', description: 'SQL injection in query builder', file: 'src/db.ts', line: 42 },
      ],
      recommendation: 'block',
    })
    const result = parseSecurityOutput(output)
    expect(result.recommendation).toBe('block')
    expect(result.findings).toHaveLength(1)
    expect(result.hasCritical).toBe(true)
    expect(result.findings[0].severity).toBe('critical')
    expect(result.findings[0].file).toBe('src/db.ts')
    expect(result.findings[0].line).toBe(42)
  })

  it('detects high severity findings', () => {
    const output = JSON.stringify({
      findings: [
        { severity: 'high', category: 'auth', description: 'Missing auth check' },
        { severity: 'low', category: 'style', description: 'Unused import' },
      ],
      recommendation: 'review',
    })
    const result = parseSecurityOutput(output)
    expect(result.hasHigh).toBe(true)
    expect(result.hasCritical).toBe(false)
    expect(result.findings).toHaveLength(2)
  })

  it('extracts JSON from text with surrounding prose', () => {
    const output = `
Hey! I've completed the security scan. Here are my findings:

\`\`\`json
{ "findings": [{ "severity": "medium", "category": "tech-debt", "description": "Hardcoded value" }], "recommendation": "pass" }
\`\`\`

Let me know if you need anything else.
`
    const result = parseSecurityOutput(output)
    expect(result.recommendation).toBe('pass')
    expect(result.findings).toHaveLength(1)
  })

  it('defaults invalid severity to medium', () => {
    const output = JSON.stringify({
      findings: [{ severity: 'EXTREME', category: 'test', description: 'Bad severity' }],
      recommendation: 'pass',
    })
    const result = parseSecurityOutput(output)
    expect(result.findings[0].severity).toBe('medium')
  })

  it('defaults invalid recommendation to review', () => {
    const output = JSON.stringify({
      findings: [],
      recommendation: 'approve',
    })
    const result = parseSecurityOutput(output)
    expect(result.recommendation).toBe('review')
  })

  it('skips findings with no description', () => {
    const output = JSON.stringify({
      findings: [
        { severity: 'low', category: 'test', description: '' },
        { severity: 'low', category: 'test', description: 'Valid finding' },
      ],
      recommendation: 'pass',
    })
    const result = parseSecurityOutput(output)
    expect(result.findings).toHaveLength(1)
  })

  it('handles malformed JSON gracefully', () => {
    const result = parseSecurityOutput('this is not json at all')
    expect(result.recommendation).toBe('review')
    expect(result.findings).toEqual([])
  })

  it('uses last JSON object when multiple exist in output', () => {
    const output = `
Some earlier JSON: {"status": "processing"}
Final result: {"findings": [], "recommendation": "pass"}
`
    const result = parseSecurityOutput(output)
    expect(result.recommendation).toBe('pass')
  })

  it('preserves raw output in result', () => {
    const output = 'raw agent output'
    const result = parseSecurityOutput(output)
    expect(result.raw).toBe('raw agent output')
  })
})
