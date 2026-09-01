import type { SkillItem } from '../../shared/types/skills.types'

export interface ClassificationResult {
  domain: string
  matchedSkills: Array<{ id: string; score: number; reason: string }>
  complexity: 'simple' | 'moderate' | 'complex'
  securitySensitive: boolean
  scope: 'single-file' | 'multi-file' | 'cross-repo'
  fallbackMode?: 'ask' | 'best-effort'
}

// ─── Complexity keyword tables ─────────────────────────────────────────────

const SIMPLE_KEYWORDS = ['fix', 'patch', 'typo', 'rename']
const MODERATE_KEYWORDS = ['feature', 'implement', 'add', 'refactor']
const COMPLEX_KEYWORDS = ['architecture', 'redesign', 'migrate', 'orchestrat']

function deriveComplexity(task: string): 'simple' | 'moderate' | 'complex' {
  const lower = task.toLowerCase()

  for (const kw of COMPLEX_KEYWORDS) {
    if (lower.includes(kw)) return 'complex'
  }

  for (const kw of MODERATE_KEYWORDS) {
    if (lower.includes(kw)) return 'moderate'
  }

  for (const kw of SIMPLE_KEYWORDS) {
    if (lower.includes(kw)) return 'simple'
  }

  return 'moderate'
}

// ─── Scope resolution ──────────────────────────────────────────────────────

function deriveScope(targetFiles: string[]): 'single-file' | 'multi-file' | 'cross-repo' {
  if (targetFiles.length === 0) return 'single-file'
  if (targetFiles.length <= 5) return 'multi-file'
  return 'cross-repo'
}

// ─── Pattern matching ──────────────────────────────────────────────────────

/**
 * Case-insensitive substring match.
 * Returns true if `pattern` appears anywhere in `text` (lowercased).
 */
function patternMatches(pattern: string, text: string): boolean {
  return text.toLowerCase().includes(pattern.toLowerCase())
}

// ─── Classifier ────────────────────────────────────────────────────────────

export function classifyTask(
  taskDescription: string,
  targetFiles: string[],
  skills: SkillItem[],
  _repoId?: string
): ClassificationResult {
  const withManifest = skills.filter((s) => s.manifest != null)

  // Score each skill by summing trigger weights for matching patterns
  const scored = withManifest.map((skill) => {
    const manifest = skill.manifest!
    let score = 0
    const matchedPatterns: string[] = []

    for (const trigger of manifest.triggers) {
      if (patternMatches(trigger.pattern, taskDescription)) {
        score += trigger.weight
        matchedPatterns.push(trigger.pattern)
      }
    }

    const reason =
      matchedPatterns.length > 0
        ? `Matched trigger(s): ${matchedPatterns.join(', ')}`
        : 'No trigger matched'

    return { skill, score, reason }
  })

  // Sort descending by score, take top 3 with score > 0
  const ranked = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const matchedSkills = ranked.map((entry) => ({
    id: entry.skill.id,
    score: entry.score,
    reason: entry.reason,
  }))

  // Domain: use top match's manifest domain, or empty string when no match
  const domain = ranked.length > 0 ? ranked[0].skill.manifest!.domain : ''

  // securitySensitive: OR across all matched skills' manifests
  const securitySensitive = ranked.some((entry) => entry.skill.manifest!.securitySensitive)

  const complexity = deriveComplexity(taskDescription)
  const scope = deriveScope(targetFiles)

  // fallbackMode: 'ask' when no skill scored > 0
  const fallbackMode = ranked.length === 0 ? 'ask' : undefined

  return {
    domain,
    matchedSkills,
    complexity,
    securitySensitive,
    scope,
    ...(fallbackMode !== undefined && { fallbackMode }),
  }
}
