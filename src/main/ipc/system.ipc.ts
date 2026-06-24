import { ipcMain, app, BrowserWindow } from 'electron'
import { execFile, spawn as spawnChild } from 'child_process'
import { writeFileSync, chmodSync, unlinkSync, existsSync, openSync, closeSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import log from 'electron-log/main'
import { z } from 'zod/v4'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
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

  const socketPathSchema = z.string().min(1)

  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.OPEN_TERMINAL,
    async (_event, socketPath: unknown): Promise<IpcResponse<void>> => {
      try {
        const parsed = validateInput(socketPathSchema, socketPath)
        if (!parsed.valid) return parsed.response

        const validatedPath = parsed.data
        // Security: only allow socket paths in known temp directories
        const allowedPrefixes = [tmpdir(), '/tmp/', '/private/tmp/']
        const isAllowed = allowedPrefixes.some(p => validatedPath.startsWith(p))
        if (!isAllowed || !existsSync(validatedPath)) {
          return error('INVALID_SOCKET', 'Socket path must be in a temp directory and exist on disk')
        }

        // Construct the command server-side — never accept a full command from renderer
        const nodeCommand = `require('net').connect('${validatedPath.replace(/'/g, "\\'")}',()=>{process.stdin.pipe(require('net').connect('${validatedPath.replace(/'/g, "\\'")}'));require('net').connect('${validatedPath.replace(/'/g, "\\'")}').pipe(process.stdout)})`
        const platform = process.platform

        if (platform === 'darwin') {
          const scriptPath = join(tmpdir(), `agenthub-terminal-${Date.now()}.sh`)
          // Use O_CREAT | O_EXCL (wx flag) to prevent TOCTOU race
          const fd = openSync(scriptPath, 'wx', 0o700)
          closeSync(fd)
          writeFileSync(scriptPath, `#!/bin/zsh -l\nnode -e "${nodeCommand.replace(/"/g, '\\"')}"\nexec zsh`, { encoding: 'utf-8' })
          chmodSync(scriptPath, 0o700)
          spawnChild('open', ['-a', 'Terminal', scriptPath], { detached: true, stdio: 'ignore' })
          setTimeout(() => {
            try { unlinkSync(scriptPath) } catch { /* ignore */ }
          }, 5000)
        } else if (platform === 'linux') {
          const shellCmd = `node -e '${nodeCommand.replace(/'/g, "'\\''")}'; exec bash`
          execFile('which', ['x-terminal-emulator'], (err) => {
            if (!err) {
              spawnChild('x-terminal-emulator', ['-e', 'bash', '-c', shellCmd], { detached: true, stdio: 'ignore' })
            } else {
              spawnChild('gnome-terminal', ['--', 'bash', '-c', shellCmd], { detached: true, stdio: 'ignore' })
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

  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.GET_INTAKE_DIR,
    async (): Promise<IpcResponse<string>> => {
      try {
        return success(join(app.getPath('userData'), 'sprint-intake'))
      } catch (err) {
        return error('GET_INTAKE_DIR_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('System IPC handlers registered')
}
