import { describe, it, expect } from 'vitest'
import { classifyTask } from './skill-classifier'
import type { SkillItem } from '../../shared/types/skills.types'

// ─── Test skill fixtures ───────────────────────────────────────────────────

const devSkill: SkillItem = {
  id: 'team-dev-loop',
  name: 'Team Dev Loop',
  description: 'General code development team workflow',
  category: 'teams',
  path: '/skills/team-dev-loop',
  source: 'team',
  origin: 'agenthub',
  manifest: {
    version: 1,
    domain: 'code-dev',
    type: 'team',
    complexity: 'moderate',
    securitySensitive: false,
    triggers: [
      { pattern: 'fix', weight: 1.0 },
      { pattern: 'bug', weight: 0.8 },
      { pattern: 'implement', weight: 0.7 },
    ],
    resources: { minContextWindow: 50000, estimatedTokens: 80000, preferredTier: 'expert' },
    requires: [],
    produces: [],
    composableWith: [],
    targetRepos: [],
    targetDomains: [],
  },
}

const secSkill: SkillItem = {
  id: 'sec-devops',
  name: 'Sec DevOps',
  description: 'Security audit and DevOps hardening',
  category: 'security',
  path: '/skills/sec-devops',
  source: 'project',
  origin: 'agenthub',
  manifest: {
    version: 1,
    domain: 'security',
    type: 'skill',
    complexity: 'complex',
    securitySensitive: true,
    triggers: [
      { pattern: 'security', weight: 1.0 },
      { pattern: 'audit', weight: 0.9 },
      { pattern: 'vulnerability', weight: 0.85 },
    ],
    resources: { minContextWindow: 100000, estimatedTokens: 150000, preferredTier: 'frontier' },
    requires: [],
    produces: [],
    composableWith: [],
    targetRepos: [],
    targetDomains: [],
  },
}

const brainstormSkill: SkillItem = {
  id: 'brainstorm',
  name: 'Brainstorm',
  description: 'Creative ideation and brainstorming',
  category: 'research',
  path: '/skills/brainstorm',
  source: 'project',
  origin: 'agenthub',
  manifest: {
    version: 1,
    domain: 'business-research',
    type: 'skill',
    complexity: 'simple',
    securitySensitive: false,
    triggers: [
      { pattern: 'brainstorm', weight: 1.0 },
      { pattern: 'ideas', weight: 0.8 },
    ],
    resources: { minContextWindow: 20000, estimatedTokens: 30000, preferredTier: 'capable' },
    requires: [],
    produces: [],
    composableWith: [],
    targetRepos: [],
    targetDomains: [],
  },
}

const architectSkill: SkillItem = {
  id: 'architect',
  name: 'Architect',
  description: 'System architecture design and review',
  category: 'design',
  path: '/skills/architect',
  source: 'project',
  origin: 'agenthub',
  manifest: {
    version: 1,
    domain: 'code-dev',
    type: 'skill',
    complexity: 'complex',
    securitySensitive: false,
    triggers: [
      { pattern: 'architecture', weight: 1.0 },
      { pattern: 'redesign', weight: 0.9 },
      { pattern: 'migrate', weight: 0.8 },
    ],
    resources: { minContextWindow: 150000, estimatedTokens: 200000, preferredTier: 'frontier' },
    requires: [],
    produces: [],
    composableWith: [],
    targetRepos: [],
    targetDomains: [],
  },
}

// Skill without manifest — must be ignored during classification
const bareSkill: SkillItem = {
  id: 'bare-skill',
  name: 'Bare Skill',
  description: 'No manifest attached',
  category: 'misc',
  path: '/skills/bare-skill',
  source: 'project',
  origin: 'agenthub',
}

const ALL_SKILLS: SkillItem[] = [devSkill, secSkill, brainstormSkill, architectSkill, bareSkill]

// ─── Tests ────────────────────────────────────────────────────────────────

describe('classifyTask', () => {
  // ── Test 1: dev keyword → devSkill is top match, complexity simple ──

  it('T1: "fix the login bug" → top match is devSkill, complexity simple', () => {
    const result = classifyTask('fix the login bug', [], ALL_SKILLS)

    expect(result.matchedSkills.length).toBeGreaterThan(0)
    expect(result.matchedSkills[0].id).toBe('team-dev-loop')
    // fix(1.0) + bug(0.8) = 1.8
    expect(result.matchedSkills[0].score).toBeCloseTo(1.8)
    expect(result.complexity).toBe('simple')
    expect(result.domain).toBe('code-dev')
  })

  // ── Test 2: security audit → secSkill is top match, securitySensitive true ──

  it('T2: "security audit of the auth module" → top match is secSkill, securitySensitive true', () => {
    const result = classifyTask('security audit of the auth module', [], ALL_SKILLS)

    expect(result.matchedSkills[0].id).toBe('sec-devops')
    // security(1.0) + audit(0.9) = 1.9
    expect(result.matchedSkills[0].score).toBeCloseTo(1.9)
    expect(result.securitySensitive).toBe(true)
    expect(result.domain).toBe('security')
  })

  // ── Test 3: brainstorm keyword → brainstormSkill matches ──

  it('T3: "brainstorm ideas for the landing page" → brainstormSkill in top matches', () => {
    const result = classifyTask('brainstorm ideas for the landing page', [], ALL_SKILLS)

    const ids = result.matchedSkills.map((s) => s.id)
    expect(ids).toContain('brainstorm')
    // brainstorm(1.0) + ideas(0.8) = 1.8
    const bs = result.matchedSkills.find((s) => s.id === 'brainstorm')!
    expect(bs.score).toBeCloseTo(1.8)
  })

  // ── Test 4: architecture keyword → complexity complex ──

  it('T4: "completely redesign the architecture" → complexity complex', () => {
    const result = classifyTask('completely redesign the architecture', [], ALL_SKILLS)

    expect(result.complexity).toBe('complex')
    // architect skill matches both architecture(1.0) + redesign(0.9) = 1.9
    expect(result.matchedSkills[0].id).toBe('architect')
  })

  // ── Test 5: no matching keywords → fallbackMode 'ask' ──

  it('T5: "unrelated task with no keywords" → fallbackMode ask, no matches', () => {
    const result = classifyTask('unrelated task with no keywords', [], ALL_SKILLS)

    expect(result.matchedSkills).toHaveLength(0)
    expect(result.fallbackMode).toBe('ask')
  })

  // ── Test 6: 0 target files → scope single-file ──

  it('T6: 0 target files → scope single-file', () => {
    const result = classifyTask('fix the bug', [], ALL_SKILLS)

    expect(result.scope).toBe('single-file')
  })

  // ── Test 7: 3 target files → scope multi-file ──

  it('T7: 3 target files → scope multi-file', () => {
    const result = classifyTask('fix the bug', ['a.ts', 'b.ts', 'c.ts'], ALL_SKILLS)

    expect(result.scope).toBe('multi-file')
  })

  // ── Test 8: 8 target files → scope cross-repo ──

  it('T8: 8 target files → scope cross-repo', () => {
    const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts', 'g.ts', 'h.ts']
    const result = classifyTask('fix the bug', files, ALL_SKILLS)

    expect(result.scope).toBe('cross-repo')
  })

  // ── Test 9: skills without manifests are ignored ──

  it('T9: skills without manifests are excluded from classification', () => {
    // Only bareSkill in list — no manifest, should produce no matches
    const result = classifyTask('fix the login bug', [], [bareSkill])

    expect(result.matchedSkills).toHaveLength(0)
    expect(result.fallbackMode).toBe('ask')
  })

  // ── Test 10: result capped at top 3 skills ──

  it('T10: result returns at most 3 matched skills even with many matches', () => {
    // Craft 5 skills all matching "fix"
    const manySkills: SkillItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: `skill-${i}`,
      name: `Skill ${i}`,
      description: `Skill number ${i}`,
      category: 'misc',
      path: `/skills/skill-${i}`,
      source: 'project' as const,
      origin: 'agenthub' as const,
      manifest: {
        version: 1,
        domain: 'code-dev',
        type: 'skill' as const,
        complexity: 'simple' as const,
        securitySensitive: false,
        triggers: [{ pattern: 'fix', weight: 1.0 - i * 0.05 }],
        resources: { minContextWindow: 8000, estimatedTokens: 10000, preferredTier: 'capable' as const },
        requires: [],
        produces: [],
        composableWith: [],
        targetRepos: [],
        targetDomains: [],
      },
    }))

    const result = classifyTask('fix the bug', [], manySkills)

    expect(result.matchedSkills.length).toBeLessThanOrEqual(3)
  })

  // ── Test 11: securitySensitive OR across matched skills ──

  it('T11: securitySensitive is true when any matched skill is security sensitive', () => {
    // Task matches both devSkill and secSkill
    const result = classifyTask('fix the security vulnerability', [], ALL_SKILLS)

    // secSkill has securitySensitive: true → result must be true
    expect(result.securitySensitive).toBe(true)
  })

  // ── Test 12: matched skill reason contains the trigger pattern ──

  it('T12: matched skill reason lists the matched trigger pattern(s)', () => {
    const result = classifyTask('fix the login bug', [], [devSkill])

    expect(result.matchedSkills).toHaveLength(1)
    expect(result.matchedSkills[0].reason).toContain('fix')
    expect(result.matchedSkills[0].reason).toContain('bug')
  })

  // ── Test 13: matching is case-insensitive ──

  it('T13: pattern matching is case-insensitive', () => {
    const result = classifyTask('SECURITY AUDIT the system', [], [secSkill])

    expect(result.matchedSkills).toHaveLength(1)
    expect(result.matchedSkills[0].id).toBe('sec-devops')
  })

  // ── Test 14: 5 target files → still multi-file (boundary) ──

  it('T14: exactly 5 target files → scope multi-file (boundary)', () => {
    const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts']
    const result = classifyTask('fix a bug', files, ALL_SKILLS)

    expect(result.scope).toBe('multi-file')
  })

  // ── Test 15: no fallbackMode key when there are matches ──

  it('T15: fallbackMode is absent when at least one skill matches', () => {
    const result = classifyTask('fix the bug', [], [devSkill])

    expect(result.fallbackMode).toBeUndefined()
  })
})
