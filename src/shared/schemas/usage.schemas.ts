import { z } from 'zod/v4'

export const SessionEntrySchema = z.object({
  type: z.enum(['user', 'assistant']),
  timestamp: z.string(),
  sessionId: z.string(),
  message: z.object({
    role: z.string(),
    model: z.string().optional(),
    usage: z
      .object({
        input_tokens: z.number(),
        output_tokens: z.number(),
        cache_creation_input_tokens: z.number().optional(),
        cache_read_input_tokens: z.number().optional()
      })
      .optional()
  })
})

export const UsageResponseSchema = z.object({
  plan: z.enum(['pro', 'max5', 'max20', 'custom']),
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  totalCacheCreationTokens: z.number(),
  totalCacheReadTokens: z.number(),
  totalMessages: z.number(),
  burnRate: z.number(),
  lastUpdated: z.string(),
  resetDate: z.string()
})
