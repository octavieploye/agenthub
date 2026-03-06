import { ipcMain, app, BrowserWindow } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error } from './ipc-helpers'
import type { IpcResponse } from '../../shared/types/ipc.types'

export function registerSystemHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.GET_APP_VERSION,
    async (): Promise<IpcResponse<string>> => {
      try {
        return success(app.getVersion())
      } catch (err) {
        return error('VERSION_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.GET_PLATFORM,
    async (): Promise<IpcResponse<string>> => {
      try {
        return success(process.platform)
      } catch (err) {
        return error('PLATFORM_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.SHUTDOWN,
    async (): Promise<IpcResponse<void>> => {
      try {
        app.quit()
        return success(undefined)
      } catch (err) {
        return error('SHUTDOWN_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.MINIMIZE_TO_TRAY,
    async (): Promise<IpcResponse<void>> => {
      try {
        const win = BrowserWindow.getFocusedWindow()
        if (win) win.hide()
        return success(undefined)
      } catch (err) {
        return error('MINIMIZE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('System IPC handlers registered')
}
