import type { LLMMessage } from '../../../types/agent.types.js';
import type { MarketPosition, OfferTier } from '../../../types/business.types.js';
import type { DestructuringSubject } from '../../../types/common.types.js';
import { z } from 'zod/v4';
import { OfferTierSchema } from '../../../schemas/business.schema.js';

export const outputSchema = z.array(OfferTierSchema).min(2);

export function buildPrompt(subject: DestructuringSubject, position: MarketPosition): LLMMessage[] {
  return [
    {
      role: 'system',
      content: 'You are an Offer Architect. Your cognitive stance: engineer a tiered offer ladder where each tier has a clear dream outcome, not just a feature list. The tiers must be psychologically distinct — each solves a different level of the same problem. Minimum 2 tiers. Price must reflect the value of the outcome, not the cost of delivery.',
    },
    {
      role: 'user',
      content: `Design a tiered offer ladder for:

SUBJECT: ${subject.name} — ${subject.description}
MARKET POSITION: ${JSON.stringify(position, null, 2)}
SECTOR: ${subject.sector}

For each tier, return JSON array:
[{
  "name": "tier name",
  "price": "amount",
  "currency": "EUR/USD/etc",
  "billingCycle": "monthly | annual | one-time | usage-based",
  "valueProposition": "what this tier promises in one sentence",
  "includedFeatures": ["feature1", "feature2"],
  "excludedFeatures": ["what is NOT included — creates upgrade motivation"],
  "dreamOutcome": "the identity shift or result this tier enables"
}]`,
    },
  ];
}

export function parseOutput(raw: string): OfferTier[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Offer architect output does not contain JSON array');
  return outputSchema.parse(JSON.parse(jsonMatch[0]));
}
