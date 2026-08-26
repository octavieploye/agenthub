import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error } from './ipc-helpers'
import { listAllModels, fetchOllamaCloudModels } from '../services/model-service'
import { checkCodexHealth, type CodexHealthStatus } from '../services/codex-health'
import type { IpcResponse } from '../../shared/types/ipc.types'
import type { ModelCatalogEntry } from '../../shared/types/model.types'

export function registerModelsHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.MODELS.LIST_ALL,
    async (): Promise<IpcResponse<ModelCatalogEntry[]>> => {
      try {
        const models = await listAllModels()
        return success(models)
      } catch (err) {
        log.error('Failed to list models', err)
        return error('MODELS_LIST_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MODELS.FETCH_OLLAMA,
    async (): Promise<IpcResponse<ModelCatalogEntry[]>> => {
      try {
        const models = await fetchOllamaCloudModels()
        return success(models)
      } catch (err) {
        log.error('Failed to fetch Ollama models', err)
        return error('OLLAMA_FETCH_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MODELS.CODEX_HEALTH,
    async (): Promise<IpcResponse<CodexHealthStatus>> => {
      try {
        const status = await checkCodexHealth()
        return success(status)
      } catch (err) {
        log.error('Failed to check Codex health', err)
        return error('CODEX_HEALTH_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('Models IPC handlers registered')
}
