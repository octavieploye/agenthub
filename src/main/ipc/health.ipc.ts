import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getHealthMonitor } from '../services/service-orchestrator'
import { z } from 'zod/v4'

export function registerHealthHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.HEALTH.GET_SNAPSHOT,
    (_event, agentId: unknown) => {
      try {
        const validation = validateInput(z.string(), agentId)
        if (!validation.valid) return validation.response
        const monitor = getHealthMonitor()
        if (!monitor) {
          return error('HEALTH_NOT_READY', 'Health monitor not initialized')
        }
        const snapshot = monitor.getSnapshot(validation.data)
        if (!snapshot) return success(null)
        // Convert Map to plain object for IPC serialization
        return success({
          ...snapshot,
          filesModified: Object.fromEntries(snapshot.filesModified)
        })
      } catch (err) {
        log.error('Failed to get health snapshot', err)
        return error('HEALTH_ERROR', (err as Error).message)
      }
    }
  )

  log.info('Health IPC handlers registered')
}
