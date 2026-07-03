import { describe, it, expect } from 'vitest';
import {
  MarketPositionSchema,
  OfferTierSchema,
  BusinessProfileSchema,
} from '../schemas/business.schema.js';
import * as marketPositioner from '../workflows/business-strategies/agents/market-positioner.js';
import * as offerArchitect from '../workflows/business-strategies/agents/offer-architect.js';

describe('MarketPositionSchema', () => {
  it('accepts valid position', () => {
    const result = MarketPositionSchema.parse({
      nicheDefinition: 'Multi-agent AI orchestration for solo developers',
      differentiationStatement: 'Local-first sovereignty with multi-agent control',
      competitiveMoat: 'Cascade architecture — no competitor has this pipeline',
      targetSegment: 'Solo developers managing multiple AI coding agents',
    });
    expect(result.nicheDefinition).toContain('Multi-agent');
  });

  it('rejects empty niche', () => {
    expect(() =>
      MarketPositionSchema.parse({
        nicheDefinition: '',
        differentiationStatement: 'x',
        competitiveMoat: 'x',
        targetSegment: 'x',
      })
    ).toThrow();
  });
});

describe('OfferTierSchema', () => {
  it('accepts valid tier', () => {
    const result = OfferTierSchema.parse({
      name: 'Pro',
      price: '29',
      currency: 'EUR',
      billingCycle: 'monthly',
      valueProposition: 'Full agent orchestration',
      includedFeatures: ['unlimited agents', 'breakout terminals'],
      excludedFeatures: ['team features'],
      dreamOutcome: 'Ship 3x faster with AI team coordination',
    });
    expect(result.billingCycle).toBe('monthly');
  });

  it('rejects invalid billing cycle', () => {
    expect(() =>
      OfferTierSchema.parse({
        name: 'Pro',
        price: '29',
        currency: 'EUR',
        billingCycle: 'weekly',
        valueProposition: 'x',
        includedFeatures: [],
        excludedFeatures: [],
        dreamOutcome: 'x',
      })
    ).toThrow();
  });
});

describe('marketPositioner.buildPrompt', () => {
  it('includes subject info and competitor context when available', () => {
    const messages = marketPositioner.buildPrompt({
      name: 'AgentHub',
      description: 'AI agent orchestrator',
      geoBase: 'Lyon, FR',
      geoRadius: 'continental',
      sector: 'developer-tools',
      priorOutputs: {
        competitorMap: { subject: 'AgentHub', geoBase: 'Lyon, FR', rings: [], totalCompetitors: 0 },
      },
    });
    expect(messages[1].content).toContain('AgentHub');
    expect(messages[1].content).toContain('COMPETITOR MAP');
  });

  it('notes absence of competitor map', () => {
    const messages = marketPositioner.buildPrompt({
      name: 'AgentHub',
      description: 'AI agent orchestrator',
      geoBase: 'Lyon, FR',
      geoRadius: 'continental',
      sector: 'developer-tools',
    });
    expect(messages[1].content).toContain('No competitor map available');
  });
});

describe('offerArchitect.buildPrompt', () => {
  it('includes position context', () => {
    const position = {
      nicheDefinition: 'test',
      differentiationStatement: 'test',
      competitiveMoat: 'test',
      targetSegment: 'test',
    };
    const messages = offerArchitect.buildPrompt(
      { name: 'X', description: 'Y', geoBase: 'Z', geoRadius: 'local' as const, sector: 'A' },
      position
    );
    expect(messages[1].content).toContain('MARKET POSITION');
  });
});

describe('BusinessProfileSchema', () => {
  it('accepts a complete valid profile', () => {
    const result = BusinessProfileSchema.parse({
      subject: 'AgentHub',
      position: {
        nicheDefinition: 'Multi-agent AI orchestration for solo developers',
        differentiationStatement: 'Local-first sovereignty',
        competitiveMoat: 'Cascade architecture',
        targetSegment: 'Solo developers',
      },
      offerTiers: [
        {
          name: 'Starter',
          price: '0',
          currency: 'EUR',
          billingCycle: 'monthly',
          valueProposition: 'Try it free',
          includedFeatures: ['3 agents'],
          excludedFeatures: ['breakout terminals'],
          dreamOutcome: 'Experience AI coordination',
        },
        {
          name: 'Pro',
          price: '29',
          currency: 'EUR',
          billingCycle: 'monthly',
          valueProposition: 'Full orchestration',
          includedFeatures: ['unlimited agents', 'breakout terminals'],
          excludedFeatures: ['team features'],
          dreamOutcome: 'Ship 3x faster',
        },
      ],
      acquisitionChannels: [
        {
          channel: 'GitHub README',
          type: 'owned',
          personaTarget: 'Solo developer with active OSS repos',
          estimatedCostPerAcquisition: '$0',
          funnelShape: 'Wide top, high-intent visitors',
        },
      ],
      unitEconomics: {
        ltv: '$348 (12 months Pro)',
        cac: '$12 blended',
        paybackPeriodMonths: 1,
        marginPerTier: { Starter: '0%', Pro: '85%' },
        churnRateEstimate: '3% monthly',
      },
      monetization: {
        pricingArchitecture: 'Freemium to Pro funnel',
        upsellLogic: 'Agent cap hit triggers Pro prompt',
        churnAssumptions: ['Monthly churn under 5%'],
        expansionRevenuePaths: ['Team tier', 'Managed hosting'],
      },
    });
    expect(result.subject).toBe('AgentHub');
    expect(result.offerTiers).toHaveLength(2);
  });

  it('rejects profile with empty offer tiers', () => {
    expect(() =>
      BusinessProfileSchema.parse({
        subject: 'Test',
        position: {
          nicheDefinition: 'x',
          differentiationStatement: 'x',
          competitiveMoat: 'x',
          targetSegment: 'x',
        },
        offerTiers: [],
        acquisitionChannels: [],
        unitEconomics: {
          ltv: 'x',
          cac: 'x',
          paybackPeriodMonths: 0,
          marginPerTier: {},
          churnRateEstimate: 'x',
        },
        monetization: {
          pricingArchitecture: 'x',
          upsellLogic: 'x',
          churnAssumptions: [],
          expansionRevenuePaths: [],
        },
      })
    ).toThrow();
  });
});
