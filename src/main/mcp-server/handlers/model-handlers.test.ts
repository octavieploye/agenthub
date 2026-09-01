import { describe, expect, it } from 'vitest'
import {
  assessComplexity,
  getQuotaZone,
  handleEstimateTokens,
  handleRecommendModel
} from './model-handlers'

describe('model handlers', () => {
  describe('assessComplexity', () => {
    it.each([
      ['refactor the authentication flow', 'complex'],
      ['review the system architecture', 'complex'],
      ['migrate the database', 'complex'],
      ['redesign the payment page', 'complex'],
      ['fix the login button', 'simple'],
      ['update the README', 'simple'],
      ['implement a user profile page', 'moderate']
    ])('classifies "%s" as %s', (description, expected) => {
      expect(assessComplexity(description)).toBe(expected)
    })

    it('is case-insensitive', () => {
      expect(assessComplexity('REFACTOR the entire codebase')).toBe('complex')
    })
  })

  describe('getQuotaZone', () => {
    it.each([
      [0, 'healthy'],
      [59, 'healthy'],
      [60, 'moderate'],
      [79, 'moderate'],
      [80, 'hot'],
      [100, 'hot']
    ])('maps %d%% quota usage to the %s zone', (quotaPercent, expected) => {
      expect(getQuotaZone(quotaPercent)).toBe(expected)
    })
  })

  describe('handleEstimateTokens', () => {
    it('delegates task context estimation and returns its breakdown', () => {
      const result = handleEstimateTokens({
        description: 'A'.repeat(100)
      })

      expect(result.estimatedTokens).toBeGreaterThan(0)
      expect(result.breakdown.taskDescription).toBe(25)
      expect(result.breakdown.systemContext).toBe(4900)
      expect(result.warnings).toEqual([])
    })
  })

  describe('handleRecommendModel', () => {
    it.each([
      [0.7, 'frontier'],
      [0.9, 'frontier'],
      [0.4, 'expert'],
      [0.69, 'expert'],
      [0.39, 'capable'],
      [0, 'capable']
    ])('selects the %s capability tier for risk score %s', (riskScore, expectedTier) => {
      const result = handleRecommendModel({
        description: 'implement a feature',
        riskScore
      })

      expect(result.capabilityTier).toBe(expectedTier)
      expect(result.riskAdjusted).toBe(true)
    })

    it('uses the supplied estimate when recommending a model', () => {
      const result = handleRecommendModel({
        description: 'implement a feature',
        estimatedTokens: 12_345,
        riskScore: 0.2
      })

      expect(result.estimatedTokens).toBe(12_345)
    })
  })
})
