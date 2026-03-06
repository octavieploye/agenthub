import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getDb } from '../db/connection'
import {
  getAllBugs,
  getBugsByRepo,
  getBugsBySeverity,
  getUnresolvedBugs,
  insertBug,
  resolveBug,
  deleteBug
} from '../db/queries/bugs.queries'
import type { IpcResponse } from '../../shared/types/ipc.types'
import type { BugEntry, BugSeverity } from '../../shared/types/bug-radar.types'
import { z } from 'zod/v4'

const createBugSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  repoId: z.string(),
  repoName: z.string(),
  errorType: z.string(),
  filePath: z.string(),
  message: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical'])
})

export function registerBugsHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.BUGS.LIST,
    async (): Promise<IpcResponse<BugEntry[]>> => {
      try {
        return success(getAllBugs(getDb()))
      } catch (err) {
        return error('BUGS_LIST_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.BUGS.GET_BY_REPO,
    async (_event, repoId: unknown): Promise<IpcResponse<BugEntry[]>> => {
      try {
        const validation = validateInput(z.string(), repoId)
        if (!validation.valid) return validation.response
        return success(getBugsByRepo(getDb(), validation.data))
      } catch (err) {
        return error('BUGS_GET_BY_REPO_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.BUGS.GET_BY_SEVERITY,
    async (_event, severity: unknown): Promise<IpcResponse<BugEntry[]>> => {
      try {
        const validation = validateInput(
          z.enum(['low', 'medium', 'high', 'critical']),
          severity
        )
        if (!validation.valid) return validation.response
        return success(getBugsBySeverity(getDb(), validation.data as BugSeverity))
      } catch (err) {
        return error('BUGS_GET_BY_SEVERITY_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.BUGS.GET_UNRESOLVED,
    async (): Promise<IpcResponse<BugEntry[]>> => {
      try {
        return success(getUnresolvedBugs(getDb()))
      } catch (err) {
        return error('BUGS_GET_UNRESOLVED_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.BUGS.CREATE,
    async (_event, input: unknown): Promise<IpcResponse<BugEntry>> => {
      try {
        const validation = validateInput(createBugSchema, input)
        if (!validation.valid) return validation.response
        const result = insertBug(getDb(), validation.data as {
          agentId: string
          agentName: string
          repoId: string
          repoName: string
          errorType: string
          filePath: string
          message: string
          severity: BugSeverity
        })
        return success(result)
      } catch (err) {
        return error('BUGS_CREATE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.BUGS.RESOLVE,
    async (_event, id: unknown): Promise<IpcResponse<void>> => {
      try {
        const validation = validateInput(z.string(), id)
        if (!validation.valid) return validation.response
        resolveBug(getDb(), validation.data)
        return success(undefined)
      } catch (err) {
        return error('BUGS_RESOLVE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.BUGS.DELETE,
    async (_event, id: unknown): Promise<IpcResponse<void>> => {
      try {
        const validation = validateInput(z.string(), id)
        if (!validation.valid) return validation.response
        deleteBug(getDb(), validation.data)
        return success(undefined)
      } catch (err) {
        return error('BUGS_DELETE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('Bugs IPC handlers registered')
}
