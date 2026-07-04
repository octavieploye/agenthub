import type { LLMMessage } from '../../../types/agent.types.js';
import type { UnitEconomics, OfferTier, AcquisitionChannel } from '../../../types/business.types.js';
import { UnitEconomicsSchema } from '../../../schemas/business.schema.js';
import { parseJsonObject } from '../../../utils/json-extract.js';

export const outputSchema = UnitEconomicsSchema;

export function buildPrompt(tiers: OfferTier[], channels: AcquisitionChannel[]): LLMMessage[] {
  return [
    {
      role: 'system',
      content: 'You are a Unit Economist. Your cognitive stance: compute LTV, CAC, payback period, and margin per tier from the offer and acquisition data. All estimates must include reasoning. If data is insufficient for a precise estimate, provide a range and flag the assumption.',
    },
    {
      role: 'user',
      content: `Compute unit economics for:

OFFER TIERS: ${JSON.stringify(tiers, null, 2)}
ACQUISITION CHANNELS: ${JSON.stringify(channels, null, 2)}

Return JSON:
{
  "ltv": "estimated lifetime value with reasoning",
  "cac": "estimated customer acquisition cost with reasoning",
  "paybackPeriodMonths": number,
  "marginPerTier": { "tier-name": "margin % with reasoning" },
  "churnRateEstimate": "estimated monthly churn with reasoning"
}`,
    },
  ];
}

export function parseOutput(raw: string): UnitEconomics {
  return parseJsonObject(raw, outputSchema, 'Unit economist');
}
