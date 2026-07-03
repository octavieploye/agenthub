import { describe, it, expect } from 'vitest';
import {
  MarketForceSchema,
  EntryBarrierSchema,
  PowerStructureSchema,
  TrendVectorSchema,
  MarketDynamicsMapSchema,
} from '../schemas/dynamics.schema.js';
import * as forceAnalyst from '../workflows/market-dynamics/agents/force-analyst.js';
import * as barrierMapper from '../workflows/market-dynamics/agents/barrier-mapper.js';
import * as powerAnalyst from '../workflows/market-dynamics/agents/power-analyst.js';
import * as trendExtractor from '../workflows/market-dynamics/agents/trend-extractor.js';

const validForce = {
  type: 'pull' as const,
  name: 'Developer demand for parallelism',
  description: 'Developers running multiple AI agents need a unified orchestration layer to manage concurrent sessions',
  strength: 8,
  affectedSegments: ['Solo developer building SaaS', 'AI-first startups'],
};

const validBarrier = {
  type: 'switching-costs' as const,
  description: 'Developers who have wired their workflow into a single agent tool accumulate configuration, shortcuts, and muscle memory that make switching expensive even when a better tool exists',
  severity: 'medium' as const,
  affectedEntrants: 'New desktop tools targeting established developer workflows',
};

const validPowerStructure = {
  actor: 'Anthropic (Claude API)',
  controlMechanism: 'Controls model access and rate limits; all Claude CLI sessions depend on API availability',
  concentrationLevel: 'concentrated' as const,
  rentExtraction: 'Per-token API pricing with volume discounts only available at enterprise scale',
  lockInMechanism: 'Prompt formats, tool call schemas, and agent-specific context windows are non-portable across providers',
};

const validTrend = {
  name: 'Multi-agent orchestration becoming default workflow',
  direction: 'growing' as const,
  timeHorizon: '12mo' as const,
  impact: 'Increases pull force for tools that manage parallel agent sessions; reduces tolerance for single-agent sequential workflows',
  confidence: 'high' as const,
};

// --- MarketForceSchema ---
describe('MarketForceSchema', () => {
  it('accepts a valid force', () => {
    const result = MarketForceSchema.parse(validForce);
    expect(result.type).toBe('pull');
    expect(result.strength).toBe(8);
  });

  it('rejects invalid type', () => {
    expect(() =>
      MarketForceSchema.parse({ ...validForce, type: 'push' })
    ).toThrow();
  });

  it('rejects strength below 1', () => {
    expect(() =>
      MarketForceSchema.parse({ ...validForce, strength: 0 })
    ).toThrow();
  });

  it('rejects strength above 10', () => {
    expect(() =>
      MarketForceSchema.parse({ ...validForce, strength: 11 })
    ).toThrow();
  });

  it('rejects missing affectedSegments', () => {
    const { affectedSegments, ...noSegments } = validForce;
    expect(() => MarketForceSchema.parse(noSegments)).toThrow();
  });
});

// --- EntryBarrierSchema ---
describe('EntryBarrierSchema', () => {
  it('accepts a valid entry barrier', () => {
    const result = EntryBarrierSchema.parse(validBarrier);
    expect(result.severity).toBe('medium');
  });

  it('rejects invalid type', () => {
    expect(() =>
      EntryBarrierSchema.parse({ ...validBarrier, type: 'distribution' })
    ).toThrow();
  });

  it('rejects invalid severity', () => {
    expect(() =>
      EntryBarrierSchema.parse({ ...validBarrier, severity: 'critical' })
    ).toThrow();
  });

  it('rejects missing affectedEntrants', () => {
    const { affectedEntrants, ...noEntrants } = validBarrier;
    expect(() => EntryBarrierSchema.parse(noEntrants)).toThrow();
  });
});

// --- PowerStructureSchema ---
describe('PowerStructureSchema', () => {
  it('accepts a valid power structure', () => {
    const result = PowerStructureSchema.parse(validPowerStructure);
    expect(result.concentrationLevel).toBe('concentrated');
  });

  it('rejects invalid concentrationLevel', () => {
    expect(() =>
      PowerStructureSchema.parse({ ...validPowerStructure, concentrationLevel: 'oligopoly' })
    ).toThrow();
  });

  it('rejects missing lockInMechanism', () => {
    const { lockInMechanism, ...noLock } = validPowerStructure;
    expect(() => PowerStructureSchema.parse(noLock)).toThrow();
  });
});

// --- TrendVectorSchema ---
describe('TrendVectorSchema', () => {
  it('accepts a valid trend vector', () => {
    const result = TrendVectorSchema.parse(validTrend);
    expect(result.timeHorizon).toBe('12mo');
    expect(result.confidence).toBe('high');
  });

  it('rejects invalid direction', () => {
    expect(() =>
      TrendVectorSchema.parse({ ...validTrend, direction: 'rising' })
    ).toThrow();
  });

  it('rejects invalid timeHorizon', () => {
    expect(() =>
      TrendVectorSchema.parse({ ...validTrend, timeHorizon: '6mo' })
    ).toThrow();
  });

  it('rejects invalid confidence', () => {
    expect(() =>
      TrendVectorSchema.parse({ ...validTrend, confidence: 'certain' })
    ).toThrow();
  });
});

// --- MarketDynamicsMapSchema ---
describe('MarketDynamicsMapSchema', () => {
  it('accepts a valid market dynamics map', () => {
    const map = {
      subject: 'AgentHub',
      forces: [validForce],
      barriers: [validBarrier],
      powerStructure: [validPowerStructure],
      trends: [validTrend],
    };
    const result = MarketDynamicsMapSchema.parse(map);
    expect(result.subject).toBe('AgentHub');
    expect(result.forces).toHaveLength(1);
    expect(result.barriers).toHaveLength(1);
    expect(result.powerStructure).toHaveLength(1);
    expect(result.trends).toHaveLength(1);
  });

  it('rejects empty forces array', () => {
    expect(() =>
      MarketDynamicsMapSchema.parse({
        subject: 'AgentHub',
        forces: [],
        barriers: [validBarrier],
        powerStructure: [validPowerStructure],
        trends: [validTrend],
      })
    ).toThrow();
  });

  it('rejects empty barriers array', () => {
    expect(() =>
      MarketDynamicsMapSchema.parse({
        subject: 'AgentHub',
        forces: [validForce],
        barriers: [],
        powerStructure: [validPowerStructure],
        trends: [validTrend],
      })
    ).toThrow();
  });

  it('rejects missing subject', () => {
    expect(() =>
      MarketDynamicsMapSchema.parse({
        forces: [validForce],
        barriers: [validBarrier],
        powerStructure: [validPowerStructure],
        trends: [validTrend],
      })
    ).toThrow();
  });
});

// --- forceAnalyst.buildPrompt ---
describe('forceAnalyst.buildPrompt', () => {
  it('produces system + user messages', () => {
    const messages = forceAnalyst.buildPrompt({
      name: 'AgentHub',
      description: 'Multi-agent AI orchestrator',
      geoBase: 'Lyon, FR',
      geoRadius: 'continental',
      sector: 'developer-tools',
    });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('AgentHub');
    expect(messages[1].content).toContain('Lyon, FR');
  });

  it('includes segment context when priorOutputs has marketStrategyMap', () => {
    const messages = forceAnalyst.buildPrompt({
      name: 'AgentHub',
      description: 'Multi-agent AI orchestrator',
      geoBase: 'Lyon, FR',
      geoRadius: 'continental',
      sector: 'developer-tools',
      priorOutputs: {
        marketStrategyMap: {
          subject: 'AgentHub',
          segments: [
            {
              name: 'Solo developer building SaaS',
              description: 'Freelance developers running 1-3 AI coding agents',
              estimatedSize: '~200k in EU/US',
              painPoints: ['Cannot parallelize Claude CLI sessions'],
              currentSolutions: ['Multiple terminal tabs'],
              underservedAspect: 'No unified view of all agent outputs',
            },
          ],
          channels: [],
          positioning: { existingPositions: [], whiteSpace: '', messagingArchitecture: '' },
          entryVectors: [],
        },
      },
    });
    expect(messages[1].content).toContain('SEGMENT MAP');
    expect(messages[1].content).toContain('Solo developer building SaaS');
  });

  it('falls back gracefully when no priorOutputs', () => {
    const messages = forceAnalyst.buildPrompt({
      name: 'AgentHub',
      description: 'Multi-agent AI orchestrator',
      geoBase: 'Lyon, FR',
      geoRadius: 'continental',
      sector: 'developer-tools',
    });
    expect(messages[1].content).toContain('No segment map available');
  });
});

// --- forceAnalyst.parseOutput ---
describe('forceAnalyst.parseOutput', () => {
  it('parses valid JSON array from raw LLM response', () => {
    const raw = `Here are the forces:\n${JSON.stringify([validForce])}`;
    const result = forceAnalyst.parseOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('pull');
    expect(result[0].strength).toBe(8);
  });

  it('throws on non-JSON response', () => {
    expect(() => forceAnalyst.parseOutput('No forces found')).toThrow();
  });
});

// --- barrierMapper.buildPrompt ---
describe('barrierMapper.buildPrompt', () => {
  it('produces system + user messages and includes force data', () => {
    const messages = barrierMapper.buildPrompt(
      {
        name: 'AgentHub',
        description: 'Multi-agent AI orchestrator',
        geoBase: 'Lyon, FR',
        geoRadius: 'continental',
        sector: 'developer-tools',
      },
      [validForce]
    );
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].content).toContain('Developer demand for parallelism');
  });
});

// --- barrierMapper.parseOutput ---
describe('barrierMapper.parseOutput', () => {
  it('parses valid JSON array from raw LLM response', () => {
    const raw = `Barriers:\n${JSON.stringify([validBarrier])}`;
    const result = barrierMapper.parseOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('switching-costs');
  });

  it('throws on non-JSON response', () => {
    expect(() => barrierMapper.parseOutput('No barriers found')).toThrow();
  });
});

// --- powerAnalyst.buildPrompt ---
describe('powerAnalyst.buildPrompt', () => {
  it('produces system + user messages and includes forces and barriers', () => {
    const messages = powerAnalyst.buildPrompt(
      {
        name: 'AgentHub',
        description: 'Multi-agent AI orchestrator',
        geoBase: 'Lyon, FR',
        geoRadius: 'continental',
        sector: 'developer-tools',
      },
      [validForce],
      [validBarrier]
    );
    expect(messages).toHaveLength(2);
    expect(messages[1].content).toContain('Developer demand for parallelism');
    expect(messages[1].content).toContain('switching-costs');
  });
});

// --- powerAnalyst.parseOutput ---
describe('powerAnalyst.parseOutput', () => {
  it('parses valid JSON array from raw LLM response', () => {
    const raw = `Power structure:\n${JSON.stringify([validPowerStructure])}`;
    const result = powerAnalyst.parseOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].actor).toBe('Anthropic (Claude API)');
  });

  it('throws on non-JSON response', () => {
    expect(() => powerAnalyst.parseOutput('No power structures found')).toThrow();
  });
});

// --- trendExtractor.buildPrompt ---
describe('trendExtractor.buildPrompt', () => {
  it('produces system + user messages and includes all prior outputs', () => {
    const messages = trendExtractor.buildPrompt(
      {
        name: 'AgentHub',
        description: 'Multi-agent AI orchestrator',
        geoBase: 'Lyon, FR',
        geoRadius: 'continental',
        sector: 'developer-tools',
      },
      [validForce],
      [validBarrier],
      [validPowerStructure]
    );
    expect(messages).toHaveLength(2);
    expect(messages[1].content).toContain('Developer demand for parallelism');
    expect(messages[1].content).toContain('switching-costs');
    expect(messages[1].content).toContain('Anthropic (Claude API)');
  });
});

// --- trendExtractor.parseOutput ---
describe('trendExtractor.parseOutput', () => {
  it('parses valid JSON array from raw LLM response', () => {
    const raw = `Trends:\n${JSON.stringify([validTrend])}`;
    const result = trendExtractor.parseOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('growing');
    expect(result[0].timeHorizon).toBe('12mo');
  });

  it('throws on non-JSON response', () => {
    expect(() => trendExtractor.parseOutput('No trends found')).toThrow();
  });
});
