export interface MarketPosition {
  nicheDefinition: string;
  differentiationStatement: string;
  competitiveMoat: string;
  targetSegment: string;
}

export interface OfferTier {
  name: string;
  price: string;
  currency: string;
  billingCycle: 'monthly' | 'annual' | 'one-time' | 'usage-based';
  valueProposition: string;
  includedFeatures: string[];
  excludedFeatures: string[];
  dreamOutcome: string;
}

export interface AcquisitionChannel {
  channel: string;
  type: 'owned' | 'earned' | 'paid';
  personaTarget: string;
  estimatedCostPerAcquisition: string;
  funnelShape: string;
}

export interface UnitEconomics {
  ltv: string;
  cac: string;
  paybackPeriodMonths: number;
  marginPerTier: Record<string, string>;
  churnRateEstimate: string;
}

export interface MonetizationModel {
  pricingArchitecture: string;
  upsellLogic: string;
  churnAssumptions: string[];
  expansionRevenuePaths: string[];
}

export interface BusinessProfile {
  subject: string;
  position: MarketPosition;
  offerTiers: OfferTier[];
  acquisitionChannels: AcquisitionChannel[];
  unitEconomics: UnitEconomics;
  monetization: MonetizationModel;
}
