import type { CompetitorMap } from './competitor.types.js';
import type { BusinessProfile } from './business.types.js';

export type GeoRadius = 'local' | 'national' | 'continental' | 'worldwide';

export interface GeoRing {
  radius: GeoRadius;
  label: string;
}

export interface DestructuringSubject {
  name: string;
  description: string;
  geoBase: string;
  geoRadius: GeoRadius;
  sector: string;
  priorOutputs?: PriorOutputs;
}

export interface PriorOutputs {
  competitorMap?: CompetitorMap;
  businessProfiles?: BusinessProfile[];
  marketStrategyMap?: unknown;
  marketDynamicsMap?: unknown;
}

export interface PatternExtractionInput {
  subjects: DestructuringSubject[];
  outputs: PriorOutputs[];
  focusQuestion?: string;
}
