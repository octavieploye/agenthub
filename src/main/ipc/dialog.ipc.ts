import { ipcMain, dialog, BrowserWindow } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error } from './ipc-helpers'
import type { IpcResponse } from '../../shared/types/ipc.types'

export function registerDialogHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.DIALOG.OPEN_DIRECTORY,
    async (): Promise<IpcResponse<string | null>> => {
      try {
        const win = BrowserWindow.getFocusedWindow()
        const result = await dialog.showOpenDialog(win!, {
          properties: ['openDirectory']
        })
        return success(result.canceled ? null : result.filePaths[0] ?? null)
      } catch (err) {
        log.error('Dialog failed', err)
        return error('DIALOG_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('Dialog IPC handlers registered')
}
