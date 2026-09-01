import { describe, it, expect } from 'vitest'
import { composePipeline, type BudgetState } from './pipeline-composer'
import { PIPELINE_TEMPLATES } from './pipeline-templates'
import type { ClassificationResult } from './skill-classifier'
import type { SkillItem } from '../../shared/types/skills.types'

// ─── Fixtures ─────────────────────────────────────────────────────────────

const OK_BUDGET: BudgetState = { warningLevel: 'ok', remainingTokens: 500_000 }

function makeClassification(
  domain: string,
  complexity: 'simple' | 'moderate' | 'complex',
  overrides: Partial<ClassificationResult> = {}
): ClassificationResult {
  return {
    domain,
    complexity,
    matchedSkills: [{ id: 'team-dev-loop', score: 10, reason: 'test fixture' }],
    securitySensitive: false,
    scope: 'multi-file',
    ...overrides,
  }
}

const EMPTY_SKILLS: SkillItem[] = []

// ─── Static template matching ─────────────────────────────────────────────

describe('composePipeline — static template selection', () => {
  it('code-dev + simple → dev-simple', () => {
    const result = composePipeline(
      makeClassification('code-dev', 'simple'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      OK_BUDGET
    )
    expect(result.templateId).toBe('dev-simple')
    expect(result.phases.length).toBe(2)
    expect(result.phases[0].skillId).toBe('team-dev-loop')
    expect(result.phases[1].skillId).toBe('test-integrity-review')
    expect(result.requiresApproval).toBe(false)
    expect(result.securityGated).toBe(false)
  })

  it('code-dev + moderate → dev-standard', () => {
    const result = composePipeline(
      makeClassification('code-dev', 'moderate'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      OK_BUDGET
    )
    expect(result.templateId).toBe('dev-standard')
    expect(result.phases.length).toBe(3)
    expect(result.requiresApproval).toBe(true)
    expect(result.securityGated).toBe(false)
  })

  it('code-dev + complex → dev-complex', () => {
    const result = composePipeline(
      makeClassification('code-dev', 'complex'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      OK_BUDGET
    )
    expect(result.templateId).toBe('dev-complex')
    expect(result.phases.length).toBe(4)
    expect(result.phases[0].skillId).toBe('team-impl-lead')
    expect(result.requiresApproval).toBe(true)
  })

  it('security + simple → security-audit', () => {
    const result = composePipeline(
      makeClassification('security', 'simple'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      OK_BUDGET
    )
    expect(result.templateId).toBe('security-audit')
    expect(result.securityGated).toBe(true)
    expect(result.requiresApproval).toBe(true)
  })

  it('security + moderate → security-audit', () => {
    const result = composePipeline(
      makeClassification('security', 'moderate'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      OK_BUDGET
    )
    expect(result.templateId).toBe('security-audit')
    expect(result.securityGated).toBe(true)
  })

  it('code-quality + any → full-review', () => {
    const result = composePipeline(
      makeClassification('code-quality', 'moderate'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      OK_BUDGET
    )
    expect(result.templateId).toBe('full-review')
    expect(result.securityGated).toBe(true)
    expect(result.phases[0].skillId).toBe('full-code-review')
  })

  it('ai-engineering + simple → ai-engineering template', () => {
    const result = composePipeline(
      makeClassification('ai-engineering', 'simple'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      OK_BUDGET
    )
    expect(result.templateId).toBe('ai-engineering')
    expect(result.phases.length).toBe(2)
    expect(result.phases[1].skillId).toBe('team-ai-expert')
  })

  it('memory + any → memory-ops template', () => {
    const result = composePipeline(
      makeClassification('memory', 'moderate'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      OK_BUDGET
    )
    expect(result.templateId).toBe('memory-ops')
    expect(result.phases[0].skillId).toBe('anamnesis-write')
  })

  it('market-intel + complex → market-intel template', () => {
    const result = composePipeline(
      makeClassification('market-intel', 'complex'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      OK_BUDGET
    )
    expect(result.templateId).toBe('market-intel')
    expect(result.phases.length).toBe(2)
  })
})

// ─── Dynamic fallback ─────────────────────────────────────────────────────

describe('composePipeline — dynamic fallback', () => {
  it('no domain match → dynamic composition, requiresApproval: true', () => {
    const result = composePipeline(
      makeClassification('unknown-domain', 'moderate'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      OK_BUDGET
    )
    expect(result.templateId).toBeNull()
    expect(result.name).toBe('Dynamic Pipeline')
    expect(result.requiresApproval).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('No static template matched')
  })

  it('dynamic: top matched skill used as impl phase', () => {
    const classification = makeClassification('unknown-domain', 'simple', {
      matchedSkills: [{ id: 'anamnesis-write', score: 5, reason: 'test' }],
    })
    const result = composePipeline(classification, PIPELINE_TEMPLATES, EMPTY_SKILLS, OK_BUDGET)
    expect(result.templateId).toBeNull()
    expect(result.phases[0].skillId).toBe('anamnesis-write')
    expect(result.phases[1].skillId).toBe('full-code-review')
  })

  it('dynamic: no matched skills → defaults to team-dev-loop', () => {
    const classification = makeClassification('unknown-domain', 'simple', {
      matchedSkills: [],
    })
    const result = composePipeline(classification, PIPELINE_TEMPLATES, EMPTY_SKILLS, OK_BUDGET)
    expect(result.phases[0].skillId).toBe('team-dev-loop')
  })
})

// ─── Budget checks ────────────────────────────────────────────────────────

describe('composePipeline — budget handling', () => {
  it('budget exceeded → warning added to result', () => {
    const budget: BudgetState = { warningLevel: 'warn', remainingTokens: 1000 }
    const result = composePipeline(
      makeClassification('code-dev', 'complex'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      budget
    )
    // dev-complex has estimatedTokens: 160000, budget only 1000
    expect(result.warnings.some((w) => w.includes('exceed remaining budget'))).toBe(true)
  })

  it('budget ok and tokens within → no budget warning', () => {
    const result = composePipeline(
      makeClassification('memory', 'simple'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      OK_BUDGET
    )
    expect(result.warnings.some((w) => w.includes('exceed remaining budget'))).toBe(false)
  })

  it('budgetState.warningLevel === blocked → 0 phases, warning included', () => {
    const blocked: BudgetState = { warningLevel: 'blocked', remainingTokens: 0 }
    const result = composePipeline(
      makeClassification('code-dev', 'moderate'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      blocked
    )
    expect(result.phases).toHaveLength(0)
    expect(result.warnings.some((w) => w.includes('blocked'))).toBe(true)
    expect(result.estimatedTokens).toBe(0)
  })
})

// ─── Split recommendation ─────────────────────────────────────────────────

describe('composePipeline — splitRecommended', () => {
  it('estimatedTokens > 150000 → splitRecommended: true', () => {
    // dev-complex has estimatedTokens: 160000
    const result = composePipeline(
      makeClassification('code-dev', 'complex'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      OK_BUDGET
    )
    expect(result.splitRecommended).toBe(true)
  })

  it('estimatedTokens <= 150000 → splitRecommended: false', () => {
    // dev-simple has estimatedTokens: 30000
    const result = composePipeline(
      makeClassification('code-dev', 'simple'),
      PIPELINE_TEMPLATES,
      EMPTY_SKILLS,
      OK_BUDGET
    )
    expect(result.splitRecommended).toBe(false)
  })
})
