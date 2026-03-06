import log from 'electron-log/main'
import { assessComplexity, recommend } from './model-dispatcher'
import type { TaskComplexity } from './model-dispatcher'
import type { ModelProvider } from '@shared/types/agent.types'

export interface PipelineInput {
  taskDescription: string
  repoId: string
  quotaPercent: number
  quotaUsed: number
  quotaLimit: number
  burnRate: number
  ollamaAvailable: boolean
}

export interface PipelineResult {
  complexity: TaskComplexity
  triageLevel: 'low' | 'medium' | 'high' | 'critical'
  recommendation: {
    model: string
    provider: ModelProvider
    rationale: string
    warnings: string[]
  }
  estimatedImpact: number
  durationMs: number
}

const IMPACT_MAP: Record<TaskComplexity, number> = {
  simple: 5,
  moderate: 15,
  complex: 35
}

function assignTriage(
  complexity: TaskComplexity,
  quotaPercent: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (complexity === 'complex' && quotaPercent > 80) return 'critical'
  if (complexity === 'complex') return 'high'
  if (complexity === 'moderate') return 'medium'
  return 'low'
}

export function runPipeline(input: PipelineInput): PipelineResult {
  const start = performance.now()

  const complexity = assessComplexity(input.taskDescription)
  const triageLevel = assignTriage(complexity, input.quotaPercent)
  const rec = recommend(input.quotaPercent, input.taskDescription, input.ollamaAvailable)
  const estimatedImpact = IMPACT_MAP[complexity]

  const durationMs = performance.now() - start

  log.debug('Pipeline complete', { complexity, triageLevel, durationMs })

  return {
    complexity,
    triageLevel,
    recommendation: {
      model: rec.model,
      provider: rec.provider,
      rationale: rec.rationale,
      warnings: rec.warnings
    },
    estimatedImpact,
    durationMs
  }
}
