import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import type { TelegramSidecarService } from '../services/telegram-sidecar-service'
import { getTelegramPrefs, setTelegramPref } from '../db/queries/telegram.queries'
import type { TelegramNotificationPrefs } from '../../shared/types/telegram.types'

export function registerTelegramIpc(
  db: Database.Database,
  getService: () => TelegramSidecarService | null
): void {
  ipcMain.handle(IPC_CHANNELS.TELEGRAM.GET_STATUS, () => {
    return getService()?.getStatus() ?? { connected: false }
  })

  ipcMain.handle(IPC_CHANNELS.TELEGRAM.SAVE_TOKEN, async (_event, token: string) => {
    const svc = getService()
    if (!svc) return { success: false, error: 'Service not initialised' }
    try {
      await svc.start(token)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TELEGRAM.DISCONNECT, async () => {
    const svc = getService()
    if (!svc) return { success: true }
    await svc.disconnect()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.TELEGRAM.GET_PREFS, () => {
    return getTelegramPrefs(db)
  })

  ipcMain.handle(IPC_CHANNELS.TELEGRAM.SET_PREF, (
    _event,
    key: keyof TelegramNotificationPrefs,
    value: boolean
  ) => {
    setTelegramPref(db, key, value)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.TELEGRAM.SEND_TEST, async () => {
    const svc = getService()
    if (!svc?.isRunning()) return { success: false, error: 'Not connected' }
    svc.notify({
      type: 'completed',
      agentId: 'test',
      agentName: 'test',
      repo: 'AgentHub',
      summary: 'AgentHub is connected and working.',
      timestamp: new Date().toISOString(),
    })
    return { success: true }
  })
}
