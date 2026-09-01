import type { ClassificationResult } from './skill-classifier'
import type { PipelineTemplate, PipelinePhase } from './pipeline-templates'
import type { SkillItem } from '../../shared/types/skills.types'

// ─── Public Types ─────────────────────────────────────────────────────────

export interface ComposedPipeline {
  templateId: string | null
  name: string
  phases: PipelinePhase[]
  estimatedTokens: number
  requiresApproval: boolean
  securityGated: boolean
  splitRecommended: boolean
  warnings: string[]
}

export interface BudgetState {
  warningLevel: 'ok' | 'warn' | 'critical' | 'blocked'
  remainingTokens: number
}

// ─── Constants ────────────────────────────────────────────────────────────

const SPLIT_THRESHOLD = 150_000

// ─── Helpers ──────────────────────────────────────────────────────────────

function matchesTemplate(
  template: PipelineTemplate,
  domain: string,
  complexity: 'simple' | 'moderate' | 'complex'
): boolean {
  return template.triggers.some(
    (trigger) => trigger.domain === domain && trigger.complexity === complexity
  )
}

function buildDynamicPipeline(
  classification: ClassificationResult,
  skills: SkillItem[]
): { phases: PipelinePhase[]; estimatedTokens: number } {
  const topSkillId = classification.matchedSkills[0]?.id ?? 'team-dev-loop'

  const matchedSkill = skills.find((s) => s.id === topSkillId)
  const implTokens = matchedSkill?.manifest?.resources.estimatedTokens ?? 20000
  const reviewTokens = 15000

  const phases: PipelinePhase[] = [
    {
      id: 'impl',
      skillId: topSkillId,
      role: 'Implementation',
      modelTier: matchedSkill?.manifest?.resources.preferredTier ?? 'capable',
      dependsOn: [],
      requiresApproval: false,
    },
    {
      id: 'review',
      skillId: 'full-code-review',
      role: 'Review',
      modelTier: 'capable',
      dependsOn: ['impl'],
      requiresApproval: false,
    },
  ]

  return { phases, estimatedTokens: implTokens + reviewTokens }
}

// ─── Composer ─────────────────────────────────────────────────────────────

export function composePipeline(
  classification: ClassificationResult,
  templates: PipelineTemplate[],
  skills: SkillItem[],
  budgetState: BudgetState
): ComposedPipeline {
  const warnings: string[] = []

  // Blocked budget — return empty pipeline immediately
  if (budgetState.warningLevel === 'blocked') {
    warnings.push('Budget is blocked: no remaining tokens to execute this pipeline.')
    return {
      templateId: null,
      name: 'Blocked',
      phases: [],
      estimatedTokens: 0,
      requiresApproval: true,
      securityGated: false,
      splitRecommended: false,
      warnings,
    }
  }

  // 1. Try to find a matching static template
  const matched = templates.find((t) =>
    matchesTemplate(t, classification.domain, classification.complexity)
  )

  let templateId: string | null
  let name: string
  let phases: PipelinePhase[]
  let estimatedTokens: number
  let requiresApproval: boolean
  let securityGated: boolean

  if (matched) {
    templateId = matched.id
    name = matched.name
    phases = matched.phases
    estimatedTokens = matched.estimatedTokens
    requiresApproval = matched.phases.some((p) => p.requiresApproval)
    securityGated = matched.securityGated
  } else {
    // 2. Dynamic fallback
    const dynamic = buildDynamicPipeline(classification, skills)
    templateId = null
    name = 'Dynamic Pipeline'
    phases = dynamic.phases
    estimatedTokens = dynamic.estimatedTokens
    requiresApproval = true // always true for dynamic
    securityGated = classification.securitySensitive
    warnings.push(
      `No static template matched domain="${classification.domain}" complexity="${classification.complexity}". Dynamic pipeline composed.`
    )
  }

  // 3. Budget warning
  if (estimatedTokens > budgetState.remainingTokens) {
    warnings.push(
      `Estimated tokens (${estimatedTokens}) exceed remaining budget (${budgetState.remainingTokens}).`
    )
  }

  // 4. Split recommendation
  const splitRecommended = estimatedTokens > SPLIT_THRESHOLD

  return {
    templateId,
    name,
    phases,
    estimatedTokens,
    requiresApproval,
    securityGated,
    splitRecommended,
    warnings,
  }
}
