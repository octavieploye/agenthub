import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error } from './ipc-helpers'
import { getDb } from '../db/connection'
import { getSBARByAgentId, insertSBAR } from '../db/queries/sbar.queries'
import { buildRecoveryInfo, acknowledgeRecovery } from '../services/recovery-manager'
import type { CreateSBARInput } from '../../shared/types/recovery.types'

export function registerRecoveryHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.RECOVERY.GET_INFO, () => {
    try {
      const db = getDb()
      const info = buildRecoveryInfo(db)
      return success(info)
    } catch (err) {
      log.error('Failed to get recovery info', err)
      return error('RECOVERY_INFO_FAILED', (err as Error).message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY.ACK_RECOVERY, () => {
    try {
      const db = getDb()
      acknowledgeRecovery(db)
      return success(undefined)
    } catch (err) {
      log.error('Failed to ack recovery', err)
      return error('RECOVERY_ACK_FAILED', (err as Error).message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY.GET_SBAR, (_event, agentId: string) => {
    try {
      const db = getDb()
      const sbar = getSBARByAgentId(db, agentId)
      return success(sbar)
    } catch (err) {
      log.error('Failed to get SBAR', err)
      return error('SBAR_FAILED', (err as Error).message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY.CREATE_SBAR, (_event, input: CreateSBARInput) => {
    try {
      const db = getDb()
      const sbar = insertSBAR(db, input)
      return success(sbar)
    } catch (err) {
      log.error('Failed to create SBAR', err)
      return error('SBAR_FAILED', (err as Error).message)
    }
  })

  log.info('Recovery IPC handlers registered')
}
