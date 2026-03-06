import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getDb } from '../db/connection'
import { searchAll } from '../db/queries/search.queries'
import type { IpcResponse } from '../../shared/types/ipc.types'
import type { SearchResult } from '../../shared/types/search.types'
import { z } from 'zod/v4'

export function registerSearchHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.SEARCH.QUERY,
    async (_event, query: unknown): Promise<IpcResponse<SearchResult[]>> => {
      try {
        const validation = validateInput(z.string(), query)
        if (!validation.valid) return validation.response
        const results = searchAll(getDb(), validation.data)
        return success(results)
      } catch (err) {
        return error('SEARCH_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('Search IPC handlers registered')
}
