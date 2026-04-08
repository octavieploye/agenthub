import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod/v4'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getGitService } from '../services/service-orchestrator'
import { getDb } from '../db/connection'
import { getAllRepos } from '../db/queries/repos.queries'
import type { IpcResponse } from '../../shared/types/ipc.types'
import type {
  GitRepoStatus,
  GitDiffResult,
  GitCommitEntry,
  GitBranchInfo
} from '../../shared/types/git.types'

const repoPathSchema = z.string().min(1)

const commitSchema = z.object({
  repoPath: z.string().min(1),
  message: z.string().min(1)
})
const pushSchema = z.object({
  repoPath: z.string().min(1),
  branch: z.string().optional()
})
const logSchema = z.object({
  repoPath: z.string().min(1),
  limit: z.number().int().positive().optional()
})
const stageSchema = z.object({
  repoPath: z.string().min(1),
  files: z.array(z.string().min(1))
})
const diffSchema = z.object({
  repoPath: z.string().min(1),
  staged: z.boolean().optional()
})

export function registerGitHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.GIT.GET_STATUS,
    async (_event, repoPath: unknown): Promise<IpcResponse<GitRepoStatus>> => {
      try {
        const v = validateInput(repoPathSchema, repoPath)
        if (!v.valid) return v.response
        const svc = getGitService()
        if (!svc) return error('GIT_SERVICE_UNAVAILABLE', 'Git service not initialized')
        return success(svc.getStatus(v.data))
      } catch (err) {
        log.error('Git GET_STATUS failed', err)
        return error('GIT_STATUS_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT.GET_ALL_STATUS,
    async (): Promise<IpcResponse<GitRepoStatus[]>> => {
      try {
        const svc = getGitService()
        if (!svc) return error('GIT_SERVICE_UNAVAILABLE', 'Git service not initialized')
        const db = getDb()
        const repos = getAllRepos(db)
        const statuses = repos.map((repo) => {
          try {
            return svc.getStatus(repo.path)
          } catch (err) {
            log.warn('Git status failed for repo', { path: repo.path, err })
            return null
          }
        })
        return success(statuses.filter((s): s is GitRepoStatus => s !== null))
      } catch (err) {
        log.error('Git GET_ALL_STATUS failed', err)
        return error('GIT_ALL_STATUS_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT.GET_DIFF,
    async (_event, input: unknown): Promise<IpcResponse<GitDiffResult>> => {
      try {
        const v = validateInput(diffSchema, input)
        if (!v.valid) return v.response
        const svc = getGitService()
        if (!svc) return error('GIT_SERVICE_UNAVAILABLE', 'Git service not initialized')
        return success(svc.getDiff(v.data.repoPath, v.data.staged))
      } catch (err) {
        log.error('Git GET_DIFF failed', err)
        return error('GIT_DIFF_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT.STAGE_FILES,
    async (_event, input: unknown): Promise<IpcResponse<void>> => {
      try {
        const v = validateInput(stageSchema, input)
        if (!v.valid) return v.response
        const svc = getGitService()
        if (!svc) return error('GIT_SERVICE_UNAVAILABLE', 'Git service not initialized')
        svc.stageFiles(v.data.repoPath, v.data.files)
        return success(undefined)
      } catch (err) {
        log.error('Git STAGE_FILES failed', err)
        return error('GIT_STAGE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT.UNSTAGE_FILES,
    async (_event, input: unknown): Promise<IpcResponse<void>> => {
      try {
        const v = validateInput(stageSchema, input)
        if (!v.valid) return v.response
        const svc = getGitService()
        if (!svc) return error('GIT_SERVICE_UNAVAILABLE', 'Git service not initialized')
        svc.unstageFiles(v.data.repoPath, v.data.files)
        return success(undefined)
      } catch (err) {
        log.error('Git UNSTAGE_FILES failed', err)
        return error('GIT_UNSTAGE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT.COMMIT,
    async (_event, input: unknown): Promise<IpcResponse<string>> => {
      try {
        const v = validateInput(commitSchema, input)
        if (!v.valid) return v.response
        const svc = getGitService()
        if (!svc) return error('GIT_SERVICE_UNAVAILABLE', 'Git service not initialized')
        const hash = svc.commit(v.data.repoPath, v.data.message)
        return success(hash)
      } catch (err) {
        log.error('Git COMMIT failed', err)
        return error('GIT_COMMIT_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT.PUSH,
    async (_event, input: unknown): Promise<IpcResponse<void>> => {
      try {
        const v = validateInput(pushSchema, input)
        if (!v.valid) return v.response
        const svc = getGitService()
        if (!svc) return error('GIT_SERVICE_UNAVAILABLE', 'Git service not initialized')
        svc.push(v.data.repoPath, v.data.branch)
        return success(undefined)
      } catch (err) {
        log.error('Git PUSH failed', err)
        return error('GIT_PUSH_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT.PULL,
    async (_event, repoPath: unknown): Promise<IpcResponse<void>> => {
      try {
        const v = validateInput(repoPathSchema, repoPath)
        if (!v.valid) return v.response
        const svc = getGitService()
        if (!svc) return error('GIT_SERVICE_UNAVAILABLE', 'Git service not initialized')
        svc.pull(v.data)
        return success(undefined)
      } catch (err) {
        log.error('Git PULL failed', err)
        return error('GIT_PULL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT.GET_LOG,
    async (_event, input: unknown): Promise<IpcResponse<GitCommitEntry[]>> => {
      try {
        const v = validateInput(logSchema, input)
        if (!v.valid) return v.response
        const svc = getGitService()
        if (!svc) return error('GIT_SERVICE_UNAVAILABLE', 'Git service not initialized')
        return success(svc.getLog(v.data.repoPath, v.data.limit))
      } catch (err) {
        log.error('Git GET_LOG failed', err)
        return error('GIT_LOG_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT.GET_BRANCHES,
    async (_event, repoPath: unknown): Promise<IpcResponse<GitBranchInfo>> => {
      try {
        const v = validateInput(repoPathSchema, repoPath)
        if (!v.valid) return v.response
        const svc = getGitService()
        if (!svc) return error('GIT_SERVICE_UNAVAILABLE', 'Git service not initialized')
        return success(svc.getBranches(v.data))
      } catch (err) {
        log.error('Git GET_BRANCHES failed', err)
        return error('GIT_BRANCHES_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT.SUGGEST_COMMIT,
    async (_event, repoPath: unknown): Promise<IpcResponse<string>> => {
      try {
        const v = validateInput(repoPathSchema, repoPath)
        if (!v.valid) return v.response
        const svc = getGitService()
        if (!svc) return error('GIT_SERVICE_UNAVAILABLE', 'Git service not initialized')
        return success(svc.suggestCommitMessage(v.data))
      } catch (err) {
        log.error('Git SUGGEST_COMMIT failed', err)
        return error('GIT_SUGGEST_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('Git IPC handlers registered')
}
