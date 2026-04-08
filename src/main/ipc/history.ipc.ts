import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getDb } from '../db/connection'
import {
  getHistoryByAgent,
  searchAgentHistory
} from '../db/queries/history.queries'
import type { IpcResponse } from '../../shared/types/ipc.types'
import type { HistoryEntry, HistorySearchResult } from '../../shared/types/history.types'
import { z } from 'zod/v4'


export function registerHistoryHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.HISTORY.GET,
    async (_event, agentId: unknown): Promise<IpcResponse<HistoryEntry[]>> => {
      try {
        const validation = validateInput(z.string(), agentId)
        if (!validation.valid) return validation.response
        return success(getHistoryByAgent(getDb(), validation.data))
      } catch (err) {
        return error('HISTORY_GET_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.HISTORY.SEARCH,
    async (_event, agentId: unknown, query: unknown): Promise<IpcResponse<HistorySearchResult[]>> => {
      try {
        const agentValidation = validateInput(z.string(), agentId)
        if (!agentValidation.valid) return agentValidation.response
        const queryValidation = validateInput(z.string().min(1), query)
        if (!queryValidation.valid) return queryValidation.response
        return success(searchAgentHistory(getDb(), agentValidation.data, queryValidation.data))
      } catch (err) {
        return error('HISTORY_SEARCH_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('History IPC handlers registered')
}
