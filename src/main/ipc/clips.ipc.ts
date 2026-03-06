import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getDb } from '../db/connection'
import {
  getAllClips,
  getClipById,
  insertClip,
  updateClip,
  deleteClip,
  recordClipLaunch
} from '../db/queries/clips.queries'
import type { IpcResponse } from '../../shared/types/ipc.types'
import type { Clip, InsertClipData } from '../db/queries/clips.queries'
import { z } from 'zod/v4'

const createClipSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  prompt: z.string().min(1),
  defaultRepoId: z.string().optional()
})

const updateClipSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  prompt: z.string().min(1).optional(),
  defaultRepoId: z.string().optional()
})

export function registerClipsHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.CLIPS.LIST,
    async (): Promise<IpcResponse<Clip[]>> => {
      try {
        return success(getAllClips(getDb()))
      } catch (err) {
        return error('CLIPS_LIST_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CLIPS.GET,
    async (_event, id: unknown): Promise<IpcResponse<Clip | null>> => {
      try {
        const validation = validateInput(z.string(), id)
        if (!validation.valid) return validation.response
        return success(getClipById(getDb(), validation.data))
      } catch (err) {
        return error('CLIPS_GET_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CLIPS.CREATE,
    async (_event, input: unknown): Promise<IpcResponse<Clip>> => {
      try {
        const validation = validateInput(createClipSchema, input)
        if (!validation.valid) return validation.response
        const result = insertClip(getDb(), validation.data as InsertClipData)
        return success(result)
      } catch (err) {
        return error('CLIPS_CREATE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CLIPS.UPDATE,
    async (_event, id: unknown, input: unknown): Promise<IpcResponse<Clip | null>> => {
      try {
        const idValidation = validateInput(z.string(), id)
        if (!idValidation.valid) return idValidation.response
        const inputValidation = validateInput(updateClipSchema, input)
        if (!inputValidation.valid) return inputValidation.response
        const result = updateClip(getDb(), idValidation.data, inputValidation.data as Partial<InsertClipData>)
        return success(result)
      } catch (err) {
        return error('CLIPS_UPDATE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CLIPS.DELETE,
    async (_event, id: unknown): Promise<IpcResponse<void>> => {
      try {
        const validation = validateInput(z.string(), id)
        if (!validation.valid) return validation.response
        deleteClip(getDb(), validation.data)
        return success(undefined)
      } catch (err) {
        return error('CLIPS_DELETE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CLIPS.RECORD_LAUNCH,
    async (_event, id: unknown): Promise<IpcResponse<void>> => {
      try {
        const validation = validateInput(z.string(), id)
        if (!validation.valid) return validation.response
        recordClipLaunch(getDb(), validation.data)
        return success(undefined)
      } catch (err) {
        return error('CLIPS_RECORD_LAUNCH_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('Clips IPC handlers registered')
}
