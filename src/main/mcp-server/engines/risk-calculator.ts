import type { RiskAssessment } from '@shared/types/mcp-server.types'

// Destructive patterns sourced from .claude/commands/destructive-commands-ban.md
// All shell command patterns are case-insensitive (/i) to catch uppercase variants (e.g. KILL -9).
// R-003 fix: DELETE pattern has no semicolon requirement — ORM/inline SQL rarely terminates with ;
// R-002 fix: added rm -r (no -f), mv /dev/null, rm .ssh, rm .env, git stash drop
const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /git\s+clean/i,
  /rm\s+(-[a-zA-Z]*f|-[a-zA-Z]*r)/i,
  /rm\s+-rf/i,
  /rm\s+-r\b/i,
  /find\s+.*-delete/i,
  /find\s+.*-exec\s+rm/i,
  /mv\s+.*\/dev\/null/i,
  /rm\s+.*\.ssh/i,
  /rm\s+.*\.env/i,
  /git\s+reset\s+--hard/i,
  /git\s+push\s+(--force|--force-with-lease|-f)/i,
  /git\s+rebase/i,
  /git\s+checkout\s+\./i,
  /git\s+restore\s+\./i,
  /git\s+branch\s+-D/i,
  /git\s+stash\s+drop/i,
  /DROP\s+TABLE/i,
  /TRUNCATE\s+TABLE/i,
  /DELETE\s+FROM\s+\w+/i,
  /docker\s+system\s+prune/i,
  /docker\s+volume\s+(rm|prune)/i,
  /docker\s+rm\s+-[a-zA-Z]*v/i,
  /kill\s+-9/i,
  /pkill\s+-9/i,
  /killall\s+-9/i,
  /shred\s+/i,
  /dd\s+if=\/dev\/zero/i,
  /truncate\s+-s\s+0/i,
  /git\s+reflog\s+expire/i,
  /git\s+gc\s+--prune/i,
]

// R4: >MODERATE_CEILING files = moderate (+0.05), >MODERATE_CEILING and <=HIGH_CEILING is moderate,
// >HIGH_CEILING = high (+0.10). Spec: 4–10 files = moderate, 11+ = high.
const FILE_COUNT_HIGH_CEILING = 10
const FILE_COUNT_MODERATE_FLOOR = 3
const TOKEN_HIGH_THRESHOLD = 50_000
const TOKEN_MODERATE_THRESHOLD = 20_000

/**
 * Pure risk-scoring engine — no Electron, no DB dependencies.
 *
 * NOTE (R-001 — S3 handler responsibility):
 * `RiskCalculatorInput` is intentionally separate from `CreateTaskToolInput`.
 * The S3 handler must explicitly map fields and inject `estimatedTokens` after
 * running the token estimator. `repoId` is not needed by this engine.
 *
 * `protectedPaths` and `supervisedCategories` are engine configuration, not
 * per-task data. R2 and R3 silently no-op when these are omitted — callers
 * must supply them from the active guardrail config for those rules to fire.
 */
export interface RiskCalculatorInput {
  description?: string
  targetFiles?: string[]
  skills?: string[]
  category?: string
  requiresApproval?: boolean
  /** Inject from token estimator output — required for R5 to fire */
  estimatedTokens?: number
  /** Engine config: R2 fires only when supplied. Source: active GuardrailConfig */
  protectedPaths?: string[]
  /** Engine config: R3 fires only when supplied. Source: active GuardrailConfig */
  supervisedCategories?: string[]
}

function uniqueDirectories(files: string[]): Set<string> {
  const dirs = new Set<string>()
  for (const f of files) {
    const slash = f.lastIndexOf('/')
    dirs.add(slash > 0 ? f.slice(0, slash) : '.')
  }
  return dirs
}

export function calculateRisk(input: RiskCalculatorInput): RiskAssessment {
  const riskFactors: string[] = []
  let score = 0

  const description = input.description ?? ''
  const targetFiles = input.targetFiles ?? []
  const protectedPaths = input.protectedPaths ?? []
  const supervisedCategories = input.supervisedCategories ?? []

  // R1 — Destructive command pattern detected (+0.30)
  const textToScan = [description, ...(input.skills ?? [])].join(' ')
  if (DESTRUCTIVE_PATTERNS.some((re) => re.test(textToScan))) {
    score += 0.3
    riskFactors.push('R1: Destructive command pattern detected in task description')
  }

  // R2 — Target file matches a protected path (+0.25)
  if (
    protectedPaths.length > 0 &&
    targetFiles.some((file) => protectedPaths.some((pp) => file === pp || file.startsWith(pp + '/')))
  ) {
    score += 0.25
    riskFactors.push('R2: Task targets one or more protected paths')
  }

  // R3 — Supervised category without approval gate (+0.15)
  if (input.category && supervisedCategories.includes(input.category) && !input.requiresApproval) {
    score += 0.15
    riskFactors.push(
      `R3: Category "${input.category}" is supervised but requiresApproval is not set`
    )
  }

  // R4 — File count (+0.05 for 4–10 files, +0.10 for 11+)
  if (targetFiles.length > FILE_COUNT_HIGH_CEILING) {
    score += 0.1
    riskFactors.push(`R4: High file count (${targetFiles.length} files)`)
  } else if (targetFiles.length > FILE_COUNT_MODERATE_FLOOR) {
    score += 0.05
    riskFactors.push(`R4: Moderate file count (${targetFiles.length} files)`)
  }

  // R5 — Token budget (+0.05 for 20K–50K tokens, +0.10 for >50K)
  // R-010 fix: guard against NaN (typeof check + isNaN) in addition to undefined
  const tokens = input.estimatedTokens
  if (typeof tokens === 'number' && !Number.isNaN(tokens)) {
    if (tokens > TOKEN_HIGH_THRESHOLD) {
      score += 0.1
      riskFactors.push(`R5: Very high token budget (${tokens.toLocaleString()} tokens)`)
    } else if (tokens > TOKEN_MODERATE_THRESHOLD) {
      score += 0.05
      riskFactors.push(`R5: High token budget (${tokens.toLocaleString()} tokens)`)
    }
  }

  // R6 — No description (+0.05)
  if (!description.trim()) {
    score += 0.05
    riskFactors.push('R6: Task has no description')
  }

  // R7 — Cross-directory scope (+0.05)
  // R-006 fix: compute once, reuse result
  const dirs = uniqueDirectories(targetFiles)
  if (targetFiles.length > 1 && dirs.size > 1) {
    score += 0.05
    riskFactors.push(`R7: Task spans ${dirs.size} directories`)
  }

  const riskScore = Math.min(1.0, Math.round(score * 100) / 100)
  const riskLevel: 'high' | 'medium' | 'low' =
    riskScore >= 0.7 ? 'high' : riskScore >= 0.35 ? 'medium' : 'low'

  return { riskScore, riskFactors, riskLevel }
}
