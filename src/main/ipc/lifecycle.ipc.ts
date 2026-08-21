import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { getAnamnesisReader } from '../services/anamnesis-reader'
import log from 'electron-log/main'
import type { IpcResponse } from '../../shared/types/ipc.types'

function success<T>(data: T): IpcResponse<T> {
  return { success: true, data }
}

function error(code: string, message: string): IpcResponse<never> {
  return { success: false, error: { code, message } }
}

function requireReader() {
  const reader = getAnamnesisReader()
  if (!reader) {
    throw new Error('Anamnesis reader not initialized — system mode required')
  }
  return reader
}

export function registerLifecycleHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.LIFECYCLE.GET_METRICS, async () => {
    try {
      const reader = requireReader()
      const data = await reader.getMetrics()
      return success(data)
    } catch (err) {
      log.error('lifecycle:get-metrics failed', err)
      return error('LIFECYCLE_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.LIFECYCLE.GET_DISTRIBUTION, async () => {
    try {
      const reader = requireReader()
      const data = await reader.getDistribution()
      return success(data)
    } catch (err) {
      log.error('lifecycle:get-distribution failed', err)
      return error('LIFECYCLE_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.LIFECYCLE.GET_HISTORY, async (_event, limit?: number) => {
    try {
      const reader = requireReader()
      const data = await reader.getHistory(limit)
      return success(data)
    } catch (err) {
      log.error('lifecycle:get-history failed', err)
      return error('LIFECYCLE_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.LIFECYCLE.GET_ARCHIVED,
    async (_event, params?: { layer?: string; page?: number; page_size?: number }) => {
      try {
        const reader = requireReader()
        const data = await reader.getArchived(params)
        return success(data)
      } catch (err) {
        log.error('lifecycle:get-archived failed', err)
        return error('LIFECYCLE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.LIFECYCLE.UPDATE_POLICY,
    async (_event, layer: string, policy: unknown) => {
      try {
        const reader = requireReader()
        const data = await reader.updatePolicy(layer, policy as Record<string, unknown>)
        return success(data)
      } catch (err) {
        log.error('lifecycle:update-policy failed', err)
        return error('LIFECYCLE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.LIFECYCLE.RUN_CYCLE, async () => {
    try {
      const reader = requireReader()
      const data = await reader.runCycle()
      return success(data)
    } catch (err) {
      log.error('lifecycle:run-cycle failed', err)
      return error('LIFECYCLE_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.LIFECYCLE.RESTORE, async (_event, archiveId: string) => {
    try {
      const reader = requireReader()
      const data = await reader.restore(archiveId)
      return success(data)
    } catch (err) {
      log.error('lifecycle:restore failed', err)
      return error('LIFECYCLE_ERROR', err instanceof Error ? err.message : String(err))
    }
  })
}
