import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getDb } from '../db/connection'
import { getActivitySince, getActivityStats } from '../db/queries/activity.queries'
import type { IpcResponse } from '../../shared/types/ipc.types'
import type { ActivityEvent, ActivityStats } from '../../shared/types/activity.types'
import { z } from 'zod/v4'

const querySchema = z.object({
  since: z.string(),
  repoId: z.string().optional()
})

const statsSchema = z.object({
  since: z.string()
})

export function registerActivityHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.ACTIVITY.QUERY,
    async (_event, params: unknown): Promise<IpcResponse<ActivityEvent[]>> => {
      try {
        const validation = validateInput(querySchema, params)
        if (!validation.valid) return validation.response
        const { since, repoId } = validation.data
        return success(getActivitySince(getDb(), since, repoId))
      } catch (err) {
        return error('ACTIVITY_QUERY_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.ACTIVITY.STATS,
    async (_event, params: unknown): Promise<IpcResponse<ActivityStats>> => {
      try {
        const validation = validateInput(statsSchema, params)
        if (!validation.valid) return validation.response
        return success(getActivityStats(getDb(), validation.data.since))
      } catch (err) {
        return error('ACTIVITY_STATS_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )
}
