import type { GeoRadius } from './common.types.js';

export interface CompetitorCard {
  name: string;
  url?: string;
  geoRing: GeoRadius;
  location: string;
  category: 'direct' | 'adjacent' | 'upstream' | 'downstream' | 'substitute';
  audienceServed: string;
  coreValueProp: string;
  pricingModel: string;
  deploymentModel: 'cloud' | 'local' | 'hybrid';
  keyWeakness: string;
  keyStrength: string;
  switchingCost: 'low' | 'medium' | 'high';
}

export interface CompetitorProfile extends CompetitorCard {
  acquisitionChannels: string[];
  techStack: string[];
  moat: string;
  gaps: string[];
  complaints: string[];
}

export interface CompetitorMap {
  subject: string;
  geoBase: string;
  rings: CompetitorRingResult[];
  totalCompetitors: number;
}

export interface CompetitorRingResult {
  radius: GeoRadius;
  label: string;
  competitors: CompetitorProfile[];
}
