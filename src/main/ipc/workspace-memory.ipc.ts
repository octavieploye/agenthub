import { ipcMain } from 'electron'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { insertLearning, getLearningsByProject, deleteLearning } from '../db/queries/workspace-memory.queries'
import { updateProject } from '../db/queries/projects.queries'
import { getDb } from '../db/connection'
import type { IpcResponse } from '../../shared/types/ipc.types'
import type { WorkspaceMemoryEntry } from '../../shared/types/workspace-memory.types'
import { success, error } from './ipc-helpers'

export function handleWorkspaceMemoryList(db: Database.Database, projectId: string): IpcResponse<WorkspaceMemoryEntry[]> {
  try {
    return success(getLearningsByProject(db, projectId))
  } catch (e) {
    log.error('[workspace-memory] list failed', e)
    return error('WORKSPACE_MEMORY_ERROR', String(e))
  }
}

export function handleWorkspaceMemoryPin(db: Database.Database, projectId: string, content: string): IpcResponse<WorkspaceMemoryEntry> {
  try {
    return success(insertLearning(db, { projectId, content }))
  } catch (e) {
    log.error('[workspace-memory] pin failed', e)
    return error('WORKSPACE_MEMORY_ERROR', String(e))
  }
}

export function handleWorkspaceMemoryUnpin(db: Database.Database, id: string): IpcResponse<void> {
  try {
    deleteLearning(db, id)
    return success(undefined)
  } catch (e) {
    log.error('[workspace-memory] unpin failed', e)
    return error('WORKSPACE_MEMORY_ERROR', String(e))
  }
}

export function handleWorkspaceMemorySetContextDoc(db: Database.Database, projectId: string, contextDoc: string | null): IpcResponse<void> {
  try {
    updateProject(db, projectId, { contextDoc })
    return success(undefined)
  } catch (e) {
    log.error('[workspace-memory] set-context-doc failed', e)
    return error('WORKSPACE_MEMORY_ERROR', String(e))
  }
}

export function registerWorkspaceMemoryHandlers(): void {
  const db = getDb()

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_MEMORY.LIST, (_event, projectId: unknown) => {
    if (typeof projectId !== 'string') return error('INVALID_INPUT', 'projectId must be a string')
    return handleWorkspaceMemoryList(db, projectId)
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_MEMORY.PIN, (_event, projectId: unknown, content: unknown) => {
    if (typeof projectId !== 'string') return error('INVALID_INPUT', 'projectId must be a string')
    if (typeof content !== 'string' || !content.trim()) return error('INVALID_INPUT', 'content must be a non-empty string')
    return handleWorkspaceMemoryPin(db, projectId, content.trim())
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_MEMORY.UNPIN, (_event, id: unknown) => {
    if (typeof id !== 'string') return error('INVALID_INPUT', 'id must be a string')
    return handleWorkspaceMemoryUnpin(db, id)
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_MEMORY.SET_CONTEXT_DOC, (_event, projectId: unknown, contextDoc: unknown) => {
    if (typeof projectId !== 'string') return error('INVALID_INPUT', 'projectId must be a string')
    if (contextDoc !== null && typeof contextDoc !== 'string') return error('INVALID_INPUT', 'contextDoc must be string or null')
    return handleWorkspaceMemorySetContextDoc(db, projectId, contextDoc as string | null)
  })

  log.info('WorkspaceMemory IPC handlers registered')
}
