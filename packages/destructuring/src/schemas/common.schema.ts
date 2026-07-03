import { z } from 'zod/v4';
import { BusinessProfileSchema } from './business.schema.js';

export const GeoRadiusSchema = z.enum(['local', 'national', 'continental', 'worldwide']);

export const GeoRingSchema = z.object({
  radius: GeoRadiusSchema,
  label: z.string(),
});

export const PriorOutputsSchema = z.object({
  competitorMap: z.unknown().optional(),
  businessProfiles: z.array(BusinessProfileSchema).optional(),
  marketStrategyMap: z.unknown().optional(),
  marketDynamicsMap: z.unknown().optional(),
});

export const DestructuringSubjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  geoBase: z.string().min(1),
  geoRadius: GeoRadiusSchema,
  sector: z.string().min(1),
  priorOutputs: PriorOutputsSchema.optional(),
});

export const PatternExtractionInputSchema = z.object({
  subjects: z.array(DestructuringSubjectSchema).min(2),
  outputs: z.array(PriorOutputsSchema).min(2),
  focusQuestion: z.string().optional(),
});

export type GeoRadiusInferred = z.infer<typeof GeoRadiusSchema>;
export type GeoRingInferred = z.infer<typeof GeoRingSchema>;
export type PriorOutputsInferred = z.infer<typeof PriorOutputsSchema>;
export type DestructuringSubjectInferred = z.infer<typeof DestructuringSubjectSchema>;
export type PatternExtractionInputInferred = z.infer<typeof PatternExtractionInputSchema>;
