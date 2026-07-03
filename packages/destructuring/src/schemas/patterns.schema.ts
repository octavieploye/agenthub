import { z } from 'zod/v4';

export const PatternVerdictSchema = z.enum(['good', 'bad', 'neutral', 'context-dependent']);

export const ExtractedPatternSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  verdict: PatternVerdictSchema,
  frequency: z.number().int().min(0),
  totalSubjects: z.number().int().min(1),
  evidence: z.array(z.string()).min(1),
  confidence: z.enum(['high', 'medium', 'low']),
  domain: z.enum(['pricing', 'positioning', 'acquisition', 'monetization', 'market-entry', 'competitive', 'structural']),
});

export const PatternReportSchema = z.object({
  focusQuestion: z.string().optional(),
  subjectCount: z.number().int().min(2),
  goodPatterns: z.array(ExtractedPatternSchema),
  badPatterns: z.array(ExtractedPatternSchema),
  neutralPatterns: z.array(ExtractedPatternSchema),
  blindSpots: z.array(z.string()),
  synthesis: z.string().min(1),
});

export type PatternVerdictInferred = z.infer<typeof PatternVerdictSchema>;
export type ExtractedPatternInferred = z.infer<typeof ExtractedPatternSchema>;
export type PatternReportInferred = z.infer<typeof PatternReportSchema>;
