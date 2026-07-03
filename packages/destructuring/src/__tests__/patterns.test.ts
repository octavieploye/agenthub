import { describe, it, expect } from 'vitest';
import {
  PatternVerdictSchema,
  ExtractedPatternSchema,
  PatternReportSchema,
} from '../schemas/patterns.schema.js';
import * as patternExtractor from '../workflows/good-and-bad/agents/pattern-extractor.js';
import * as successAnalyst from '../workflows/good-and-bad/agents/success-analyst.js';
import * as failureAnalyst from '../workflows/good-and-bad/agents/failure-analyst.js';
import * as synthesisWriter from '../workflows/good-and-bad/agents/synthesis-writer.js';
import type { PatternExtractionInput } from '../types/common.types.js';
import type { ExtractedPattern } from '../types/patterns.types.js';

const validPattern: ExtractedPattern = {
  name: 'Per-seat team pricing on top of free individual tier',
  description: 'Every subject offers a free individual plan and charges per seat when teams adopt the product',
  verdict: 'good',
  frequency: 2,
  totalSubjects: 2,
  evidence: [
    'AgentHub: free solo tier, $49/seat for teams',
    'Cursor: free individual, $20/seat for teams',
  ],
  confidence: 'high',
  domain: 'pricing',
};

const validInput: PatternExtractionInput = {
  subjects: [
    {
      name: 'AgentHub',
      description: 'Multi-agent AI orchestrator for Claude CLI',
      geoBase: 'Lyon, FR',
      geoRadius: 'continental',
      sector: 'developer-tools',
    },
    {
      name: 'Cursor',
      description: 'AI-native code editor with agent mode',
      geoBase: 'San Francisco, US',
      geoRadius: 'worldwide',
      sector: 'developer-tools',
    },
  ],
  outputs: [{}, {}],
  focusQuestion: 'What pricing patterns recur across AI developer tools?',
};

// --- PatternVerdictSchema ---
describe('PatternVerdictSchema', () => {
  it('accepts all valid verdicts', () => {
    for (const v of ['good', 'bad', 'neutral', 'context-dependent'] as const) {
      expect(PatternVerdictSchema.parse(v)).toBe(v);
    }
  });

  it('rejects unknown verdict', () => {
    expect(() => PatternVerdictSchema.parse('mixed')).toThrow();
  });
});

// --- ExtractedPatternSchema ---
describe('ExtractedPatternSchema', () => {
  it('accepts a valid pattern', () => {
    const result = ExtractedPatternSchema.parse(validPattern);
    expect(result.name).toBe('Per-seat team pricing on top of free individual tier');
    expect(result.verdict).toBe('good');
    expect(result.domain).toBe('pricing');
    expect(result.confidence).toBe('high');
  });

  it('rejects invalid verdict', () => {
    expect(() =>
      ExtractedPatternSchema.parse({ ...validPattern, verdict: 'mixed' })
    ).toThrow();
  });

  it('rejects invalid domain', () => {
    expect(() =>
      ExtractedPatternSchema.parse({ ...validPattern, domain: 'distribution' })
    ).toThrow();
  });

  it('rejects invalid confidence', () => {
    expect(() =>
      ExtractedPatternSchema.parse({ ...validPattern, confidence: 'certain' })
    ).toThrow();
  });

  it('rejects empty evidence array', () => {
    expect(() =>
      ExtractedPatternSchema.parse({ ...validPattern, evidence: [] })
    ).toThrow();
  });

  it('rejects negative frequency', () => {
    expect(() =>
      ExtractedPatternSchema.parse({ ...validPattern, frequency: -1 })
    ).toThrow();
  });

  it('rejects totalSubjects below 1', () => {
    expect(() =>
      ExtractedPatternSchema.parse({ ...validPattern, totalSubjects: 0 })
    ).toThrow();
  });
});

// --- PatternReportSchema ---
describe('PatternReportSchema', () => {
  it('accepts a valid report', () => {
    const report = {
      focusQuestion: 'What pricing patterns recur?',
      subjectCount: 2,
      goodPatterns: [validPattern],
      badPatterns: [],
      neutralPatterns: [],
      blindSpots: ['No subject offers usage-based pricing despite high variance in consumption'],
      synthesis: 'The space is converging on per-seat team pricing as the primary monetisation lever, with free individual tiers as acquisition.',
    };
    const result = PatternReportSchema.parse(report);
    expect(result.subjectCount).toBe(2);
    expect(result.goodPatterns).toHaveLength(1);
    expect(result.blindSpots).toHaveLength(1);
  });

  it('rejects subjectCount below 2', () => {
    expect(() =>
      PatternReportSchema.parse({
        subjectCount: 1,
        goodPatterns: [],
        badPatterns: [],
        neutralPatterns: [],
        blindSpots: [],
        synthesis: 'Only one subject.',
      })
    ).toThrow();
  });

  it('allows missing focusQuestion', () => {
    const report = {
      subjectCount: 2,
      goodPatterns: [],
      badPatterns: [],
      neutralPatterns: [],
      blindSpots: [],
      synthesis: 'No dominant patterns found.',
    };
    const result = PatternReportSchema.parse(report);
    expect(result.focusQuestion).toBeUndefined();
  });

  it('rejects empty synthesis', () => {
    expect(() =>
      PatternReportSchema.parse({
        subjectCount: 2,
        goodPatterns: [],
        badPatterns: [],
        neutralPatterns: [],
        blindSpots: [],
        synthesis: '',
      })
    ).toThrow();
  });
});

// --- patternExtractor.buildPrompt ---
describe('patternExtractor.buildPrompt', () => {
  it('produces system + user messages', () => {
    const messages = patternExtractor.buildPrompt(validInput);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('includes subject names in user message', () => {
    const messages = patternExtractor.buildPrompt(validInput);
    expect(messages[1].content).toContain('AgentHub');
    expect(messages[1].content).toContain('Cursor');
  });

  it('includes focus question when provided', () => {
    const messages = patternExtractor.buildPrompt(validInput);
    expect(messages[1].content).toContain('What pricing patterns recur');
  });

  it('omits focus question section when not provided', () => {
    const inputWithout = { ...validInput, focusQuestion: undefined };
    const messages = patternExtractor.buildPrompt(inputWithout);
    expect(messages[1].content).not.toContain('FOCUS QUESTION');
  });

  it('includes total subject count', () => {
    const messages = patternExtractor.buildPrompt(validInput);
    expect(messages[1].content).toContain('2');
  });
});

// --- patternExtractor.parseOutput ---
describe('patternExtractor.parseOutput', () => {
  it('parses valid JSON array from raw LLM response', () => {
    const raw = `Here are the patterns:\n${JSON.stringify([validPattern])}`;
    const result = patternExtractor.parseOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Per-seat team pricing on top of free individual tier');
    expect(result[0].verdict).toBe('good');
  });

  it('throws on non-JSON response', () => {
    expect(() => patternExtractor.parseOutput('No patterns found')).toThrow();
  });
});

// --- successAnalyst.buildPrompt ---
describe('successAnalyst.buildPrompt', () => {
  it('produces system + user messages', () => {
    const messages = successAnalyst.buildPrompt(validInput, [validPattern]);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('includes pattern data in user message', () => {
    const messages = successAnalyst.buildPrompt(validInput, [validPattern]);
    expect(messages[1].content).toContain('Per-seat team pricing');
  });

  it('includes focus question when provided', () => {
    const messages = successAnalyst.buildPrompt(validInput, [validPattern]);
    expect(messages[1].content).toContain('What pricing patterns recur');
  });
});

// --- successAnalyst.parseOutput ---
describe('successAnalyst.parseOutput', () => {
  it('parses valid JSON array from raw LLM response', () => {
    const raw = `Success patterns:\n${JSON.stringify([validPattern])}`;
    const result = successAnalyst.parseOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].verdict).toBe('good');
  });

  it('throws on non-JSON response', () => {
    expect(() => successAnalyst.parseOutput('No patterns found')).toThrow();
  });
});

// --- failureAnalyst.buildPrompt ---
describe('failureAnalyst.buildPrompt', () => {
  const badPattern: ExtractedPattern = {
    ...validPattern,
    name: 'Aggressive discounting to close enterprise deals',
    verdict: 'bad',
    domain: 'pricing',
  };

  it('produces system + user messages', () => {
    const messages = failureAnalyst.buildPrompt(validInput, [badPattern]);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('includes pattern data in user message', () => {
    const messages = failureAnalyst.buildPrompt(validInput, [badPattern]);
    expect(messages[1].content).toContain('Aggressive discounting');
  });

  it('includes focus question when provided', () => {
    const messages = failureAnalyst.buildPrompt(validInput, [badPattern]);
    expect(messages[1].content).toContain('What pricing patterns recur');
  });
});

// --- failureAnalyst.parseOutput ---
describe('failureAnalyst.parseOutput', () => {
  const badPattern: ExtractedPattern = {
    ...validPattern,
    verdict: 'bad',
  };

  it('parses valid JSON array from raw LLM response', () => {
    const raw = `Failure patterns:\n${JSON.stringify([badPattern])}`;
    const result = failureAnalyst.parseOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].verdict).toBe('bad');
  });

  it('throws on non-JSON response', () => {
    expect(() => failureAnalyst.parseOutput('No patterns found')).toThrow();
  });
});

// --- synthesisWriter.buildPrompt ---
describe('synthesisWriter.buildPrompt', () => {
  it('produces system + user messages', () => {
    const messages = synthesisWriter.buildPrompt(validInput, [validPattern], [], []);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('includes pattern counts in user message', () => {
    const messages = synthesisWriter.buildPrompt(validInput, [validPattern], [], []);
    expect(messages[1].content).toContain('GOOD PATTERNS (1)');
    expect(messages[1].content).toContain('BAD PATTERNS (0)');
    expect(messages[1].content).toContain('NEUTRAL/CONTEXT-DEPENDENT PATTERNS (0)');
  });

  it('includes subject list', () => {
    const messages = synthesisWriter.buildPrompt(validInput, [validPattern], [], []);
    expect(messages[1].content).toContain('AgentHub');
    expect(messages[1].content).toContain('Cursor');
  });

  it('includes focus question when provided', () => {
    const messages = synthesisWriter.buildPrompt(validInput, [validPattern], [], []);
    expect(messages[1].content).toContain('What pricing patterns recur');
  });
});

// --- synthesisWriter.parseOutput ---
describe('synthesisWriter.parseOutput', () => {
  it('assembles a complete PatternReport from raw LLM response', () => {
    const raw = JSON.stringify({
      blindSpots: ['No subject offers usage-based pricing'],
      synthesis: 'The space is converging on per-seat pricing as the monetisation lever.',
    });

    const report = synthesisWriter.parseOutput(
      raw,
      validInput,
      [validPattern],
      [],
      []
    );

    expect(report.subjectCount).toBe(2);
    expect(report.goodPatterns).toHaveLength(1);
    expect(report.badPatterns).toHaveLength(0);
    expect(report.neutralPatterns).toHaveLength(0);
    expect(report.blindSpots).toHaveLength(1);
    expect(report.blindSpots[0]).toContain('usage-based pricing');
    expect(report.synthesis).toContain('converging');
    expect(report.focusQuestion).toBe('What pricing patterns recur across AI developer tools?');
  });

  it('sets focusQuestion to undefined when not provided', () => {
    const raw = JSON.stringify({
      blindSpots: [],
      synthesis: 'No dominant patterns.',
    });
    const inputWithout = { ...validInput, focusQuestion: undefined };
    const report = synthesisWriter.parseOutput(raw, inputWithout, [], [], []);
    expect(report.focusQuestion).toBeUndefined();
  });

  it('throws on non-JSON response', () => {
    expect(() =>
      synthesisWriter.parseOutput('No synthesis', validInput, [], [], [])
    ).toThrow();
  });
});
