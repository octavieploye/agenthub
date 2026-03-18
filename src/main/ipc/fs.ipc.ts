import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod/v4'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getFsService } from '../services/service-orchestrator'
import type { IpcResponse } from '../../shared/types/ipc.types'
import type { FileTreeNode, ReadFileResult } from '../../shared/types/fs.types'

const readDirSchema = z.object({
  repoPath: z.string().min(1),
  dirPath: z.string()
})

const readFileSchema = z.object({
  repoPath: z.string().min(1),
  filePath: z.string().min(1)
})

export function registerFsHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.FS.READ_DIR,
    async (_event, input: unknown): Promise<IpcResponse<FileTreeNode[]>> => {
      try {
        const v = validateInput(readDirSchema, input)
        if (!v.valid) return v.response
        const svc = getFsService()
        if (!svc) return error('FS_SERVICE_UNAVAILABLE', 'File system service not initialized')
        return success(await svc.readDir(v.data.repoPath, v.data.dirPath))
      } catch (err) {
        log.error('FS READ_DIR failed', err)
        return error('FS_READ_DIR_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FS.READ_FILE,
    async (_event, input: unknown): Promise<IpcResponse<ReadFileResult>> => {
      try {
        const v = validateInput(readFileSchema, input)
        if (!v.valid) return v.response
        const svc = getFsService()
        if (!svc) return error('FS_SERVICE_UNAVAILABLE', 'File system service not initialized')
        return success(await svc.readFile(v.data.repoPath, v.data.filePath))
      } catch (err) {
        log.error('FS READ_FILE failed', err)
        return error('FS_READ_FILE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('FS IPC handlers registered')
}
