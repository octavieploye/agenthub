import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error } from './ipc-helpers'
import { getSettingsService } from '../services/service-orchestrator'
import type { SettingsExport } from '../../shared/types/settings.types'
import { storeAnamnesisSecret, hasAnamnesisSecret } from '../services/secret-store'

const MAX_SECRET_LENGTH = 4096

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
      const result = svc.set(key, value)
      if (result && !result.ok) return error('VALIDATION_ERROR', result.message)
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

  // Write-only: the secret is encrypted via safeStorage and never logged or echoed back.
  ipcMain.handle(IPC_CHANNELS.SETTINGS.SET_ANAMNESIS_SECRET, async (_event, secret: unknown) => {
    try {
      if (typeof secret !== 'string') return error('VALIDATION_ERROR', 'secret must be a string')
      const trimmed = secret.trim()
      if (!trimmed) return error('VALIDATION_ERROR', 'secret must not be empty')
      if (trimmed.length > MAX_SECRET_LENGTH) return error('VALIDATION_ERROR', 'secret is too long')
      storeAnamnesisSecret(trimmed)
      return success(undefined)
    } catch (err) {
      return error('SECRET_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET_ANAMNESIS_SECRET_STATUS, async () => {
    try {
      return success({ isSet: hasAnamnesisSecret() })
    } catch (err) {
      return error('SECRET_ERROR', err instanceof Error ? err.message : String(err))
    }
  })
}
