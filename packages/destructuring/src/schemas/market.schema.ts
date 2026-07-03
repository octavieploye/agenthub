import { z } from 'zod/v4';

export const MarketSegmentSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  estimatedSize: z.string(),
  painPoints: z.array(z.string()),
  currentSolutions: z.array(z.string()),
  underservedAspect: z.string(),
});

export const ChannelStrategySchema = z.object({
  channel: z.string().min(1),
  type: z.enum(['owned', 'earned', 'paid']),
  segment: z.string(),
  sequencing: z.enum(['pre-launch', 'launch', 'post-launch']),
  rationale: z.string(),
});

export const PositioningAnalysisSchema = z.object({
  existingPositions: z.array(
    z.object({
      competitor: z.string(),
      position: z.string(),
    })
  ),
  whiteSpace: z.string(),
  messagingArchitecture: z.string(),
});

export const EntryVectorSchema = z.object({
  name: z.string().min(1),
  segment: z.string(),
  channel: z.string(),
  sequencing: z.string(),
  rationale: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high']),
});

export const MarketStrategyMapSchema = z.object({
  subject: z.string().min(1),
  segments: z.array(MarketSegmentSchema).min(1),
  channels: z.array(ChannelStrategySchema).min(1),
  positioning: PositioningAnalysisSchema,
  entryVectors: z.array(EntryVectorSchema).min(1),
});

export type MarketSegmentInferred = z.infer<typeof MarketSegmentSchema>;
export type ChannelStrategyInferred = z.infer<typeof ChannelStrategySchema>;
export type PositioningAnalysisInferred = z.infer<typeof PositioningAnalysisSchema>;
export type EntryVectorInferred = z.infer<typeof EntryVectorSchema>;
export type MarketStrategyMapInferred = z.infer<typeof MarketStrategyMapSchema>;
