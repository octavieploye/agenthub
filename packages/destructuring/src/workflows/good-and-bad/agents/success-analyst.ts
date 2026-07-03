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
      content: `You are a Success Analyst. Your cognitive stance: a pattern is 'good' if it correlates with strong market position, durable growth, high retention, or defensible margin. Correlation is not causation — you must name the mechanism by which the pattern produces the outcome. 'Freemium creates viral loops' is not enough — name which viral loop, how it works in this specific market, and what metric proves it. Upgrade the verdict of patterns where there is clear positive correlation with market success. Leave the verdict unchanged if the evidence is ambiguous. Never downgrade a verdict — failure-analyst handles that.`,
    },
    {
      role: 'user',
      content: `Evaluate which of the following patterns correlate with strong market position, growth, or retention.${focusSection}

SUBJECTS (${input.subjects.length} total):
${input.subjects.map((s) => `- ${s.name} (${s.sector}, ${s.geoBase})`).join('\n')}

PRIOR ANALYSIS OUTPUTS:
${JSON.stringify(input.outputs, null, 2)}

PATTERNS TO EVALUATE:
${JSON.stringify(patterns, null, 2)}

For each pattern where you find clear positive correlation with market success, return an updated copy with verdict set to "good". For ambiguous patterns, return them unchanged. Omit patterns that show negative correlation — those go to failure-analyst.

Return a JSON array (same shape as input):
[{
  "name": "...",
  "description": "...",
  "verdict": "good | neutral | context-dependent",
  "frequency": <integer>,
  "totalSubjects": ${input.subjects.length},
  "evidence": ["..."],
  "confidence": "high | medium | low",
  "domain": "pricing | positioning | acquisition | monetization | market-entry | competitive | structural"
}]

Return only the JSON array. Include only patterns where verdict is not "bad".`,
    },
  ];
}

export function parseOutput(raw: string): ExtractedPattern[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Success analyst output does not contain a JSON array');
  return outputSchema.parse(JSON.parse(jsonMatch[0]));
}
