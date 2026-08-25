import type { IssueSeverity } from '../../../shared/types/orchestrator.types'

export type SecurityRecommendation = 'pass' | 'block' | 'review'

export interface SecurityFinding {
  severity: IssueSeverity
  category: string
  description: string
  file?: string
  line?: number
}

export interface SecurityParseResult {
  recommendation: SecurityRecommendation
  findings: SecurityFinding[]
  hasCritical: boolean
  hasHigh: boolean
  raw: string | null
}

const VALID_RECOMMENDATIONS = new Set<SecurityRecommendation>(['pass', 'block', 'review'])
const VALID_SEVERITIES = new Set<IssueSeverity>(['critical', 'high', 'medium', 'low'])

/**
 * Extract the last JSON object from raw agent output text.
 * The agent is prompted to output `{ "findings": [...], "recommendation": "pass|block|review" }`.
 * The output may contain ANSI codes, markdown, prose before/after the JSON.
 */
function extractLastJson(text: string): Record<string, unknown> | null {
  // Find all potential JSON objects (greedy brace matching from last occurrence)
  let depth = 0
  let end = -1
  let start = -1

  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === '}') {
      if (end === -1) end = i
      depth++
    } else if (text[i] === '{') {
      depth--
      if (depth === 0 && end !== -1) {
        start = i
        break
      }
    }
  }

  if (start === -1 || end === -1) return null

  const candidate = text.slice(start, end + 1)
  try {
    return JSON.parse(candidate) as Record<string, unknown>
  } catch {
    return null
  }
}

function parseFinding(raw: unknown): SecurityFinding | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  const severity = typeof obj.severity === 'string' ? obj.severity.toLowerCase() : 'medium'
  const category = typeof obj.category === 'string' ? obj.category : 'unknown'
  const description = typeof obj.description === 'string' ? obj.description : ''

  if (!description) return null

  return {
    severity: VALID_SEVERITIES.has(severity as IssueSeverity) ? severity as IssueSeverity : 'medium',
    category,
    description,
    file: typeof obj.file === 'string' ? obj.file : undefined,
    line: typeof obj.line === 'number' ? obj.line : undefined,
  }
}

/**
 * Parse security phase output from agent text buffer.
 * Returns a structured result with recommendation and findings.
 * If parsing fails, defaults to 'review' (safe: forces human check).
 */
export function parseSecurityOutput(agentOutput: string | null): SecurityParseResult {
  const defaultResult: SecurityParseResult = {
    recommendation: 'review',
    findings: [],
    hasCritical: false,
    hasHigh: false,
    raw: agentOutput,
  }

  if (!agentOutput || agentOutput.trim().length === 0) {
    return defaultResult
  }

  const json = extractLastJson(agentOutput)
  if (!json) return defaultResult

  // Extract recommendation
  const rawRec = typeof json.recommendation === 'string'
    ? json.recommendation.toLowerCase().trim()
    : null
  const recommendation: SecurityRecommendation = rawRec && VALID_RECOMMENDATIONS.has(rawRec as SecurityRecommendation)
    ? rawRec as SecurityRecommendation
    : 'review'

  // Extract findings
  const findings: SecurityFinding[] = []
  if (Array.isArray(json.findings)) {
    for (const rawFinding of json.findings) {
      const parsed = parseFinding(rawFinding)
      if (parsed) findings.push(parsed)
    }
  }

  const hasCritical = findings.some(f => f.severity === 'critical')
  const hasHigh = findings.some(f => f.severity === 'high')

  return { recommendation, findings, hasCritical, hasHigh, raw: agentOutput }
}
