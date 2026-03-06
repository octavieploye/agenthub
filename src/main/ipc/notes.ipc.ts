import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getDb } from '../db/connection'
import {
  getNoteById,
  getScratchNotes,
  getRepoNotes,
  getGlobalNotes,
  upsertNote,
  deleteNote
} from '../db/queries/notes.queries'
import type { IpcResponse } from '../../shared/types/ipc.types'
import type { NoteItem, CreateNoteInput } from '../../shared/types/note.types'
import { z } from 'zod/v4'

const createNoteSchema = z.object({
  type: z.enum(['scratch', 'repo', 'global']),
  agentId: z.string().optional(),
  repoPath: z.string().optional(),
  content: z.string()
})

export function registerNotesHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.NOTES.GET,
    async (_event, id: unknown): Promise<IpcResponse<NoteItem | null>> => {
      try {
        const validation = validateInput(z.number(), id)
        if (!validation.valid) return validation.response
        return success(getNoteById(getDb(), validation.data))
      } catch (err) {
        return error('NOTES_GET_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTES.GET_BY_AGENT,
    async (_event, agentId: unknown): Promise<IpcResponse<NoteItem[]>> => {
      try {
        const validation = validateInput(z.string(), agentId)
        if (!validation.valid) return validation.response
        return success(getScratchNotes(getDb(), validation.data))
      } catch (err) {
        return error('NOTES_GET_BY_AGENT_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTES.GET_BY_REPO,
    async (_event, repoPath: unknown): Promise<IpcResponse<NoteItem[]>> => {
      try {
        const validation = validateInput(z.string(), repoPath)
        if (!validation.valid) return validation.response
        return success(getRepoNotes(getDb(), validation.data))
      } catch (err) {
        return error('NOTES_GET_BY_REPO_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTES.GET_GLOBAL,
    async (): Promise<IpcResponse<NoteItem[]>> => {
      try {
        return success(getGlobalNotes(getDb()))
      } catch (err) {
        return error('NOTES_GET_GLOBAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTES.SAVE,
    async (_event, input: unknown): Promise<IpcResponse<NoteItem>> => {
      try {
        const validation = validateInput(createNoteSchema, input)
        if (!validation.valid) return validation.response
        const result = upsertNote(getDb(), validation.data as CreateNoteInput)
        return success(result)
      } catch (err) {
        return error('NOTES_SAVE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTES.DELETE,
    async (_event, id: unknown): Promise<IpcResponse<void>> => {
      try {
        const validation = validateInput(z.number(), id)
        if (!validation.valid) return validation.response
        deleteNote(getDb(), validation.data)
        return success(undefined)
      } catch (err) {
        return error('NOTES_DELETE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('Notes IPC handlers registered')
}
