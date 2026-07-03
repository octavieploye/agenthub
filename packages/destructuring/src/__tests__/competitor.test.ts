import { describe, it, expect } from 'vitest';
import {
  CompetitorCardSchema,
  CompetitorProfileSchema,
  CompetitorMapSchema,
} from '../schemas/competitor.schema.js';
import * as competitorScanner from '../workflows/competitor-strategies/agents/competitor-scanner.js';
import * as strategyExtractor from '../workflows/competitor-strategies/agents/strategy-extractor.js';

const validCard = {
  name: 'Cursor',
  url: 'https://cursor.com',
  geoRing: 'worldwide' as const,
  location: 'San Francisco, US',
  category: 'direct' as const,
  audienceServed: 'developers',
  coreValueProp: 'AI-powered code editor',
  pricingModel: 'freemium $20/mo',
  deploymentModel: 'local' as const,
  keyWeakness: 'No multi-agent orchestration',
  keyStrength: 'Fast inline code generation',
  switchingCost: 'low' as const,
};

const validProfile = {
  ...validCard,
  acquisitionChannels: ['Twitter/X', 'Hacker News', 'word of mouth'],
  techStack: ['Electron', 'TypeScript', 'Anthropic API'],
  moat: 'First-mover in AI code editor space, strong brand with developers',
  gaps: ['No multi-repo support', 'No team management'],
  complaints: ['Expensive for teams', 'Sometimes generates wrong code'],
};

describe('CompetitorCardSchema', () => {
  it('accepts a valid card', () => {
    const result = CompetitorCardSchema.parse(validCard);
    expect(result.name).toBe('Cursor');
  });

  it('rejects missing name', () => {
    const { name, ...noName } = validCard;
    expect(() => CompetitorCardSchema.parse(noName)).toThrow();
  });

  it('rejects invalid category', () => {
    expect(() =>
      CompetitorCardSchema.parse({ ...validCard, category: 'frenemy' })
    ).toThrow();
  });
});

describe('CompetitorProfileSchema', () => {
  it('accepts a valid profile', () => {
    const result = CompetitorProfileSchema.parse(validProfile);
    expect(result.acquisitionChannels).toHaveLength(3);
  });

  it('rejects profile missing gaps array', () => {
    const { gaps, ...noGaps } = validProfile;
    expect(() => CompetitorProfileSchema.parse(noGaps)).toThrow();
  });
});

describe('CompetitorMapSchema', () => {
  it('accepts a valid map', () => {
    const map = {
      subject: 'AgentHub',
      geoBase: 'Lyon, FR',
      rings: [
        { radius: 'local' as const, label: 'Local', competitors: [] },
        { radius: 'continental' as const, label: 'EU', competitors: [validProfile] },
      ],
      totalCompetitors: 1,
    };
    const result = CompetitorMapSchema.parse(map);
    expect(result.totalCompetitors).toBe(1);
  });
});

describe('competitorScanner.buildPrompt', () => {
  it('produces system + user messages', () => {
    const messages = competitorScanner.buildPrompt({
      name: 'AgentHub',
      description: 'AI agent orchestrator',
      geoBase: 'Lyon, FR',
      geoRadius: 'continental',
      sector: 'developer-tools',
    });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('AgentHub');
    expect(messages[1].content).toContain('Lyon, FR');
    expect(messages[1].content).toContain('continental');
  });
});

describe('competitorScanner.parseOutput', () => {
  it('parses valid JSON array from raw LLM response', () => {
    const raw = `Here are the competitors I found:\n${JSON.stringify([validCard])}`;
    const result = competitorScanner.parseOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Cursor');
  });

  it('throws on non-JSON response', () => {
    expect(() => competitorScanner.parseOutput('No competitors found')).toThrow();
  });
});

describe('strategyExtractor.buildPrompt', () => {
  it('includes competitor names in prompt', () => {
    const messages = strategyExtractor.buildPrompt([validCard]);
    expect(messages[1].content).toContain('Cursor');
  });
});
