import { z } from 'zod/v4';

export const MarketForceSchema = z.object({
  type: z.enum(['pull', 'friction', 'competitive', 'amplifier']),
  name: z.string().min(1),
  description: z.string(),
  strength: z.number().int().min(1).max(10),
  affectedSegments: z.array(z.string()),
});

export const EntryBarrierSchema = z.object({
  type: z.enum(['regulatory', 'capital', 'network-effects', 'switching-costs', 'brand', 'technology']),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'prohibitive']),
  affectedEntrants: z.string(),
});

export const PowerStructureSchema = z.object({
  actor: z.string().min(1),
  controlMechanism: z.string(),
  concentrationLevel: z.enum(['fragmented', 'moderate', 'concentrated', 'monopolistic']),
  rentExtraction: z.string(),
  lockInMechanism: z.string(),
});

export const TrendVectorSchema = z.object({
  name: z.string().min(1),
  direction: z.enum(['growing', 'stable', 'declining', 'volatile']),
  timeHorizon: z.enum(['12mo', '24mo', '36mo']),
  impact: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const MarketDynamicsMapSchema = z.object({
  subject: z.string().min(1),
  forces: z.array(MarketForceSchema).min(1),
  barriers: z.array(EntryBarrierSchema).min(1),
  powerStructure: z.array(PowerStructureSchema).min(1),
  trends: z.array(TrendVectorSchema).min(1),
});

export type MarketForceInferred = z.infer<typeof MarketForceSchema>;
export type EntryBarrierInferred = z.infer<typeof EntryBarrierSchema>;
export type PowerStructureInferred = z.infer<typeof PowerStructureSchema>;
export type TrendVectorInferred = z.infer<typeof TrendVectorSchema>;
export type MarketDynamicsMapInferred = z.infer<typeof MarketDynamicsMapSchema>;
