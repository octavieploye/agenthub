import { z } from 'zod/v4'

export const ContainerStatusSchema = z.enum(['creating', 'running', 'stopped', 'destroyed', 'error'])

export const DockerContainerConfigSchema = z.object({
  cpus: z.number().min(0.5).max(16),
  memoryGb: z.number().min(0.5).max(64),
  networkMode: z.enum(['host', 'none']),
  repoPath: z.string(),
  isLeadAgent: z.boolean()
})

export const ContainerInfoSchema = z.object({
  id: z.string(),
  repoId: z.string(),
  containerId: z.string(),
  status: ContainerStatusSchema,
  createdAt: z.string(),
  lastActivity: z.string(),
  config: DockerContainerConfigSchema
})

export const DockerStatusSchema = z.object({
  available: z.boolean(),
  version: z.string().optional(),
  imageReady: z.boolean(),
  imageTag: z.string(),
  activeContainerCount: z.number()
})

export const DockerConfigSchema = z.object({
  enabled: z.boolean(),
  ttlDays: z.number().min(1).max(365),
  cpus: z.number().min(0.5).max(16),
  memoryGb: z.number().min(0.5).max(64),
  networkMode: z.enum(['host', 'none'])
})
