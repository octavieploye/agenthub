import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { enrichCard, SprintCardEnricher } from './sprint-card-enricher'
import { TokenBudgetTracker } from './token-budget'
import type { SkillItem, SkillManifest } from '../../shared/types/skills.types'

// electron-log/main is an Electron boundary — mock it so vitest (Node) can import it
vi.mock('electron-log/main', () => ({
  default: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────

function makeManifest(overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    version: 1,
    domain: 'code-dev',
    type: 'skill',
    complexity: 'moderate',
    securitySensitive: false,
    triggers: [{ pattern: 'implement', weight: 10 }],
    resources: {
      minContextWindow: 10000,
      estimatedTokens: 20000,
      preferredTier: 'capable',
    },
    requires: [],
    produces: [],
    composableWith: [],
    targetRepos: [],
    targetDomains: [],
    ...overrides,
  }
}

function makeSkill(id: string, manifest?: SkillManifest): SkillItem {
  return {
    id,
    name: id,
    description: `Skill ${id}`,
    category: 'general',
    path: `/fake/${id}/SKILL.md`,
    source: 'project',
    origin: 'agenthub',
    manifest,
  }
}

let db: Database.Database
let budgetTracker: TokenBudgetTracker

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../db/migrations')
  budgetTracker = new TokenBudgetTracker(db)
})

afterEach(() => {
  db.close()
})

// ─── enrichCard — code-dev task ───────────────────────────────────────────

describe('enrichCard — code-dev task', () => {
  it('matches dev template and returns non-null recommendedModel', () => {
    const skills = [makeSkill('team-dev-loop', makeManifest({ domain: 'code-dev', triggers: [{ pattern: 'implement', weight: 10 }] }))]
    const result = enrichCard('Implement login', 'implement the login feature', [], 'repo-1', skills, budgetTracker)

    expect(result.skills).toContain('team-dev-loop')
    expect(result.estimatedTokens).toBeGreaterThan(0)
    expect(result.recommendedModel).not.toBeNull()
    expect(typeof result.recommendedModel).toBe('string')
    expect(result.pipeline.templateId).not.toBeNull()
    expect(result.warnings).toBeDefined()
  })

  it('pipeline uses a code-dev template for code-dev domain', () => {
    const skills = [makeSkill('team-dev-loop', makeManifest({ domain: 'code-dev', triggers: [{ pattern: 'implement', weight: 10 }] }))]
    const result = enrichCard('implement the feature', '', [], 'repo-1', skills, budgetTracker)

    // code-dev + moderate → dev-standard
    expect(result.pipeline.templateId).toBe('dev-standard')
    expect(result.pipeline.phases.length).toBeGreaterThan(0)
  })
})

// ─── enrichCard — security task ───────────────────────────────────────────

describe('enrichCard — security task', () => {
  it('riskScore >= 0.5 for security-sensitive task, pipeline is security-audit', () => {
    const skills = [
      makeSkill('team-threat-defense', makeManifest({
        domain: 'security',
        securitySensitive: true,
        triggers: [{ pattern: 'audit', weight: 15 }],
        resources: { minContextWindow: 20000, estimatedTokens: 40000, preferredTier: 'frontier' },
      })),
    ]
    const result = enrichCard('Security audit', 'audit the auth module', [], 'repo-1', skills, budgetTracker)

    expect(result.riskScore).toBeGreaterThanOrEqual(0.5)
    expect(result.pipeline.securityGated).toBe(true)
    expect(result.pipeline.templateId).toBe('security-audit')
  })
})

// ─── enrichCard — no manifest skills ─────────────────────────────────────

describe('enrichCard — no manifest skills', () => {
  it('falls back to dynamic pipeline and includes warning when no skill matches', () => {
    // Skills without manifests — classifier ignores them
    const skills = [makeSkill('some-skill')]
    const result = enrichCard('Do something', 'do something generic', [], 'repo-1', skills, budgetTracker)

    expect(result.pipeline.templateId).toBeNull()
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('No static template matched')
  })

  it('recommendedModel is null when no manifest skill matches', () => {
    const skills = [makeSkill('some-skill')]
    const result = enrichCard('Do something', 'do something generic', [], 'repo-1', skills, budgetTracker)

    expect(result.recommendedModel).toBeNull()
  })
})

// ─── enrichCard — blocked budget ──────────────────────────────────────────

describe('enrichCard — blocked budget', () => {
  it('returns 0 phases and a budget warning when budget is blocked', () => {
    // Exhaust the budget
    db.prepare("INSERT INTO settings (key, value) VALUES ('tokenDailyBudget', '1000')").run()
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      `INSERT INTO token_usage (id, task_id, skill_id, date, estimated_tokens, actual_tokens)
       VALUES ('u1', 't1', null, ?, 1000, 1000)`
    ).run(today)

    const skills = [makeSkill('team-dev-loop', makeManifest())]
    const result = enrichCard('Implement feature', 'implement feature', [], 'repo-1', skills, budgetTracker)

    expect(result.pipeline.phases).toHaveLength(0)
    expect(result.pipeline.estimatedTokens).toBe(0)
    expect(result.warnings.some((w) => w.includes('blocked') || w.includes('Budget'))).toBe(true)
  })
})

// ─── riskScore clamping ───────────────────────────────────────────────────

describe('enrichCard — riskScore clamping', () => {
  it('riskScore is clamped to 1.0 when all risk factors are present', () => {
    // Set budget to critical level (80%+ used)
    db.prepare("INSERT INTO settings (key, value) VALUES ('tokenDailyBudget', '100000')").run()
    const today = new Date().toISOString().slice(0, 10)
    // 81% used → critical warning level
    db.prepare(
      `INSERT INTO token_usage (id, task_id, skill_id, date, estimated_tokens, actual_tokens)
       VALUES ('u1', 't1', null, ?, 81000, 81000)`
    ).run(today)

    // dev-complex template: estimatedTokens 160000 > 150000 → splitRecommended
    // Also security sensitive
    const skills = [
      makeSkill('team-dev-loop', makeManifest({
        domain: 'code-dev',
        securitySensitive: true,
        triggers: [{ pattern: 'architecture', weight: 20 }],
      })),
    ]
    const result = enrichCard('Redesign architecture', 'architecture redesign', [], 'repo-1', skills, budgetTracker)

    expect(result.riskScore).toBeLessThanOrEqual(1.0)
    expect(result.riskScore).toBeGreaterThan(0)
  })
})

// ─── EnrichedCard shape ───────────────────────────────────────────────────

describe('enrichCard — output shape', () => {
  it('returns all required fields in EnrichedCard', () => {
    const skills = [makeSkill('team-dev-loop', makeManifest())]
    const result = enrichCard('Fix bug', 'fix the login bug', ['src/auth.ts'], 'repo-1', skills, budgetTracker)

    expect(result).toHaveProperty('skills')
    expect(result).toHaveProperty('targetFiles')
    expect(result).toHaveProperty('estimatedTokens')
    expect(result).toHaveProperty('recommendedModel')
    expect(result).toHaveProperty('riskScore')
    expect(result).toHaveProperty('pipeline')
    expect(result).toHaveProperty('warnings')

    expect(Array.isArray(result.skills)).toBe(true)
    expect(Array.isArray(result.targetFiles)).toBe(true)
    expect(typeof result.estimatedTokens).toBe('number')
    expect(typeof result.riskScore).toBe('number')
    expect(Array.isArray(result.warnings)).toBe(true)
    expect(typeof result.pipeline).toBe('object')
  })

  it('targetFiles is passed through unchanged', () => {
    const skills = [makeSkill('team-dev-loop', makeManifest())]
    const files = ['src/a.ts', 'src/b.ts']
    const result = enrichCard('Fix bug', 'fix something', files, 'repo-1', skills, budgetTracker)

    expect(result.targetFiles).toEqual(files)
  })
})

// ─── SprintCardEnricher class ─────────────────────────────────────────────

describe('SprintCardEnricher class', () => {
  it('delegates to enrichCard and returns an EnrichedCard', () => {
    const mockSkills = [makeSkill('team-dev-loop', makeManifest())]
    const mockSkillsService = {
      listSkills: vi.fn().mockReturnValue(mockSkills),
    }

    // Cast to SkillsService — only listSkills() is called by SprintCardEnricher
    const enricher = new SprintCardEnricher(
      mockSkillsService as unknown as import('./skills-service').SkillsService,
      budgetTracker
    )

    const result = enricher.enrich('Implement feature', 'implement the feature', [], 'repo-1')

    expect(mockSkillsService.listSkills).toHaveBeenCalledOnce()
    expect(result).toHaveProperty('skills')
    expect(result).toHaveProperty('pipeline')
    expect(result.estimatedTokens).toBeGreaterThan(0)
  })
})
