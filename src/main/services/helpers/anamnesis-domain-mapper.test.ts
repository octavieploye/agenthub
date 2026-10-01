import { describe, it, expect } from 'vitest'
import {
  ANAMNESIS_DOMAIN_CATEGORIES,
  DEFAULT_DOMAIN_CATEGORY,
  isAnamnesisDomainCategory
} from '../../../shared/constants/anamnesis-domains'
import { mapBrainTypeToDomainCategory, mapTaskCategoryToDomainCategory } from './anamnesis-domain-mapper'
import { KNOWN_CATEGORIES } from '../../../shared/types/task.types'
import type { BrainEntryType } from '../../../shared/types/brain.types'

const SEVEN_CATEGORIES = ['code', 'business', 'marketing', 'strategy', 'client', 'legal', 'operations']

describe('anamnesis domain constants', () => {
  it('declares exactly the 7 shared domain categories', () => {
    expect([...ANAMNESIS_DOMAIN_CATEGORIES].sort()).toEqual([...SEVEN_CATEGORIES].sort())
  })

  it('defaults to code', () => {
    expect(DEFAULT_DOMAIN_CATEGORY).toBe('code')
  })

  it('isAnamnesisDomainCategory accepts the 7 values and rejects anything else', () => {
    for (const category of SEVEN_CATEGORIES) expect(isAnamnesisDomainCategory(category)).toBe(true)
    expect(isAnamnesisDomainCategory('backend')).toBe(false)
    expect(isAnamnesisDomainCategory('')).toBe(false)
    expect(isAnamnesisDomainCategory(null)).toBe(false)
  })
})

describe('mapTaskCategoryToDomainCategory', () => {
  it.each(SEVEN_CATEGORIES)('passes the shared category "%s" through unchanged', (category) => {
    expect(mapTaskCategoryToDomainCategory(category)).toBe(category)
  })

  it.each(['backend', 'frontend', 'database', 'schema', 'functionality'])(
    'maps the code-like task category "%s" to code',
    (category) => {
      expect(mapTaskCategoryToDomainCategory(category)).toBe('code')
    }
  )

  it('maps the marketing task category to marketing', () => {
    expect(mapTaskCategoryToDomainCategory('marketing')).toBe('marketing')
  })

  it('maps the business task category to business', () => {
    expect(mapTaskCategoryToDomainCategory('business')).toBe('business')
  })

  it.each([null, undefined, '', 'not-a-known-category'])('falls back to code for %j', (category) => {
    expect(mapTaskCategoryToDomainCategory(category)).toBe('code')
  })

  it('returns one of the 7 shared categories for every known task category', () => {
    for (const category of KNOWN_CATEGORIES) {
      expect(SEVEN_CATEGORIES).toContain(mapTaskCategoryToDomainCategory(category))
    }
  })
})

describe('mapBrainTypeToDomainCategory', () => {
  it('maps strategy 1:1', () => {
    expect(mapBrainTypeToDomainCategory('strategy')).toBe('strategy')
  })

  it('maps marketing 1:1', () => {
    expect(mapBrainTypeToDomainCategory('marketing')).toBe('marketing')
  })

  it('maps how-to to operations', () => {
    expect(mapBrainTypeToDomainCategory('how-to')).toBe('operations')
  })

  it('maps reference to operations', () => {
    expect(mapBrainTypeToDomainCategory('reference')).toBe('operations')
  })

  it('returns one of the 7 shared categories for every brain entry type', () => {
    const allTypes: BrainEntryType[] = [
      'brainstorm', 'spec', 'plan', 'sprint', 'strategy', 'marketing', 'how-to', 'reference', 'learning'
    ]
    for (const type of allTypes) {
      expect(SEVEN_CATEGORIES).toContain(mapBrainTypeToDomainCategory(type))
    }
  })
})
