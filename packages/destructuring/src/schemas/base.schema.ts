import { z } from 'zod/v4';

export const GeoRadiusSchema = z.enum(['local', 'national', 'continental', 'worldwide']);

export const GeoRingSchema = z.object({
  radius: GeoRadiusSchema,
  label: z.string(),
});

export type GeoRadiusInferred = z.infer<typeof GeoRadiusSchema>;
export type GeoRingInferred = z.infer<typeof GeoRingSchema>;
