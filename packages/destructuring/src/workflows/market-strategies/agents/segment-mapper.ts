import type { LLMMessage } from '../../../types/agent.types.js';
import type { DestructuringSubject } from '../../../types/common.types.js';
import type { MarketSegment } from '../../../types/market.types.js';
import { z } from 'zod/v4';
import { MarketSegmentSchema } from '../../../schemas/market.schema.js';

export const outputSchema = z.array(MarketSegmentSchema).min(1);

export function buildPrompt(input: DestructuringSubject): LLMMessage[] {
  const competitorContext = input.priorOutputs?.competitorMap
    ? `\nCOMPETITOR MAP (from prior analysis):\n${JSON.stringify(input.priorOutputs.competitorMap, null, 2)}`
    : '\nNo competitor map available — infer segments from subject description and sector.';

  const businessContext = input.priorOutputs?.businessProfiles
    ? `\nBUSINESS PROFILES (from prior analysis):\n${JSON.stringify(input.priorOutputs.businessProfiles, null, 2)}`
    : '';

  return [
    {
      role: 'system',
      content: `You are a Segment Mapper. Your cognitive stance: go beyond the obvious buyer. Identify addressable market segments by looking at who is underserved, who is over-served and paying for things they do not need, and who is completely ignored. Each segment must have a specific persona, not a generic label. Surface pain points that are not already saturated by current solutions — that is where the entry opportunity lives.`,
    },
    {
      role: 'user',
      content: `Map the addressable market segments for the following subject.

SUBJECT
Name: ${input.name}
Description: ${input.description}
Sector: ${input.sector}
Geographic base: ${input.geoBase}
${competitorContext}
${businessContext}

For each segment, return a JSON array:
[{
  "name": "segment name — specific, not generic",
  "description": "who these people are and what they do",
  "estimatedSize": "rough market size or count (e.g. '~50k freelancers in EU' or 'large')",
  "painPoints": ["specific unsolved problem 1", "specific unsolved problem 2"],
  "currentSolutions": ["what they use today to solve this", "workarounds if no product exists"],
  "underservedAspect": "the one thing current solutions fail to address for this segment"
}]

Include at least 2 non-obvious segments. Do not list 'small businesses' or 'enterprises' as segments without specificity.`,
    },
  ];
}

export function parseOutput(raw: string): MarketSegment[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Segment mapper output does not contain a JSON array');
  return outputSchema.parse(JSON.parse(jsonMatch[0]));
}
