import type { ZodType } from 'zod/v4'
import type { IpcSuccess, IpcError, IpcResponse } from '../../shared/types/ipc.types'
import log from 'electron-log/main'

export function success<T>(data: T): IpcSuccess<T> {
  return { success: true, data }
}

export function error(code: string, message: string): IpcError {
  return { success: false, error: { code, message } }
}

export function validateInput<T>(
  schema: ZodType<T>,
  data: unknown
): { valid: true; data: T } | { valid: false; response: IpcError } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { valid: true, data: result.data }
  }
  const message = result.error.issues.map((i) => i.message).join('; ')
  return { valid: false, response: error('VALIDATION_ERROR', message) }
}

export function wrapHandler<T>(
  channel: string,
  handler: (...args: unknown[]) => T | Promise<T>
): (_event: unknown, ...args: unknown[]) => Promise<IpcResponse<T>> {
  return async (_event: unknown, ...args: unknown[]): Promise<IpcResponse<T>> => {
    try {
      const result = await handler(...args)
      return success(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error(`IPC handler error [${channel}]:`, message)
      return error('HANDLER_ERROR', message)
    }
  }
}
