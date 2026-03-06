import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { AgentSpawnOptionsSchema } from '../../shared/schemas/agent.schemas'
import { success, error, validateInput } from './ipc-helpers'
import {
  spawnAgent,
  killAgent,
  pauseAgent,
  resumeAgent,
  listAgents,
  getAgentState,
  sendInput,
  resizeAgent
} from '../services/agent-manager'
import { deleteAgentScratchNotes } from '../db/queries/notes.queries'
import { getDb } from '../db/connection'
import type { IpcResponse } from '../../shared/types/ipc.types'
import type { AgentState } from '../../shared/types/agent.types'
import { z } from 'zod/v4'

export function registerAgentHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.AGENTS.SPAWN,
    async (_event, options: unknown): Promise<IpcResponse<AgentState>> => {
      try {
        const validation = validateInput(AgentSpawnOptionsSchema, options)
        if (!validation.valid) return validation.response
        const agent = spawnAgent(validation.data)
        return success(agent)
      } catch (err) {
        log.error('Agent spawn failed', err)
        return error('SPAWN_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENTS.KILL,
    async (_event, agentId: unknown): Promise<IpcResponse<void>> => {
      try {
        const validation = validateInput(z.string(), agentId)
        if (!validation.valid) return validation.response
        killAgent(validation.data)
        // Clean up scratch notes for killed agent
        try { deleteAgentScratchNotes(getDb(), validation.data) } catch { /* non-critical */ }
        return success(undefined)
      } catch (err) {
        return error('KILL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENTS.PAUSE,
    async (_event, agentId: unknown): Promise<IpcResponse<void>> => {
      try {
        const validation = validateInput(z.string(), agentId)
        if (!validation.valid) return validation.response
        pauseAgent(validation.data)
        return success(undefined)
      } catch (err) {
        return error('PAUSE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENTS.RESUME,
    async (_event, agentId: unknown): Promise<IpcResponse<void>> => {
      try {
        const validation = validateInput(z.string(), agentId)
        if (!validation.valid) return validation.response
        resumeAgent(validation.data)
        return success(undefined)
      } catch (err) {
        return error('RESUME_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENTS.LIST,
    async (): Promise<IpcResponse<AgentState[]>> => {
      try {
        return success(listAgents())
      } catch (err) {
        return error('LIST_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENTS.GET_STATE,
    async (_event, agentId: unknown): Promise<IpcResponse<AgentState | null>> => {
      try {
        const validation = validateInput(z.string(), agentId)
        if (!validation.valid) return validation.response
        return success(getAgentState(validation.data))
      } catch (err) {
        return error('GET_STATE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENTS.SEND_INPUT,
    async (_event, agentId: unknown, data: unknown): Promise<IpcResponse<void>> => {
      try {
        const idValidation = validateInput(z.string(), agentId)
        if (!idValidation.valid) return idValidation.response
        const dataValidation = validateInput(z.string(), data)
        if (!dataValidation.valid) return dataValidation.response
        sendInput(idValidation.data, dataValidation.data)
        return success(undefined)
      } catch (err) {
        return error('SEND_INPUT_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENTS.RESIZE,
    async (_event, agentId: unknown, cols: unknown, rows: unknown): Promise<IpcResponse<void>> => {
      try {
        const idValidation = validateInput(z.string(), agentId)
        if (!idValidation.valid) return idValidation.response
        const colsValidation = validateInput(z.number().int().positive(), cols)
        if (!colsValidation.valid) return colsValidation.response
        const rowsValidation = validateInput(z.number().int().positive(), rows)
        if (!rowsValidation.valid) return rowsValidation.response
        resizeAgent(idValidation.data, colsValidation.data, rowsValidation.data)
        return success(undefined)
      } catch (err) {
        return error('RESIZE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('Agent IPC handlers registered')
}
