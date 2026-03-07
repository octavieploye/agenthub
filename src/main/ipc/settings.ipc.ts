import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error } from './ipc-helpers'
import { getSettingsService } from '../services/service-orchestrator'
import type { SettingsExport } from '../../shared/types/settings.types'

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET_ALL, async () => {
    try {
      const svc = getSettingsService()
      if (!svc) return error('SERVICE_ERROR', 'SettingsService not initialized')
      return success(svc.getAll())
    } catch (err) {
      return error('SETTINGS_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS.SET, async (_event, key: unknown, value: unknown) => {
    try {
      if (typeof key !== 'string') return error('VALIDATION_ERROR', 'key must be a string')
      if (typeof value !== 'string') return error('VALIDATION_ERROR', 'value must be a string')
      const svc = getSettingsService()
      if (!svc) return error('SERVICE_ERROR', 'SettingsService not initialized')
      svc.set(key, value)
      return success(undefined)
    } catch (err) {
      return error('SETTINGS_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS.EXPORT, async () => {
    try {
      const svc = getSettingsService()
      if (!svc) return error('SERVICE_ERROR', 'SettingsService not initialized')
      return success(svc.exportSettings())
    } catch (err) {
      return error('EXPORT_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS.IMPORT, async (_event, data: unknown) => {
    try {
      const svc = getSettingsService()
      if (!svc) return error('SERVICE_ERROR', 'SettingsService not initialized')
      if (!data || typeof data !== 'object' || !('settings' in data)) {
        return error('VALIDATION_ERROR', 'Invalid settings export data')
      }
      svc.importSettings(data as SettingsExport)
      return success(undefined)
    } catch (err) {
      return error('IMPORT_ERROR', err instanceof Error ? err.message : String(err))
    }
  })
}
