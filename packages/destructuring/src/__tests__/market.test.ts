import { describe, it, expect } from 'vitest';
import {
  MarketSegmentSchema,
  ChannelStrategySchema,
  PositioningAnalysisSchema,
  EntryVectorSchema,
  MarketStrategyMapSchema,
} from '../schemas/market.schema.js';
import * as segmentMapper from '../workflows/market-strategies/agents/segment-mapper.js';
import * as channelStrategist from '../workflows/market-strategies/agents/channel-strategist.js';
import * as positioningAnalyst from '../workflows/market-strategies/agents/positioning-analyst.js';
import * as entryStrategist from '../workflows/market-strategies/agents/entry-strategist.js';

const validSegment = {
  name: 'Solo developer building SaaS',
  description: 'Freelance developers running 1-3 AI coding agents simultaneously',
  estimatedSize: '~200k in EU/US',
  painPoints: ['Cannot parallelize Claude CLI sessions', 'No shared context between agents'],
  currentSolutions: ['Multiple terminal tabs', 'tmux sessions'],
  underservedAspect: 'No tool gives a unified view of all agent outputs with context sharing',
};

const validChannel = {
  channel: 'Twitter/X threads about multi-agent workflows',
  type: 'earned' as const,
  segment: 'Solo developer building SaaS',
  sequencing: 'pre-launch' as const,
  rationale: 'Developers share workflow tips on Twitter; a thread demonstrating AgentHub in action reaches the exact segment organically',
};

const validPositioning = {
  existingPositions: [
    { competitor: 'Cursor', position: 'AI pair-programmer embedded in the editor' },
    { competitor: 'Continue.dev', position: 'Open-source AI coding assistant for VS Code' },
    { competitor: 'Devin', position: 'Fully autonomous AI engineer' },
  ],
  whiteSpace: 'The only tool that orchestrates multiple sovereign AI coding agents simultaneously with shared context and no cloud lock-in',
  messagingArchitecture: 'Run a team of AI developers — not a single assistant — on your own machine',
};

const validEntryVector = {
  name: 'Show HN + solo-dev segment',
  segment: 'Solo developer building SaaS',
  channel: 'Hacker News Show HN post',
  sequencing: 'immediate',
  rationale: 'HN has the highest concentration of technical early adopters willing to install desktop tools; a Show HN with a live demo video converts at higher rate than any paid channel',
  riskLevel: 'low' as const,
};

// --- MarketSegmentSchema ---
describe('MarketSegmentSchema', () => {
  it('accepts a valid segment', () => {
    const result = MarketSegmentSchema.parse(validSegment);
    expect(result.name).toBe('Solo developer building SaaS');
  });

  it('rejects missing name', () => {
    const { name, ...noName } = validSegment;
    expect(() => MarketSegmentSchema.parse(noName)).toThrow();
  });

  it('rejects missing painPoints', () => {
    const { painPoints, ...noPain } = validSegment;
    expect(() => MarketSegmentSchema.parse(noPain)).toThrow();
  });
});

// --- ChannelStrategySchema ---
describe('ChannelStrategySchema', () => {
  it('accepts a valid channel strategy', () => {
    const result = ChannelStrategySchema.parse(validChannel);
    expect(result.type).toBe('earned');
  });

  it('rejects invalid type', () => {
    expect(() =>
      ChannelStrategySchema.parse({ ...validChannel, type: 'borrowed' })
    ).toThrow();
  });

  it('rejects invalid sequencing', () => {
    expect(() =>
      ChannelStrategySchema.parse({ ...validChannel, sequencing: 'after-launch' })
    ).toThrow();
  });
});

// --- PositioningAnalysisSchema ---
describe('PositioningAnalysisSchema', () => {
  it('accepts a valid positioning analysis', () => {
    const result = PositioningAnalysisSchema.parse(validPositioning);
    expect(result.existingPositions).toHaveLength(3);
  });

  it('rejects missing whiteSpace', () => {
    const { whiteSpace, ...noWhiteSpace } = validPositioning;
    expect(() => PositioningAnalysisSchema.parse(noWhiteSpace)).toThrow();
  });
});

// --- EntryVectorSchema ---
describe('EntryVectorSchema', () => {
  it('accepts a valid entry vector', () => {
    const result = EntryVectorSchema.parse(validEntryVector);
    expect(result.riskLevel).toBe('low');
  });

  it('rejects invalid riskLevel', () => {
    expect(() =>
      EntryVectorSchema.parse({ ...validEntryVector, riskLevel: 'critical' })
    ).toThrow();
  });
});

// --- MarketStrategyMapSchema ---
describe('MarketStrategyMapSchema', () => {
  it('accepts a valid market strategy map', () => {
    const map = {
      subject: 'AgentHub',
      segments: [validSegment],
      channels: [validChannel],
      positioning: validPositioning,
      entryVectors: [validEntryVector],
    };
    const result = MarketStrategyMapSchema.parse(map);
    expect(result.subject).toBe('AgentHub');
    expect(result.segments).toHaveLength(1);
    expect(result.entryVectors).toHaveLength(1);
  });

  it('rejects empty segments array', () => {
    expect(() =>
      MarketStrategyMapSchema.parse({
        subject: 'AgentHub',
        segments: [],
        channels: [validChannel],
        positioning: validPositioning,
        entryVectors: [validEntryVector],
      })
    ).toThrow();
  });
});

// --- segment-mapper.buildPrompt ---
describe('segmentMapper.buildPrompt', () => {
  it('produces system + user messages', () => {
    const messages = segmentMapper.buildPrompt({
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

  it('includes competitor context when priorOutputs has competitorMap', () => {
    const messages = segmentMapper.buildPrompt({
      name: 'AgentHub',
      description: 'Multi-agent AI orchestrator',
      geoBase: 'Lyon, FR',
      geoRadius: 'continental',
      sector: 'developer-tools',
      priorOutputs: {
        competitorMap: {
          subject: 'AgentHub',
          geoBase: 'Lyon, FR',
          rings: [],
          totalCompetitors: 0,
        },
      },
    });
    expect(messages[1].content).toContain('COMPETITOR MAP');
  });
});

// --- segmentMapper.parseOutput ---
describe('segmentMapper.parseOutput', () => {
  it('parses valid JSON array from raw LLM response', () => {
    const raw = `Here are the segments:\n${JSON.stringify([validSegment])}`;
    const result = segmentMapper.parseOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Solo developer building SaaS');
  });

  it('throws on non-JSON response', () => {
    expect(() => segmentMapper.parseOutput('No segments found')).toThrow();
  });
});

// --- channelStrategist.buildPrompt ---
describe('channelStrategist.buildPrompt', () => {
  it('produces system + user messages and includes segment names', () => {
    const messages = channelStrategist.buildPrompt(
      {
        name: 'AgentHub',
        description: 'Multi-agent AI orchestrator',
        geoBase: 'Lyon, FR',
        geoRadius: 'continental',
        sector: 'developer-tools',
      },
      [validSegment]
    );
    expect(messages).toHaveLength(2);
    expect(messages[1].content).toContain('Solo developer building SaaS');
  });
});

// --- positioningAnalyst.buildPrompt ---
describe('positioningAnalyst.buildPrompt', () => {
  it('produces system + user messages and includes segment and channel data', () => {
    const messages = positioningAnalyst.buildPrompt(
      {
        name: 'AgentHub',
        description: 'Multi-agent AI orchestrator',
        geoBase: 'Lyon, FR',
        geoRadius: 'continental',
        sector: 'developer-tools',
      },
      [validSegment],
      [validChannel]
    );
    expect(messages).toHaveLength(2);
    expect(messages[1].content).toContain('Solo developer building SaaS');
    expect(messages[1].content).toContain('Twitter/X threads');
  });
});

// --- entryStrategist.buildPrompt ---
describe('entryStrategist.buildPrompt', () => {
  it('produces system + user messages and includes all prior outputs', () => {
    const messages = entryStrategist.buildPrompt(
      [validSegment],
      [validChannel],
      validPositioning
    );
    expect(messages).toHaveLength(2);
    expect(messages[1].content).toContain('Solo developer building SaaS');
    expect(messages[1].content).toContain('Twitter/X threads');
    expect(messages[1].content).toContain('whiteSpace');
  });
});
