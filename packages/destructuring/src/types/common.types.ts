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
  competitorMap?: unknown;
  businessProfiles?: unknown[];
  marketStrategyMap?: unknown;
  marketDynamicsMap?: unknown;
}

export interface PatternExtractionInput {
  subjects: DestructuringSubject[];
  outputs: PriorOutputs[];
  focusQuestion?: string;
}
