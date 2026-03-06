import { z } from 'zod/v4'

export const RepoConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  glowColor: z.string().optional(),
  createdAt: z.string()
})

export const GuardrailConfigSchema = z.object({
  maxDurationMinutes: z.number().positive(),
  maxFilesChanged: z.number().positive(),
  maxConsecutiveErrors: z.number().positive(),
  maxTokensPerSession: z.number().positive(),
  protectedPaths: z.array(z.string())
})
