import { z } from 'zod/v4'

export const AgentLifecycleStatusSchema = z.enum([
  'spawning',
  'busy',
  'idle',
  'locked',
  'completed',
  'looping',
  'paused',
  'interrupted',
  'tray_running',
  'error',
  'awaiting_approval'
])

export const StatusConfidenceSchema = z.enum(['confirmed', 'inferred', 'unknown'])

export const ModelProviderSchema = z.enum(['anthropic', 'ollama-local', 'ollama-cloud'])

export const EffortLevelSchema = z.enum(['high', 'medium', 'low'])

export const AgentStateSchema = z.object({
  id: z.string(),
  repoId: z.string(),
  name: z.string(),
  status: AgentLifecycleStatusSchema,
  confidence: StatusConfidenceSchema,
  model: z.string(),
  provider: ModelProviderSchema,
  effortLevel: EffortLevelSchema,
  taskDescription: z.string(),
  pid: z.number().nullable(),
  ptyFd: z.number().nullable(),
  cwd: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  progress: z.number().min(0).max(100),
  color: z.string(),
  executionMode: z.enum(['native', 'docker']).default('native')
})

export const AgentSpawnOptionsSchema = z.object({
  repoId: z.string(),
  name: z.string(),
  cwd: z.string(),
  model: z.string().optional(),
  provider: ModelProviderSchema.optional(),
  effortLevel: EffortLevelSchema.optional(),
  taskDescription: z.string().optional(),
  envOverrides: z.record(z.string(), z.string()).optional(),
  color: z.string().optional(),
  skipPermissions: z.boolean().optional(),
  cols: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional(),
  isLeadAgent: z.boolean().optional()
})
