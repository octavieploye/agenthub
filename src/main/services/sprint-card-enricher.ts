import { classifyTask } from './skill-classifier'
import { composePipeline, type BudgetState, type ComposedPipeline } from './pipeline-composer'
import { PIPELINE_TEMPLATES } from './pipeline-templates'
import { recommendForSkill } from './model-dispatcher'
import type { SkillsService } from './skills-service'
import type { TokenBudgetTracker } from './token-budget'
import type { SkillItem } from '../../shared/types/skills.types'

// ─── Public Types ──────────────────────────────────────────────────────────

export interface EnrichedCard {
  skills: string[]
  targetFiles: string[]
  estimatedTokens: number
  recommendedModel: string | null
  riskScore: number
  pipeline: ComposedPipeline
  warnings: string[]
}

// ─── Enricher ─────────────────────────────────────────────────────────────

export class SprintCardEnricher {
  private skillsService: SkillsService
  private budgetTracker: TokenBudgetTracker

  constructor(skillsService: SkillsService, budgetTracker: TokenBudgetTracker) {
    this.skillsService = skillsService
    this.budgetTracker = budgetTracker
  }

  enrich(
    title: string,
    description: string,
    targetFiles: string[],
    repoId: string
  ): EnrichedCard {
    // 1. Load available skills (with manifests)
    const skills = this.skillsService.listSkills()

    return enrichCard(title, description, targetFiles, repoId, skills, this.budgetTracker)
  }
}

// ─── Pure enrichment function (also exported for testing without a real SkillsService) ───

export function enrichCard(
  title: string,
  description: string,
  targetFiles: string[],
  repoId: string,
  skills: SkillItem[],
  budgetTracker: TokenBudgetTracker
): EnrichedCard {
  const taskText = `${title} ${description}`.trim()

  // 2. Classify the task
  const classification = classifyTask(taskText, targetFiles, skills, repoId)

  // 3. Get budget state
  const warningLevel = budgetTracker.getWarningLevel()
  const dailyBudget = budgetTracker.getDailyBudget()
  const usedToday = budgetTracker.getUsedToday()
  const budgetState: BudgetState = {
    warningLevel,
    remainingTokens: Math.max(0, dailyBudget - usedToday),
  }

  // 4. Compose pipeline
  const pipeline = composePipeline(classification, PIPELINE_TEMPLATES, skills, budgetState)

  // 5. Get top matched skill manifest for model recommendation
  const topSkillId = classification.matchedSkills[0]?.id
  const topSkill = topSkillId ? skills.find((s) => s.id === topSkillId) : undefined
  let recommendedModel: string | null = null
  if (topSkill?.manifest) {
    const rec = recommendForSkill(topSkill.manifest, budgetState, {})
    recommendedModel = rec.model || null
  }

  // 6. Compute risk score: 0.0–1.0
  let riskScore = pipeline.securityGated ? 0.5 : 0.1
  if (classification.securitySensitive) riskScore += 0.2
  if (pipeline.splitRecommended) riskScore += 0.1
  if (budgetState.warningLevel !== 'ok') riskScore += 0.1
  riskScore = Math.min(1.0, riskScore)

  return {
    skills: classification.matchedSkills.map((m) => m.id),
    targetFiles,
    estimatedTokens: pipeline.estimatedTokens,
    recommendedModel,
    riskScore,
    pipeline,
    warnings: pipeline.warnings,
  }
}
