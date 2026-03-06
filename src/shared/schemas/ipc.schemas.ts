import { z } from 'zod/v4'

export const IpcSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema
  })

export const IpcErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string()
  })
})

export const IpcResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.union([IpcSuccessSchema(dataSchema), IpcErrorSchema])
