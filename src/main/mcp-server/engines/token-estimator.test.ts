import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { estimateTokens } from './token-estimator'

// ─── Algorithm constants (must mirror engine) ─────────────────────────────────
const SYSTEM_CONTEXT_TOKENS = 4900
const MISSING_FILE_TOKENS = 500
const MISSING_SKILL_TOKENS = 300
const RESPONSE_OVERHEAD_RATE = 0.30
const SAFETY_MARGIN_RATE = 0.15
// Files strictly larger than this use stat().size instead of reading content
const LARGE_FILE_THRESHOLD = 1_000_000

/**
 * The engine applies both overhead and margin to the same content subtotal
 * (steps 1-4), not in a cascading fashion.
 *
 *   contentTotal = desc + files + skills + systemContext
 *   responseOverhead = ceil(contentTotal × 0.30)
 *   safetyMargin    = ceil(contentTotal × 0.15)
 *   estimatedTokens  = contentTotal + responseOverhead + safetyMargin
 */
function expectedTotals(contentTotal: number): {
  responseOverhead: number
  safetyMargin: number
  estimatedTokens: number
} {
  const responseOverhead = Math.ceil(contentTotal * RESPONSE_OVERHEAD_RATE)
  const safetyMargin = Math.ceil(contentTotal * SAFETY_MARGIN_RATE)
  return { responseOverhead, safetyMargin, estimatedTokens: contentTotal + responseOverhead + safetyMargin }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-est-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true })
})

// ─── Known string lengths ─────────────────────────────────────────────────────

describe('task description tokenisation', () => {
  it('converts description chars to tokens as ceil(chars / 4)', () => {
    // 100 chars ÷ 4 = exactly 25 tokens (no ceil rounding needed)
    const description = 'A'.repeat(100)
    const result = estimateTokens({ description })

    const contentTotal = 25 + SYSTEM_CONTEXT_TOKENS // 4925
    const { responseOverhead, safetyMargin, estimatedTokens } = expectedTotals(contentTotal)
    // responseOverhead = ceil(4925 × 0.30) = ceil(1477.5) = 1478
    // safetyMargin     = ceil(4925 × 0.15) = ceil(738.75) = 739
    // estimatedTokens  = 4925 + 1478 + 739 = 7142

    expect(result.breakdown.taskDescription).toBe(25)
    expect(result.breakdown.responseOverhead).toBe(responseOverhead)
    expect(result.breakdown.safetyMargin).toBe(safetyMargin)
    expect(result.estimatedTokens).toBe(estimatedTokens)
  })

  it('applies ceil when char count is not divisible by 4', () => {
    // 101 chars → ceil(101 / 4) = ceil(25.25) = 26
    const result = estimateTokens({ description: 'A'.repeat(101) })
    expect(result.breakdown.taskDescription).toBe(26)
  })

  it('returns 0 description tokens for empty string', () => {
    const result = estimateTokens({ description: '' })
    expect(result.breakdown.taskDescription).toBe(0)
  })
})

// ─── 4900 fixed system context overhead ──────────────────────────────────────

describe('system context overhead', () => {
  it('always includes exactly 4900 system context tokens', () => {
    const result = estimateTokens({ description: '' })
    expect(result.breakdown.systemContext).toBe(4900)
  })

  it('includes system context even when all other inputs are empty', () => {
    const result = estimateTokens({ description: '', targetFiles: [], skills: [] })
    expect(result.breakdown.systemContext).toBe(SYSTEM_CONTEXT_TOKENS)
  })
})

// ─── 15% safety margin ───────────────────────────────────────────────────────

describe('safety margin', () => {
  it('is ceil(contentTotal × 0.15) where contentTotal = desc + files + skills + systemContext', () => {
    // 400 chars → 100 tokens (exact divisor, no ceil needed)
    const description = 'X'.repeat(400)
    const result = estimateTokens({ description })

    const contentTotal = 100 + SYSTEM_CONTEXT_TOKENS // 5000
    // safetyMargin = ceil(5000 × 0.15) = ceil(750) = 750
    // responseOverhead = ceil(5000 × 0.30) = ceil(1500) = 1500
    // estimatedTokens = 5000 + 1500 + 750 = 7250
    const { safetyMargin, estimatedTokens } = expectedTotals(contentTotal)

    expect(result.breakdown.safetyMargin).toBe(safetyMargin) // 750
    expect(result.estimatedTokens).toBe(estimatedTokens)      // 7250
  })

  it('rounds up (ceil) when the margin is not a whole number', () => {
    // contentTotal = 4925 → safetyMargin = ceil(4925 × 0.15) = ceil(738.75) = 739 not 738
    const result = estimateTokens({ description: 'A'.repeat(100) })
    expect(result.breakdown.safetyMargin).toBe(739)
  })

  it('response overhead is ceil(contentTotal × 0.30)', () => {
    // contentTotal = 4925 → responseOverhead = ceil(4925 × 0.30) = ceil(1477.5) = 1478
    const result = estimateTokens({ description: 'A'.repeat(100) })
    expect(result.breakdown.responseOverhead).toBe(1478)
  })
})

// ─── Target files: known content ─────────────────────────────────────────────

describe('target file tokenisation', () => {
  it('reads file content and converts chars to tokens as ceil(chars / 4)', () => {
    // 200 chars → 50 tokens (exact)
    const filePath = path.join(tmpDir, 'task.ts')
    fs.writeFileSync(filePath, 'B'.repeat(200), 'utf8')

    const result = estimateTokens({ description: '', targetFiles: [filePath] })

    expect(result.breakdown.targetFiles).toBe(50)
    expect(result.warnings).toEqual([])
  })

  it('sums tokens across multiple files', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.ts'), 'A'.repeat(80), 'utf8')  // 20 tokens
    fs.writeFileSync(path.join(tmpDir, 'b.ts'), 'B'.repeat(120), 'utf8') // 30 tokens

    const result = estimateTokens({
      description: '',
      targetFiles: [
        path.join(tmpDir, 'a.ts'),
        path.join(tmpDir, 'b.ts'),
      ]
    })

    expect(result.breakdown.targetFiles).toBe(50)
  })

  it('includes file tokens in estimatedTokens', () => {
    const filePath = path.join(tmpDir, 'src.ts')
    fs.writeFileSync(filePath, 'C'.repeat(400), 'utf8') // 100 tokens

    const result = estimateTokens({ description: '', targetFiles: [filePath] })
    const contentTotal = 0 + 100 + 0 + SYSTEM_CONTEXT_TOKENS // 5000
    const { estimatedTokens } = expectedTotals(contentTotal)
    expect(result.estimatedTokens).toBe(estimatedTokens)
  })
})

// ─── Missing file fallback (500 tokens) ──────────────────────────────────────

describe('missing file fallback', () => {
  it('uses 500 token fallback when file does not exist', () => {
    const missingPath = path.join(tmpDir, 'does-not-exist.ts')
    const result = estimateTokens({ description: '', targetFiles: [missingPath] })

    expect(result.breakdown.targetFiles).toBe(MISSING_FILE_TOKENS)
  })

  it('adds a warning that includes the missing file path', () => {
    const missingPath = path.join(tmpDir, 'does-not-exist.ts')
    const result = estimateTokens({ description: '', targetFiles: [missingPath] })

    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings.some(w => w.includes('does-not-exist.ts'))).toBe(true)
  })

  it('accumulates 500 tokens per missing file', () => {
    const missing1 = path.join(tmpDir, 'missing1.ts')
    const missing2 = path.join(tmpDir, 'missing2.ts')
    const result = estimateTokens({ description: '', targetFiles: [missing1, missing2] })

    expect(result.breakdown.targetFiles).toBe(MISSING_FILE_TOKENS * 2) // 1000
    expect(result.warnings.length).toBe(2)
  })

  it('mixes found file tokens and fallback tokens correctly', () => {
    const foundFile = path.join(tmpDir, 'found.ts')
    fs.writeFileSync(foundFile, 'A'.repeat(80), 'utf8') // 20 tokens
    const missingFile = path.join(tmpDir, 'missing.ts')

    const result = estimateTokens({
      description: '',
      targetFiles: [foundFile, missingFile]
    })

    // 20 (found) + 500 (fallback) = 520
    expect(result.breakdown.targetFiles).toBe(520)
    expect(result.warnings.length).toBe(1)
  })
})

// ─── >1MB stat-only path ─────────────────────────────────────────────────────

describe('>1MB file stat-only path', () => {
  it('uses ceil(stat().size / 4) for files larger than threshold without reading content', () => {
    const bigFile = path.join(tmpDir, 'large.ts')
    const size = LARGE_FILE_THRESHOLD + 1 // 1,000,001 bytes
    fs.writeFileSync(bigFile, Buffer.alloc(size, 0x58)) // fill with 'X'

    const result = estimateTokens({ description: '', targetFiles: [bigFile] })

    const expectedFileTokens = Math.ceil(size / 4) // ceil(1000001 / 4) = 250001
    expect(result.breakdown.targetFiles).toBe(expectedFileTokens)
  })

  it('does not add a warning for large files (they resolved via stat)', () => {
    const bigFile = path.join(tmpDir, 'big.ts')
    fs.writeFileSync(bigFile, Buffer.alloc(LARGE_FILE_THRESHOLD + 100, 0x41))

    const result = estimateTokens({ description: '', targetFiles: [bigFile] })

    expect(result.warnings.filter(w => w.includes('big.ts'))).toHaveLength(0)
  })
})

// ─── Mixed confidence levels ──────────────────────────────────────────────────

describe('confidence levels', () => {
  it('returns high when there are no target files or skills (all vacuously resolved)', () => {
    const result = estimateTokens({ description: 'simple task' })
    expect(result.confidence).toBe('high')
  })

  it('returns high when all target files resolve', () => {
    const f1 = path.join(tmpDir, 'f1.ts')
    const f2 = path.join(tmpDir, 'f2.ts')
    fs.writeFileSync(f1, 'content', 'utf8')
    fs.writeFileSync(f2, 'content', 'utf8')

    const result = estimateTokens({ description: '', targetFiles: [f1, f2] })
    expect(result.confidence).toBe('high')
  })

  it('returns low when fewer than 50% of target files resolve', () => {
    const found = path.join(tmpDir, 'found.ts')
    fs.writeFileSync(found, 'content', 'utf8')
    // 1 of 4 = 25% → low
    const result = estimateTokens({
      description: '',
      targetFiles: [
        found,
        path.join(tmpDir, 'missing1.ts'),
        path.join(tmpDir, 'missing2.ts'),
        path.join(tmpDir, 'missing3.ts'),
      ]
    })
    expect(result.confidence).toBe('low')
  })

  it('returns medium when more than 50% but not all target files resolve', () => {
    const f1 = path.join(tmpDir, 'f1.ts')
    const f2 = path.join(tmpDir, 'f2.ts')
    fs.writeFileSync(f1, 'content', 'utf8')
    fs.writeFileSync(f2, 'content', 'utf8')
    // 2 of 3 = 67% → medium
    const result = estimateTokens({
      description: '',
      targetFiles: [f1, f2, path.join(tmpDir, 'missing.ts')]
    })
    expect(result.confidence).toBe('medium')
  })
})

// ─── Skill resolution ─────────────────────────────────────────────────────────

describe('skill resolution', () => {
  it('reads SKILL.md and converts chars to tokens as ceil(chars / 4)', () => {
    // Skills are passed as directory paths; engine appends /SKILL.md
    const skillDir = path.join(tmpDir, 'my-test-skill')
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'S'.repeat(200)) // 50 tokens

    const result = estimateTokens({ description: '', skills: [skillDir] })

    expect(result.breakdown.skills).toBe(50)
    expect(result.warnings).toHaveLength(0)
  })

  it('accepts a direct SKILL.md path', () => {
    const skillFile = path.join(tmpDir, 'SKILL.md')
    fs.writeFileSync(skillFile, 'M'.repeat(400)) // 100 tokens

    const result = estimateTokens({ description: '', skills: [skillFile] })

    expect(result.breakdown.skills).toBe(100)
    expect(result.warnings).toHaveLength(0)
  })

  it('uses 300 token fallback for a missing skill and adds warning', () => {
    const missingSkillDir = path.join(tmpDir, 'nonexistent-skill')

    const result = estimateTokens({ description: '', skills: [missingSkillDir] })

    expect(result.breakdown.skills).toBe(MISSING_SKILL_TOKENS) // 300
    expect(result.warnings.some(w => w.includes('nonexistent-skill'))).toBe(true)
  })

  it('accumulates 300 tokens per missing skill', () => {
    const result = estimateTokens({
      description: '',
      skills: [
        path.join(tmpDir, 'missing-a'),
        path.join(tmpDir, 'missing-b'),
      ]
    })

    expect(result.breakdown.skills).toBe(MISSING_SKILL_TOKENS * 2) // 600
    expect(result.warnings.length).toBe(2)
  })
})

// ─── Breakdown shape + internal consistency ───────────────────────────────────

describe('result shape', () => {
  it('returns all required breakdown fields', () => {
    const result = estimateTokens({ description: 'test' })
    expect(result.breakdown).toMatchObject({
      taskDescription: expect.any(Number),
      targetFiles: expect.any(Number),
      skills: expect.any(Number),
      systemContext: expect.any(Number),
      responseOverhead: expect.any(Number),
      safetyMargin: expect.any(Number),
    })
  })

  it('estimatedTokens equals the sum of all breakdown fields', () => {
    const filePath = path.join(tmpDir, 'x.ts')
    fs.writeFileSync(filePath, 'A'.repeat(40), 'utf8')

    const result = estimateTokens({ description: 'hello', targetFiles: [filePath] })
    const { taskDescription, targetFiles, skills, systemContext, responseOverhead, safetyMargin } = result.breakdown
    const breakdownSum = taskDescription + targetFiles + skills + systemContext + responseOverhead + safetyMargin
    expect(result.estimatedTokens).toBe(breakdownSum)
  })

  it('returns a positive integer for estimatedTokens', () => {
    const result = estimateTokens({ description: 'test' })
    expect(result.estimatedTokens).toBeGreaterThan(0)
    expect(Number.isInteger(result.estimatedTokens)).toBe(true)
  })

  it('returns warnings as an empty array when everything resolves', () => {
    const result = estimateTokens({ description: 'test' })
    expect(Array.isArray(result.warnings)).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })

  it('returns one of the three confidence values', () => {
    const result = estimateTokens({ description: 'test' })
    expect(['high', 'medium', 'low']).toContain(result.confidence)
  })
})
