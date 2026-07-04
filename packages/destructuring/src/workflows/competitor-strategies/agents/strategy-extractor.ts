import type { LLMMessage } from '../../../types/agent.types.js';
import type { CompetitorCard, CompetitorProfile } from '../../../types/competitor.types.js';
import { z } from 'zod/v4';
import { CompetitorProfileSchema } from '../../../schemas/competitor.schema.js';
import { parseJsonArray } from '../../../utils/json-extract.js';

export const outputSchema = z.array(CompetitorProfileSchema);

export function buildPrompt(competitors: CompetitorCard[]): LLMMessage[] {
  const competitorList = competitors
    .map(
      (c, i) =>
        `${i + 1}. ${c.name} (${c.location}, ${c.geoRing}) — ${c.coreValueProp}`
    )
    .join('\n');

  return [
    {
      role: 'system',
      content: `You are a Strategy Extractor. Your cognitive stance: for each named competitor, reverse-engineer their complete strategy — pricing, acquisition channels, tech stack, moat. You work from public information: website, reviews, job postings, press. Be specific — name channels, name technologies, name the moat mechanism.`,
    },
    {
      role: 'user',
      content: `For each competitor below, extract:
- All fields from the original card (preserve them)
- acquisitionChannels: list of specific channels they use to acquire customers
- techStack: list of known technologies
- moat: what structural advantage protects them from competition
- gaps: list of product/market gaps based on user complaints and missing features
- complaints: list of specific user complaints from reviews

COMPETITORS:
${competitorList}

ORIGINAL CARDS (JSON):
${JSON.stringify(competitors, null, 2)}

Return as a JSON array of enriched competitor profiles.`,
    },
  ];
}

export function parseOutput(raw: string): CompetitorProfile[] {
  return parseJsonArray(raw, outputSchema, 'Strategy extractor');
}
