import type { LLMMessage } from '../../../types/agent.types.js';
import type { AcquisitionChannel, OfferTier } from '../../../types/business.types.js';
import type { DestructuringSubject } from '../../../types/common.types.js';
import { z } from 'zod/v4';
import { AcquisitionChannelSchema } from '../../../schemas/business.schema.js';

export const outputSchema = z.array(AcquisitionChannelSchema);

export function buildPrompt(subject: DestructuringSubject, tiers: OfferTier[]): LLMMessage[] {
  return [
    {
      role: 'system',
      content: 'You are an Acquisition Analyst. Your cognitive stance: map specific channels to specific personas. Every channel must name the persona it targets, the estimated cost, and the funnel shape (wide top vs narrow top). Prefer channels where the subject has a structural advantage. Do not recommend channels that require capabilities the subject does not have.',
    },
    {
      role: 'user',
      content: `Map acquisition channels for:

SUBJECT: ${subject.name} — ${subject.description}
SECTOR: ${subject.sector}
OFFER TIERS: ${JSON.stringify(tiers.map(t => ({ name: t.name, price: t.price })), null, 2)}

For each channel, return JSON array:
[{
  "channel": "specific channel name",
  "type": "owned | earned | paid",
  "personaTarget": "which persona this channel reaches",
  "estimatedCostPerAcquisition": "estimated CAC for this channel",
  "funnelShape": "describe the funnel — wide/narrow top, conversion expectations"
}]`,
    },
  ];
}

export function parseOutput(raw: string): AcquisitionChannel[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Acquisition analyst output does not contain JSON array');
  return outputSchema.parse(JSON.parse(jsonMatch[0]));
}
