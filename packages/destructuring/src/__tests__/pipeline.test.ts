import { describe, it, expect } from 'vitest';
import { buildHandoff, stagesFromEntry, STAGE_ORDER } from '../compose/handoffs.js';

describe('STAGE_ORDER', () => {
  it('follows micro-to-macro order', () => {
    expect(STAGE_ORDER).toEqual([
      'competitor',
      'business',
      'market',
      'dynamics',
      'patterns',
    ]);
  });
});

describe('stagesFromEntry', () => {
  it('returns all stages from competitor', () => {
    expect(stagesFromEntry('competitor')).toEqual(STAGE_ORDER);
  });

  it('returns business onward from business', () => {
    expect(stagesFromEntry('business')).toEqual([
      'business',
      'market',
      'dynamics',
      'patterns',
    ]);
  });

  it('returns only patterns from patterns', () => {
    expect(stagesFromEntry('patterns')).toEqual(['patterns']);
  });
});

describe('buildHandoff', () => {
  it('merges new output into existing', () => {
    const existing = { competitorMap: { subject: 'A', geoBase: 'X', rings: [], totalCompetitors: 0 } };
    const result = buildHandoff(existing, {
      businessProfiles: [{ subject: 'A' } as any],
    });
    expect(result.competitorMap).toBeDefined();
    expect(result.businessProfiles).toHaveLength(1);
  });

  it('overwrites existing field with new value', () => {
    const existing = { competitorMap: { subject: 'old', geoBase: 'X', rings: [], totalCompetitors: 0 } };
    const result = buildHandoff(existing, {
      competitorMap: { subject: 'new', geoBase: 'Y', rings: [], totalCompetitors: 5 },
    });
    expect(result.competitorMap?.subject).toBe('new');
  });

  it('handles undefined existing', () => {
    const result = buildHandoff(undefined, {
      competitorMap: { subject: 'A', geoBase: 'X', rings: [], totalCompetitors: 0 },
    });
    expect(result.competitorMap?.subject).toBe('A');
  });
});
