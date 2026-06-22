import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod/v4'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getDb } from '../db/connection'
import { getSBARByAgentId, insertSBAR } from '../db/queries/sbar.queries'
import { buildRecoveryInfo, acknowledgeRecovery } from '../services/recovery-manager'

const createSBARSchema = z.object({
  agentId: z.string().min(1),
  agentName: z.string().min(1),
  repoId: z.string().min(1),
  situation: z.string().min(1),
  background: z.string().min(1),
  assessment: z.string().min(1),
  recommendation: z.string().min(1)
})

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

  ipcMain.handle(IPC_CHANNELS.RECOVERY.GET_SBAR, (_event, agentId: unknown) => {
    try {
      const parsed = validateInput(z.string().min(1), agentId)
      if (!parsed.valid) return parsed.response
      const db = getDb()
      const sbar = getSBARByAgentId(db, parsed.data)
      return success(sbar)
    } catch (err) {
      log.error('Failed to get SBAR', err)
      return error('SBAR_FAILED', (err as Error).message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY.CREATE_SBAR, (_event, input: unknown) => {
    try {
      const parsed = validateInput(createSBARSchema, input)
      if (!parsed.valid) return parsed.response
      const db = getDb()
      const sbar = insertSBAR(db, parsed.data)
      return success(sbar)
    } catch (err) {
      log.error('Failed to create SBAR', err)
      return error('SBAR_FAILED', (err as Error).message)
    }
  })

  log.info('Recovery IPC handlers registered')
}
