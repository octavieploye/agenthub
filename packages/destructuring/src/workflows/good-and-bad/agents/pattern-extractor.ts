import type { LLMMessage } from '../../../types/agent.types.js';
import type { PatternExtractionInput } from '../../../types/common.types.js';
import type { ExtractedPattern } from '../../../types/patterns.types.js';
import { z } from 'zod/v4';
import { ExtractedPatternSchema } from '../../../schemas/patterns.schema.js';

export const outputSchema = z.array(ExtractedPatternSchema).min(1);

export function buildPrompt(input: PatternExtractionInput): LLMMessage[] {
  const subjectSummaries = input.subjects
    .map((s, i) => {
      const outputs = input.outputs[i];
      return `Subject ${i + 1}: ${s.name}
  Sector: ${s.sector}
  Geographic base: ${s.geoBase}
  Description: ${s.description}
  Prior outputs available: ${Object.keys(outputs || {}).filter(k => (outputs as Record<string, unknown>)[k] !== undefined).join(', ') || 'none'}`;
    })
    .join('\n\n');

  const focusSection = input.focusQuestion
    ? `\nFOCUS QUESTION: ${input.focusQuestion}`
    : '';

  return [
    {
      role: 'system',
      content: `You are a Pattern Extractor. Your cognitive stance: patterns are strategies that recur across multiple subjects. Your job is to find what multiple players do — not just what each individual does. A pattern is only a pattern if it appears in at least 2 subjects. You look across pricing models, acquisition strategies, positioning angles, monetization structures, market-entry sequences, competitive moves, and structural choices. Name what you see, not the category — 'freemium' is not a pattern, 'free individual tier with per-seat team pricing' is. Report the verdict as a preliminary classification; success-analyst and failure-analyst will refine it.`,
    },
    {
      role: 'user',
      content: `Identify recurring patterns across the following ${input.subjects.length} subjects.${focusSection}

SUBJECTS:
${subjectSummaries}

PRIOR ANALYSIS OUTPUTS:
${JSON.stringify(input.outputs, null, 2)}

Return a JSON array of patterns found across 2 or more subjects:
[{
  "name": "short pattern name",
  "description": "what the pattern is and how it operates across subjects",
  "verdict": "good | bad | neutral | context-dependent",
  "frequency": <integer — how many subjects exhibit this pattern>,
  "totalSubjects": ${input.subjects.length},
  "evidence": ["specific example from subject 1", "specific example from subject 2"],
  "confidence": "high | medium | low",
  "domain": "pricing | positioning | acquisition | monetization | market-entry | competitive | structural"
}]

Only include patterns present in at least 2 subjects. Evidence must cite the specific subject by name. Return only the JSON array.`,
    },
  ];
}

export function parseOutput(raw: string): ExtractedPattern[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Pattern extractor output does not contain a JSON array');
  return outputSchema.parse(JSON.parse(jsonMatch[0]));
}
