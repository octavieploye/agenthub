import type { LLMMessage } from '../../../types/agent.types.js';
import type { DestructuringSubject } from '../../../types/common.types.js';
import type { MarketPosition } from '../../../types/business.types.js';
import { MarketPositionSchema } from '../../../schemas/business.schema.js';
import { parseJsonObject } from '../../../utils/json-extract.js';

export const outputSchema = MarketPositionSchema;

export function buildPrompt(input: DestructuringSubject): LLMMessage[] {
  const competitorContext = input.priorOutputs?.competitorMap
    ? `\nCOMPETITOR MAP (from prior analysis):\n${JSON.stringify(input.priorOutputs.competitorMap, null, 2)}`
    : '\nNo competitor map available — work from the subject description.';

  return [
    {
      role: 'system',
      content: 'You are a Market Positioner. Your cognitive stance: define the niche precisely, articulate differentiation that is structural (not just messaging), and identify the competitive moat — what makes this position defensible over time. Be specific. Name the mechanism of defense, not a category.',
    },
    {
      role: 'user',
      content: `Define the market position for the following subject.

SUBJECT
Name: ${input.name}
Description: ${input.description}
Sector: ${input.sector}
Geographic base: ${input.geoBase}
${competitorContext}

Return as JSON:
{
  "nicheDefinition": "precise niche — who it is for and who it is NOT for",
  "differentiationStatement": "structural difference from competitors — not a tagline",
  "competitiveMoat": "what protects this position — name the mechanism",
  "targetSegment": "primary segment this position serves"
}`,
    },
  ];
}

export function parseOutput(raw: string): MarketPosition {
  return parseJsonObject(raw, outputSchema, 'Market positioner');
}
