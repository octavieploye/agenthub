import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getDb } from '../db/connection'
import { getAllRepos, insertRepo, deleteRepo, updateRepoGlowColor } from '../db/queries/repos.queries'
import type { IpcResponse } from '../../shared/types/ipc.types'
import type { RepoConfig } from '../../shared/types/config.types'
import { z } from 'zod/v4'

export function registerDbHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.DB.GET_REPOS,
    async (): Promise<IpcResponse<RepoConfig[]>> => {
      try {
        return success(getAllRepos(getDb()))
      } catch (err) {
        return error('GET_REPOS_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DB.ADD_REPO,
    async (_event, repo: unknown): Promise<IpcResponse<RepoConfig>> => {
      try {
        const schema = z.object({
          name: z.string(),
          path: z.string(),
          glowColor: z.string().optional()
        })
        const validation = validateInput(schema, repo)
        if (!validation.valid) return validation.response
        const result = insertRepo(getDb(), validation.data)
        return success(result)
      } catch (err) {
        return error('ADD_REPO_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DB.REMOVE_REPO,
    async (_event, repoId: unknown): Promise<IpcResponse<void>> => {
      try {
        const validation = validateInput(z.string(), repoId)
        if (!validation.valid) return validation.response
        deleteRepo(getDb(), validation.data)
        return success(undefined)
      } catch (err) {
        return error('REMOVE_REPO_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DB.UPDATE_REPO_COLOR,
    async (_event, repoId: unknown, color: unknown): Promise<IpcResponse<void>> => {
      try {
        const idValidation = validateInput(z.string(), repoId)
        if (!idValidation.valid) return idValidation.response
        const colorValidation = validateInput(z.string(), color)
        if (!colorValidation.valid) return colorValidation.response
        updateRepoGlowColor(getDb(), idValidation.data, colorValidation.data)
        return success(undefined)
      } catch (err) {
        return error('UPDATE_REPO_COLOR_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('DB IPC handlers registered')
}
