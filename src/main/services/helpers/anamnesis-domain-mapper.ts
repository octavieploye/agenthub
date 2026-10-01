import {
  DEFAULT_DOMAIN_CATEGORY,
  isAnamnesisDomainCategory,
  type AnamnesisDomainCategory
} from '../../../shared/constants/anamnesis-domains'
import type { BrainEntryType } from '../../../shared/types/brain.types'

/** AH task categories that are not already one of the 7 shared categories. */
const TASK_CATEGORY_MAP: Record<string, AnamnesisDomainCategory> = {
  backend: 'code',
  frontend: 'code',
  database: 'code',
  schema: 'code',
  functionality: 'code'
}

/** Brain entry types that map to a specific category; the rest fall back to the default. */
const BRAIN_TYPE_MAP: Partial<Record<BrainEntryType, AnamnesisDomainCategory>> = {
  strategy: 'strategy',
  marketing: 'marketing',
  'how-to': 'operations',
  reference: 'operations'
}

/** Map an AH task category (free-form, nullable) to one of the 7 shared domain categories. */
export function mapTaskCategoryToDomainCategory(
  category: string | null | undefined
): AnamnesisDomainCategory {
  if (isAnamnesisDomainCategory(category)) return category
  if (category && Object.hasOwn(TASK_CATEGORY_MAP, category)) return TASK_CATEGORY_MAP[category]
  return DEFAULT_DOMAIN_CATEGORY
}

/** Map a brain entry type to one of the 7 shared domain categories. */
export function mapBrainTypeToDomainCategory(type: BrainEntryType): AnamnesisDomainCategory {
  return BRAIN_TYPE_MAP[type] ?? DEFAULT_DOMAIN_CATEGORY
}
