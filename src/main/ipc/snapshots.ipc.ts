import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod/v4'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import type { SnapshotTrigger } from '../../shared/types/recovery.types'

const snapshotTriggerSchema = z.enum([
  'periodic', 'agent_spawn', 'agent_kill', 'agent_status_change',
  'view_switch', 'app_close', 'manual'
])

let snapshotEngine: {
  takeSnapshot(trigger: SnapshotTrigger): unknown
  getLastSnapshot(): unknown
  prune(): number
} | null = null

export function setSnapshotEngine(engine: typeof snapshotEngine): void {
  snapshotEngine = engine
}

export function registerSnapshotHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SNAPSHOTS.TAKE, (_event, trigger?: string) => {
    try {
      if (!snapshotEngine) {
        return error('SNAPSHOT_NOT_READY', 'Snapshot engine not initialized')
      }
      const parsed = validateInput(snapshotTriggerSchema, trigger ?? 'manual')
      const validTrigger: SnapshotTrigger = parsed.valid ? parsed.data : 'manual'
      const snapshot = snapshotEngine.takeSnapshot(validTrigger)
      return success(snapshot)
    } catch (err) {
      log.error('Failed to take snapshot', err)
      return error('SNAPSHOT_FAILED', (err as Error).message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.SNAPSHOTS.GET_LATEST, () => {
    try {
      if (!snapshotEngine) {
        return error('SNAPSHOT_NOT_READY', 'Snapshot engine not initialized')
      }
      const snapshot = snapshotEngine.getLastSnapshot()
      return success(snapshot)
    } catch (err) {
      log.error('Failed to get latest snapshot', err)
      return error('SNAPSHOT_FAILED', (err as Error).message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.SNAPSHOTS.PRUNE, () => {
    try {
      if (!snapshotEngine) {
        return error('SNAPSHOT_NOT_READY', 'Snapshot engine not initialized')
      }
      const deleted = snapshotEngine.prune()
      return success({ deleted })
    } catch (err) {
      log.error('Failed to prune snapshots', err)
      return error('SNAPSHOT_FAILED', (err as Error).message)
    }
  })

  log.info('Snapshot IPC handlers registered')
}
