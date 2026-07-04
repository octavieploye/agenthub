import { z } from 'zod/v4';
import { GeoRadiusSchema } from './base.schema.js';

export const CompetitorCardSchema = z.object({
  name: z.string().min(1),
  url: z.string().optional(),
  geoRing: GeoRadiusSchema,
  location: z.string(),
  category: z.enum(['direct', 'adjacent', 'upstream', 'downstream', 'substitute']),
  audienceServed: z.string(),
  coreValueProp: z.string(),
  pricingModel: z.string(),
  deploymentModel: z.enum(['cloud', 'local', 'hybrid']),
  keyWeakness: z.string(),
  keyStrength: z.string(),
  switchingCost: z.enum(['low', 'medium', 'high']),
});

export const CompetitorProfileSchema = CompetitorCardSchema.extend({
  acquisitionChannels: z.array(z.string()),
  techStack: z.array(z.string()),
  moat: z.string(),
  gaps: z.array(z.string()),
  complaints: z.array(z.string()),
});

export const CompetitorRingResultSchema = z.object({
  radius: GeoRadiusSchema,
  label: z.string(),
  competitors: z.array(CompetitorProfileSchema),
});

export const CompetitorMapSchema = z.object({
  subject: z.string(),
  geoBase: z.string(),
  rings: z.array(CompetitorRingResultSchema),
  totalCompetitors: z.number().int().min(0),
});

export type CompetitorCardInferred = z.infer<typeof CompetitorCardSchema>;
export type CompetitorProfileInferred = z.infer<typeof CompetitorProfileSchema>;
export type CompetitorRingResultInferred = z.infer<typeof CompetitorRingResultSchema>;
export type CompetitorMapInferred = z.infer<typeof CompetitorMapSchema>;
