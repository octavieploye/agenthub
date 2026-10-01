/**
 * The 7 shared Anamnesis domain categories (shared-brain brief, decision 2).
 * Mirrors `DOMAINS` in anamnesis `models/decision_constants.py` — keep both in sync.
 * Used for `domain_category` on writer payloads and as the project-status domain.
 */
export const ANAMNESIS_DOMAIN_CATEGORIES = [
  'code',
  'business',
  'marketing',
  'strategy',
  'client',
  'legal',
  'operations'
] as const

export type AnamnesisDomainCategory = (typeof ANAMNESIS_DOMAIN_CATEGORIES)[number]

export const DEFAULT_DOMAIN_CATEGORY: AnamnesisDomainCategory = 'code'

export function isAnamnesisDomainCategory(value: unknown): value is AnamnesisDomainCategory {
  return (
    typeof value === 'string' && (ANAMNESIS_DOMAIN_CATEGORIES as readonly string[]).includes(value)
  )
}
