import { ipcMain, app, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { writeFileSync, chmodSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
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

  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.OPEN_TERMINAL,
    async (_event, command: string): Promise<IpcResponse<void>> => {
      try {
        if (!command.startsWith('socat')) {
          return error('INVALID_COMMAND', 'Only socat commands are allowed')
        }

        const escapedCommand = command.replace(/'/g, "'\\''")
        const platform = process.platform

        if (platform === 'darwin') {
          const scriptPath = join(tmpdir(), `agenthub-terminal-${Date.now()}.sh`)
          writeFileSync(scriptPath, `#!/bin/bash\n${command}\nexec bash`, { encoding: 'utf-8' })
          chmodSync(scriptPath, 0o755)
          exec(`open -a Terminal "${scriptPath}"`, (err) => {
            if (err) log.warn('Failed to open macOS Terminal:', err.message)
            // Clean up after a delay to ensure Terminal has read the script
            setTimeout(() => {
              try { unlinkSync(scriptPath) } catch { /* ignore */ }
            }, 5000)
          })
        } else if (platform === 'linux') {
          exec(`which x-terminal-emulator`, (err) => {
            if (!err) {
              exec(`x-terminal-emulator -e bash -c '${escapedCommand}; exec bash'`, (execErr) => {
                if (execErr) log.warn('Failed to open x-terminal-emulator:', execErr.message)
              })
            } else {
              exec(`gnome-terminal -- bash -c '${escapedCommand}; exec bash'`, (execErr) => {
                if (execErr) log.warn('Failed to open gnome-terminal:', execErr.message)
              })
            }
          })
        } else {
          return error('UNSUPPORTED_PLATFORM', `Platform ${platform} is not supported for terminal launch`)
        }

        return success(undefined)
      } catch (err) {
        return error('OPEN_TERMINAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('System IPC handlers registered')
}
