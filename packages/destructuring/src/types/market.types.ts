export interface MarketSegment {
  name: string;
  description: string;
  estimatedSize: string;
  painPoints: string[];
  currentSolutions: string[];
  underservedAspect: string;
}

export interface ChannelStrategy {
  channel: string;
  type: 'owned' | 'earned' | 'paid';
  segment: string;
  sequencing: 'pre-launch' | 'launch' | 'post-launch';
  rationale: string;
}

export interface PositioningAnalysis {
  existingPositions: { competitor: string; position: string }[];
  whiteSpace: string;
  messagingArchitecture: string;
}

export interface EntryVector {
  name: string;
  segment: string;
  channel: string;
  sequencing: string;
  rationale: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface MarketStrategyMap {
  subject: string;
  segments: MarketSegment[];
  channels: ChannelStrategy[];
  positioning: PositioningAnalysis;
  entryVectors: EntryVector[];
}
