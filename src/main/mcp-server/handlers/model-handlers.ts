import { estimateTokens } from '../engines/token-estimator'
import type {
  EstimateTokensToolInput,
  EstimateTokensToolOutput,
  RecommendModelToolInput
} from '@shared/types/mcp-server.types'
import type { ModelProvider, CapabilityTier } from '@shared/types/model.types'

// ─── Pure quota / complexity helpers ─────────────────────────────────────────
//
// These mirror the implementations in model-dispatcher.ts but are kept local
// so this module has no dependency on electron-log (which model-dispatcher
// imports). Tests for this handler do not mock electron-log.

const COMPLEX_KEYWORDS = ['refactor', 'architecture', 'migrate', 'redesign']
const SIMPLE_KEYWORDS = ['fix', 'bug', 'typo', 'update', 'lint']

export type TaskComplexity = 'simple' | 'moderate' | 'complex'
export type QuotaZone = 'healthy' | 'moderate' | 'hot'

export function getQuotaZone(quotaPercent: number): QuotaZone {
  if (quotaPercent >= 80) return 'hot'
  if (quotaPercent >= 60) return 'moderate'
  return 'healthy'
}

export function assessComplexity(taskDescription: string): TaskComplexity {
  const lower = taskDescription.toLowerCase()

  for (const keyword of COMPLEX_KEYWORDS) {
    if (lower.includes(keyword)) return 'complex'
  }

  for (const keyword of SIMPLE_KEYWORDS) {
    if (lower.includes(keyword)) return 'simple'
  }

  return 'moderate'
}

// ─── Risk-based capability tier ───────────────────────────────────────────────
//
// Subset of the shared CapabilityTier ('frontier'|'expert'|'capable'|'efficient').
// Low-risk tasks map to 'capable' (not 'efficient') as a conservative floor.

type RiskCapabilityTier = 'frontier' | 'expert' | 'capable'

export interface HandlerModelRecommendation {
  modelId: string
  provider: ModelProvider
  capabilityTier: RiskCapabilityTier
  rationale: string
  estimatedTokens: number | null
  contextWindowFit: boolean
  riskAdjusted: boolean
}

// ─── Model constants ──────────────────────────────────────────────────────────

const CLAUDE_OPUS = 'claude-opus-4-6'
const CLAUDE_SONNET = 'claude-sonnet-4-6'
const CLAUDE_HAIKU = 'claude-haiku-4-5-20251001'
const CLAUDE_CONTEXT_WINDOW = 200_000

// ─── Handlers ─────────────────────────────────────────────────────────────────

export function handleEstimateTokens(input: EstimateTokensToolInput): EstimateTokensToolOutput {
  return estimateTokens({
    description: input.description,
    targetFiles: input.targetFiles,
    skills: input.skills
  })
}

function selectTier(riskScore: number): RiskCapabilityTier {
  if (riskScore >= 0.7) return 'frontier'
  if (riskScore >= 0.4) return 'expert'
  return 'capable'
}

export function handleRecommendModel(input: RecommendModelToolInput): HandlerModelRecommendation {
  const riskScore = input.riskScore ?? 0
  const complexity = assessComplexity(input.description)
  const tier = selectTier(riskScore)

  let modelId: string
  let rationale: string

  if (tier === 'frontier') {
    modelId = CLAUDE_OPUS
    rationale = `High-risk task — Opus selected for maximum reliability (risk score: ${riskScore})`
  } else if (tier === 'expert') {
    modelId = complexity === 'complex' ? CLAUDE_OPUS : CLAUDE_SONNET
    rationale = `Medium-risk ${complexity} task — ${complexity === 'complex' ? 'Opus' : 'Sonnet'} selected`
  } else {
    modelId = complexity === 'complex' ? CLAUDE_SONNET : CLAUDE_HAIKU
    rationale = `Low-risk ${complexity} task — ${complexity === 'complex' ? 'Sonnet' : 'Haiku'} sufficient`
  }

  const estimatedTokens = input.estimatedTokens ?? null
  const tokenCount =
    estimatedTokens ??
    (input.targetFiles?.length || input.skills?.length
      ? estimateTokens({
          description: input.description,
          targetFiles: input.targetFiles,
          skills: input.skills
        }).estimatedTokens
      : null)
  const contextWindowFit = tokenCount === null || tokenCount <= CLAUDE_CONTEXT_WINDOW

  return {
    modelId,
    provider: 'anthropic',
    // RiskCapabilityTier ('frontier'|'expert'|'capable') is a strict subset of
    // CapabilityTier — the cast is safe; 'efficient' is never produced by selectTier().
    capabilityTier: tier as CapabilityTier,
    rationale,
    estimatedTokens,
    contextWindowFit,
    riskAdjusted: true
  }
}
