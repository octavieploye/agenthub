import type { LLMMessage } from '../../../types/agent.types.js';
import type { PatternExtractionInput } from '../../../types/common.types.js';
import type { ExtractedPattern } from '../../../types/patterns.types.js';
import { z } from 'zod/v4';
import { ExtractedPatternSchema } from '../../../schemas/patterns.schema.js';

export const outputSchema = z.array(ExtractedPatternSchema);

export function buildPrompt(input: PatternExtractionInput, patterns: ExtractedPattern[]): LLMMessage[] {
  const focusSection = input.focusQuestion
    ? `\nFOCUS QUESTION: ${input.focusQuestion}`
    : '';

  return [
    {
      role: 'system',
      content: `You are a Failure Analyst. Your cognitive stance: a pattern is 'bad' if it correlates with churn, market share loss, margin compression, or strategic misalignment. Your job is to find the anti-patterns — the things that look sensible but consistently underperform. Name the failure mechanism, not just the outcome. 'Discounting causes margin compression' is not enough — name why subjects discount (positioning weakness, no product differentiation, buyer power), how it creates a trap, and what the exit looks like. Upgrade the verdict of patterns where you find clear negative correlation with market outcomes. Leave unchanged if evidence is ambiguous. Never upgrade a verdict to "good" — that is success-analyst's job.`,
    },
    {
      role: 'user',
      content: `Evaluate which of the following patterns correlate with churn, market share loss, or strategic failure.${focusSection}

SUBJECTS (${input.subjects.length} total):
${input.subjects.map((s) => `- ${s.name} (${s.sector}, ${s.geoBase})`).join('\n')}

PRIOR ANALYSIS OUTPUTS:
${JSON.stringify(input.outputs, null, 2)}

PATTERNS TO EVALUATE:
${JSON.stringify(patterns, null, 2)}

For each pattern where you find clear negative correlation with market outcomes, return an updated copy with verdict set to "bad". For ambiguous patterns, return them unchanged. Omit patterns that show positive correlation — those belong in success-analyst.

Return a JSON array (same shape as input):
[{
  "name": "...",
  "description": "...",
  "verdict": "bad | neutral | context-dependent",
  "frequency": <integer>,
  "totalSubjects": ${input.subjects.length},
  "evidence": ["..."],
  "confidence": "high | medium | low",
  "domain": "pricing | positioning | acquisition | monetization | market-entry | competitive | structural"
}]

Return only the JSON array. Include only patterns where verdict is not "good".`,
    },
  ];
}

export function parseOutput(raw: string): ExtractedPattern[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Failure analyst output does not contain a JSON array');
  return outputSchema.parse(JSON.parse(jsonMatch[0]));
}
