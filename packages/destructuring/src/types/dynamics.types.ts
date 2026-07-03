export interface MarketForce {
  type: 'pull' | 'friction' | 'competitive' | 'amplifier';
  name: string;
  description: string;
  strength: number; // 1-10
  affectedSegments: string[];
}

export interface EntryBarrier {
  type: 'regulatory' | 'capital' | 'network-effects' | 'switching-costs' | 'brand' | 'technology';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'prohibitive';
  affectedEntrants: string;
}

export interface PowerStructure {
  actor: string;
  controlMechanism: string;
  concentrationLevel: 'fragmented' | 'moderate' | 'concentrated' | 'monopolistic';
  rentExtraction: string;
  lockInMechanism: string;
}

export interface TrendVector {
  name: string;
  direction: 'growing' | 'stable' | 'declining' | 'volatile';
  timeHorizon: '12mo' | '24mo' | '36mo';
  impact: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface MarketDynamicsMap {
  subject: string;
  forces: MarketForce[];
  barriers: EntryBarrier[];
  powerStructure: PowerStructure[];
  trends: TrendVector[];
}
