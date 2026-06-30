import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import type { TelegramNotificationPrefs } from '../../shared/types/telegram.types'
import { getDb } from '../db/connection'
import { getTelegramPrefs, setTelegramPref } from '../db/queries/telegram.queries'
import { getTelegramSidecarService, getTelegramQueueProcessor } from '../services/service-orchestrator'

export function registerTelegramIpc(): void {
  ipcMain.handle(IPC_CHANNELS.TELEGRAM.GET_STATUS, () => {
    return getTelegramSidecarService()?.getStatus() ?? { connected: false }
  })

  ipcMain.handle(IPC_CHANNELS.TELEGRAM.SAVE_TOKEN, async (_event, token: string) => {
    const svc = getTelegramSidecarService()
    if (!svc) return { success: false, error: 'Service not initialised' }
    try {
      await svc.start(token)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TELEGRAM.DISCONNECT, async () => {
    const svc = getTelegramSidecarService()
    if (!svc) return { success: true }
    await svc.disconnect()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.TELEGRAM.GET_PREFS, () => {
    return getTelegramPrefs(getDb())
  })

  ipcMain.handle(IPC_CHANNELS.TELEGRAM.SET_PREF, (
    _event,
    key: keyof TelegramNotificationPrefs,
    value: boolean
  ) => {
    try {
      setTelegramPref(getDb(), key, value)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TELEGRAM.SEND_TEST, async () => {
    const svc = getTelegramSidecarService()
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

  ipcMain.handle(IPC_CHANNELS.TELEGRAM.GET_NOTIFICATION_STATS, (_event, agentId: string) => {
    const qp = getTelegramQueueProcessor()
    if (!qp) return { sent: 0, queued: 0, failed: 0 }
    return qp.getStats(agentId)
  })

  ipcMain.handle(IPC_CHANNELS.TELEGRAM.GET_NOTIFICATIONS, (_event, agentId: string, limit?: number) => {
    const qp = getTelegramQueueProcessor()
    if (!qp) return []
    return qp.getNotifications(agentId, limit ?? 10)
  })
}
