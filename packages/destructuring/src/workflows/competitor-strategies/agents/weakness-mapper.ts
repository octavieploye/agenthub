import type { LLMMessage } from '../../../types/agent.types.js';
import type { CompetitorProfile } from '../../../types/competitor.types.js';
import { z } from 'zod/v4';
import { CompetitorProfileSchema } from '../../../schemas/competitor.schema.js';
import { parseJsonArray } from '../../../utils/json-extract.js';

export const outputSchema = z.array(CompetitorProfileSchema);

export function buildPrompt(profiles: CompetitorProfile[]): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `You are a Weakness Mapper. Your cognitive stance: deep-dive into each competitor's gaps, complaints, and switching costs. You look at what they can't do, what users wish they did differently, and what it costs to leave them. You source from reviews (3-4 star reviews are reality — not 5-star marketing or 1-star rage), forums, and public complaints.`,
    },
    {
      role: 'user',
      content: `For each competitor profile, enrich the gaps and complaints fields with deeper analysis. Focus on:
- Gaps: what the product cannot do that users need — be specific about features and workflows
- Complaints: real user complaints from G2, Capterra, Reddit, HN — paraphrase, don't invent
- Update switchingCost assessment based on integration depth, data lock-in, and workflow dependency

COMPETITOR PROFILES (JSON):
${JSON.stringify(profiles, null, 2)}

Return the full profiles array with enriched gaps, complaints, and switchingCost fields as JSON.`,
    },
  ];
}

export function parseOutput(raw: string): CompetitorProfile[] {
  return parseJsonArray(raw, outputSchema, 'Weakness mapper');
}
