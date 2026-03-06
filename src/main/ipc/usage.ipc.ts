import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error } from './ipc-helpers'
import { getClaudeMonitor } from '../services/service-orchestrator'

export function registerUsageHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.USAGE.GET_SNAPSHOT, () => {
    try {
      const monitor = getClaudeMonitor()
      if (!monitor) {
        return error('USAGE_NOT_READY', 'Claude monitor not initialized')
      }
      const snapshot = monitor.getSnapshot()
      // Convert Map to plain object for IPC serialization
      const serializable = {
        ...snapshot,
        byModel: Object.fromEntries(snapshot.byModel)
      }
      return success(serializable)
    } catch (err) {
      log.error('Failed to get usage snapshot', err)
      return error('USAGE_ERROR', (err as Error).message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.USAGE.REFRESH, async () => {
    try {
      const monitor = getClaudeMonitor()
      if (!monitor) {
        return error('USAGE_NOT_READY', 'Claude monitor not initialized')
      }
      await monitor.refresh()
      const snapshot = monitor.getSnapshot()
      const serializable = {
        ...snapshot,
        byModel: Object.fromEntries(snapshot.byModel)
      }
      return success(serializable)
    } catch (err) {
      log.error('Failed to refresh usage', err)
      return error('USAGE_ERROR', (err as Error).message)
    }
  })

  log.info('Usage IPC handlers registered')
}
