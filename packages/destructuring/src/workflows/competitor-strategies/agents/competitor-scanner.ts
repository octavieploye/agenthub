import type { LLMMessage } from '../../../types/agent.types.js';
import type { DestructuringSubject } from '../../../types/common.types.js';
import type { CompetitorCard } from '../../../types/competitor.types.js';
import { z } from 'zod/v4';
import { CompetitorCardSchema } from '../../../schemas/competitor.schema.js';
import { expandRadius } from '../../../utils/geo-radius.js';
import { parseJsonArray } from '../../../utils/json-extract.js';

export const outputSchema = z.array(CompetitorCardSchema);

export function buildPrompt(input: DestructuringSubject): LLMMessage[] {
  const rings = expandRadius(input.geoRadius);
  const ringDescriptions = rings
    .map((r) => `- Ring: ${r.radius} (${r.label})`)
    .join('\n');

  return [
    {
      role: 'system',
      content: `You are a Competitor Scanner. Your cognitive stance: identify competitors by geographic proximity, expanding outward ring by ring. You are thorough, specific, and name real companies — never invent fictional ones. If you cannot find competitors in a ring, say so explicitly.`,
    },
    {
      role: 'user',
      content: `Scan for competitors of the following subject, organized by geographic ring.

SUBJECT
Name: ${input.name}
Description: ${input.description}
Geographic base: ${input.geoBase}
Sector: ${input.sector}

GEOGRAPHIC RINGS TO SCAN (micro to macro):
${ringDescriptions}

For each competitor found, provide:
- name: company/product name
- url: website if known
- geoRing: which ring they fall in (${rings.map((r) => r.radius).join(' | ')})
- location: where they are based
- category: direct | adjacent | upstream | downstream | substitute
- audienceServed: who they serve
- coreValueProp: one sentence
- pricingModel: how they charge
- deploymentModel: cloud | local | hybrid
- keyWeakness: their #1 weakness from user reviews/complaints
- keyStrength: what their most loyal users say they can't live without
- switchingCost: low | medium | high

Return as a JSON array of competitor cards. Start with the closest ring and expand outward. Each ring must be mapped before moving to the next.`,
    },
  ];
}

export function parseOutput(raw: string): CompetitorCard[] {
  return parseJsonArray(raw, outputSchema, 'Competitor scanner');
}
