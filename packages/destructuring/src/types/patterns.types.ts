export type PatternVerdict = 'good' | 'bad' | 'neutral' | 'context-dependent';

export interface ExtractedPattern {
  name: string;
  description: string;
  verdict: PatternVerdict;
  frequency: number;       // how many subjects exhibit this pattern
  totalSubjects: number;
  evidence: string[];      // specific examples from the destructured subjects
  confidence: 'high' | 'medium' | 'low';
  domain: 'pricing' | 'positioning' | 'acquisition' | 'monetization' | 'market-entry' | 'competitive' | 'structural';
}

export interface PatternReport {
  focusQuestion?: string;
  subjectCount: number;
  goodPatterns: ExtractedPattern[];
  badPatterns: ExtractedPattern[];
  neutralPatterns: ExtractedPattern[];
  blindSpots: string[];    // what the analysis did NOT find across subjects
  synthesis: string;       // narrative synthesis of the pattern landscape
}
