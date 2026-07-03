import { z } from 'zod/v4';

export const MarketPositionSchema = z.object({
  nicheDefinition: z.string().min(1),
  differentiationStatement: z.string().min(1),
  competitiveMoat: z.string().min(1),
  targetSegment: z.string().min(1),
});

export const OfferTierSchema = z.object({
  name: z.string().min(1),
  price: z.string(),
  currency: z.string(),
  billingCycle: z.enum(['monthly', 'annual', 'one-time', 'usage-based']),
  valueProposition: z.string(),
  includedFeatures: z.array(z.string()),
  excludedFeatures: z.array(z.string()),
  dreamOutcome: z.string(),
});

export const AcquisitionChannelSchema = z.object({
  channel: z.string().min(1),
  type: z.enum(['owned', 'earned', 'paid']),
  personaTarget: z.string(),
  estimatedCostPerAcquisition: z.string(),
  funnelShape: z.string(),
});

export const UnitEconomicsSchema = z.object({
  ltv: z.string(),
  cac: z.string(),
  paybackPeriodMonths: z.number(),
  marginPerTier: z.record(z.string(), z.string()),
  churnRateEstimate: z.string(),
});

export const MonetizationModelSchema = z.object({
  pricingArchitecture: z.string(),
  upsellLogic: z.string(),
  churnAssumptions: z.array(z.string()),
  expansionRevenuePaths: z.array(z.string()),
});

export const BusinessProfileSchema = z.object({
  subject: z.string().min(1),
  position: MarketPositionSchema,
  offerTiers: z.array(OfferTierSchema).min(1),
  acquisitionChannels: z.array(AcquisitionChannelSchema),
  unitEconomics: UnitEconomicsSchema,
  monetization: MonetizationModelSchema,
});

export type MarketPositionInferred = z.infer<typeof MarketPositionSchema>;
export type OfferTierInferred = z.infer<typeof OfferTierSchema>;
export type AcquisitionChannelInferred = z.infer<typeof AcquisitionChannelSchema>;
export type UnitEconomicsInferred = z.infer<typeof UnitEconomicsSchema>;
export type MonetizationModelInferred = z.infer<typeof MonetizationModelSchema>;
export type BusinessProfileInferred = z.infer<typeof BusinessProfileSchema>;
