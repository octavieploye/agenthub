import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { TokenEstimation, TokenEstimationBreakdown } from '@shared/types/mcp-server.types'

// ─── File-level mtime cache ───────────────────────────────────────────────────
// Keyed by absolute file path. Cleared on process exit naturally.
const fileCache = new Map<string, { mtime: number; tokens: number }>()

const BYTES_PER_TOKEN = 4
const LARGE_FILE_BYTES = 1_000_000
const MISSING_FILE_FALLBACK = 500
const MISSING_SKILL_FALLBACK = 300
const SYSTEM_CONTEXT_TOKENS = 4_900
const RESPONSE_OVERHEAD_RATE = 0.3
const SAFETY_MARGIN_RATE = 0.15

export interface TokenEstimatorInput {
  description?: string
  targetFiles?: string[]
  skills?: string[]
}

function charsToTokens(chars: number): number {
  return Math.ceil(chars / BYTES_PER_TOKEN)
}

function estimateFile(filePath: string, warnings: string[]): { tokens: number; resolved: boolean } {
  try {
    const stat = statSync(filePath)
    const mtime = stat.mtimeMs

    const cached = fileCache.get(filePath)
    if (cached && cached.mtime === mtime) {
      return { tokens: cached.tokens, resolved: true }
    }

    // Avoid loading potentially very large files into memory. The byte size is
    // the closest available stat-only approximation of character count.
    const tokens =
      stat.size > LARGE_FILE_BYTES
        ? charsToTokens(stat.size)
        : charsToTokens(readFileSync(filePath, 'utf8').length)

    fileCache.set(filePath, { mtime, tokens })
    return { tokens, resolved: true }
  } catch {
    warnings.push(
      `Target file not found or unreadable: ${filePath} (using ${MISSING_FILE_FALLBACK} token fallback)`
    )
    return { tokens: MISSING_FILE_FALLBACK, resolved: false }
  }
}

function resolveSkillFile(skill: string): string {
  if (skill.endsWith('/SKILL.md') || skill.endsWith('\\SKILL.md')) return skill

  // The estimator accepts the skill directory as well as a SKILL.md path.
  // Keep the resolution local and deterministic; callers can pass an absolute
  // path when the skill is outside the current working directory.
  return join(skill, 'SKILL.md')
}

function estimateSkill(skill: string, warnings: string[]): { tokens: number; resolved: boolean } {
  const skillFile = resolveSkillFile(skill)

  if (!existsSync(skillFile)) {
    warnings.push(`Skill not found: ${skill} (using ${MISSING_SKILL_FALLBACK} token fallback)`)
    return { tokens: MISSING_SKILL_FALLBACK, resolved: false }
  }

  try {
    return { tokens: charsToTokens(readFileSync(skillFile, 'utf8').length), resolved: true }
  } catch {
    warnings.push(
      `Skill not found or unreadable: ${skill} (using ${MISSING_SKILL_FALLBACK} token fallback)`
    )
    return { tokens: MISSING_SKILL_FALLBACK, resolved: false }
  }
}

/**
 * Estimate the input context for a task without application or persistence
 * dependencies. File and skill paths are intentionally resolved at call time
 * so this engine can be reused by MCP handlers and tests.
 */
export function estimateTokens(input: TokenEstimatorInput): TokenEstimation {
  const warnings: string[] = []
  const descriptionTokens = charsToTokens((input.description ?? '').length)
  const targetFiles = input.targetFiles ?? []
  const skills = input.skills ?? []

  let resolvedSources = 0
  let sourceCount = targetFiles.length + skills.length
  let targetFileTokens = 0
  let skillTokens = 0

  for (const filePath of targetFiles) {
    const estimate = estimateFile(filePath, warnings)
    targetFileTokens += estimate.tokens
    if (estimate.resolved) resolvedSources++
  }

  for (const skill of skills) {
    const estimate = estimateSkill(skill, warnings)
    skillTokens += estimate.tokens
    if (estimate.resolved) resolvedSources++
  }

  // A task with no external sources has no unresolved source data.
  if (sourceCount === 0) {
    sourceCount = 1
    resolvedSources = 1
  }

  const breakdown: TokenEstimationBreakdown = {
    taskDescription: descriptionTokens,
    targetFiles: targetFileTokens,
    skills: skillTokens,
    systemContext: SYSTEM_CONTEXT_TOKENS,
    responseOverhead: 0,
    safetyMargin: 0
  }

  const subtotal =
    breakdown.taskDescription + breakdown.targetFiles + breakdown.skills + breakdown.systemContext
  breakdown.responseOverhead = Math.ceil(subtotal * RESPONSE_OVERHEAD_RATE)
  breakdown.safetyMargin = Math.ceil(subtotal * SAFETY_MARGIN_RATE)

  const confidenceRatio = resolvedSources / sourceCount
  const confidence: TokenEstimation['confidence'] =
    confidenceRatio === 1 ? 'high' : confidenceRatio > 0.5 ? 'medium' : 'low'

  return {
    estimatedTokens: subtotal + breakdown.responseOverhead + breakdown.safetyMargin,
    breakdown,
    confidence,
    warnings
  }
}

export default estimateTokens
