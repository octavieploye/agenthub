import type { LLMMessage } from '../../../types/agent.types.js';
import type { MonetizationModel, OfferTier, UnitEconomics } from '../../../types/business.types.js';
import { MonetizationModelSchema } from '../../../schemas/business.schema.js';

export const outputSchema = MonetizationModelSchema;

export function buildPrompt(tiers: OfferTier[], economics: UnitEconomics): LLMMessage[] {
  return [
    {
      role: 'system',
      content: "You are a Monetization Architect. Your cognitive stance: design the pricing architecture, upsell logic, and expansion revenue paths. The monetization model must survive a competitor's counter-move. Name the churn assumptions explicitly — if a churn assumption is wrong, the model breaks.",
    },
    {
      role: 'user',
      content: `Design the monetization model for:

OFFER TIERS: ${JSON.stringify(tiers, null, 2)}
UNIT ECONOMICS: ${JSON.stringify(economics, null, 2)}

Return JSON:
{
  "pricingArchitecture": "how pricing is structured and why",
  "upsellLogic": "what triggers an upgrade and the mechanism",
  "churnAssumptions": ["assumption 1", "assumption 2"],
  "expansionRevenuePaths": ["path 1", "path 2"]
}`,
    },
  ];
}

export function parseOutput(raw: string): MonetizationModel {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Monetization architect output does not contain JSON object');
  return outputSchema.parse(JSON.parse(jsonMatch[0]));
}
