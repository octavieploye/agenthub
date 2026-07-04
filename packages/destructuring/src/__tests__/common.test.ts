import { describe, it, expect } from 'vitest';
import {
  DestructuringSubjectSchema,
  PatternExtractionInputSchema,
  GeoRadiusSchema,
} from '../schemas/common.schema.js';

describe('GeoRadiusSchema', () => {
  it('accepts valid radius values', () => {
    expect(GeoRadiusSchema.parse('local')).toBe('local');
    expect(GeoRadiusSchema.parse('national')).toBe('national');
    expect(GeoRadiusSchema.parse('continental')).toBe('continental');
    expect(GeoRadiusSchema.parse('worldwide')).toBe('worldwide');
  });

  it('rejects invalid radius', () => {
    expect(() => GeoRadiusSchema.parse('galaxy')).toThrow();
  });
});

describe('DestructuringSubjectSchema', () => {
  const validSubject = {
    name: 'AgentHub',
    description: 'AI agent orchestrator',
    geoBase: 'Lyon, FR',
    geoRadius: 'continental' as const,
    sector: 'developer-tools',
  };

  it('accepts valid subject', () => {
    const result = DestructuringSubjectSchema.parse(validSubject);
    expect(result.name).toBe('AgentHub');
  });

  it('accepts subject with priorOutputs', () => {
    const result = DestructuringSubjectSchema.parse({
      ...validSubject,
      priorOutputs: {
        competitorMap: {
          subject: 'AgentHub',
          geoBase: 'Lyon, FR',
          rings: [],
          totalCompetitors: 0,
        },
      },
    });
    expect(result.priorOutputs).toBeDefined();
  });

  it('rejects empty name', () => {
    expect(() =>
      DestructuringSubjectSchema.parse({ ...validSubject, name: '' })
    ).toThrow();
  });

  it('rejects missing sector', () => {
    const { sector, ...noSector } = validSubject;
    expect(() => DestructuringSubjectSchema.parse(noSector)).toThrow();
  });
});

describe('PatternExtractionInputSchema', () => {
  const subject = {
    name: 'Test',
    description: 'Test subject',
    geoBase: 'Paris, FR',
    geoRadius: 'national' as const,
    sector: 'saas',
  };

  it('accepts valid input with 2+ subjects', () => {
    const result = PatternExtractionInputSchema.parse({
      subjects: [subject, { ...subject, name: 'Test2' }],
      outputs: [{}, {}],
    });
    expect(result.subjects).toHaveLength(2);
  });

  it('rejects single subject', () => {
    expect(() =>
      PatternExtractionInputSchema.parse({
        subjects: [subject],
        outputs: [{}],
      })
    ).toThrow();
  });

  it('accepts optional focusQuestion', () => {
    const result = PatternExtractionInputSchema.parse({
      subjects: [subject, { ...subject, name: 'Test2' }],
      outputs: [{}, {}],
      focusQuestion: 'What pricing pattern wins in EU SaaS?',
    });
    expect(result.focusQuestion).toBe('What pricing pattern wins in EU SaaS?');
  });
});
