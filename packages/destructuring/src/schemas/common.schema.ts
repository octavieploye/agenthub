import { z } from 'zod/v4';
import { GeoRadiusSchema } from './base.schema.js';
import { BusinessProfileSchema } from './business.schema.js';
import { MarketStrategyMapSchema } from './market.schema.js';
import { MarketDynamicsMapSchema } from './dynamics.schema.js';
import { CompetitorMapSchema } from './competitor.schema.js';

export { GeoRadiusSchema, GeoRingSchema } from './base.schema.js';
export type { GeoRadiusInferred, GeoRingInferred } from './base.schema.js';

export const PriorOutputsSchema = z.object({
  competitorMap: CompetitorMapSchema.optional(),
  businessProfiles: z.array(BusinessProfileSchema).optional(),
  marketStrategyMap: MarketStrategyMapSchema.optional(),
  marketDynamicsMap: MarketDynamicsMapSchema.optional(),
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

export type PriorOutputsInferred = z.infer<typeof PriorOutputsSchema>;
export type DestructuringSubjectInferred = z.infer<typeof DestructuringSubjectSchema>;
export type PatternExtractionInputInferred = z.infer<typeof PatternExtractionInputSchema>;
