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
  resizeAgent,
  updateAgentColor,
  updateAgentTaskDescription,
  updateAgentModel,
  startPtyProxy,
  stopPtyProxy,
  getPtyProxyPath
} from '../services/agent-manager'
import { ModelProviderSchema, EffortLevelSchema } from '../../shared/schemas/agent.schemas'
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
        const agent = await spawnAgent(validation.data)
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

  // Feature #4: Fire-and-forget IPC — no response needed for high-frequency operations
  ipcMain.on(
    IPC_CHANNELS.AGENTS.SEND_INPUT,
    (_event, agentId: unknown, data: unknown) => {
      try {
        const idValidation = validateInput(z.string(), agentId)
        if (!idValidation.valid) return
        const dataValidation = validateInput(z.string(), data)
        if (!dataValidation.valid) return
        sendInput(idValidation.data, dataValidation.data)
      } catch (err) {
        console.error('SEND_INPUT_ERROR', err)
      }
    }
  )

  ipcMain.on(
    IPC_CHANNELS.AGENTS.RESIZE,
    (_event, agentId: unknown, cols: unknown, rows: unknown) => {
      try {
        const idValidation = validateInput(z.string(), agentId)
        if (!idValidation.valid) return
        const colsValidation = validateInput(z.number().int().positive(), cols)
        if (!colsValidation.valid) return
        const rowsValidation = validateInput(z.number().int().positive(), rows)
        if (!rowsValidation.valid) return
        resizeAgent(idValidation.data, colsValidation.data, rowsValidation.data)
      } catch (err) {
        console.error('RESIZE_ERROR', err)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENTS.UPDATE_COLOR,
    async (_event, agentId: unknown, color: unknown): Promise<IpcResponse<void>> => {
      try {
        const idValidation = validateInput(z.string(), agentId)
        if (!idValidation.valid) return idValidation.response
        const colorValidation = validateInput(z.string(), color)
        if (!colorValidation.valid) return colorValidation.response
        updateAgentColor(idValidation.data, colorValidation.data)
        return success(undefined)
      } catch (err) {
        return error('UPDATE_COLOR_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENTS.UPDATE_TASK_DESCRIPTION,
    async (_event, agentId: unknown, taskDescription: unknown): Promise<IpcResponse<void>> => {
      try {
        const idValidation = validateInput(z.string(), agentId)
        if (!idValidation.valid) return idValidation.response
        const descValidation = validateInput(z.string(), taskDescription)
        if (!descValidation.valid) return descValidation.response
        updateAgentTaskDescription(idValidation.data, descValidation.data)
        return success(undefined)
      } catch (err) {
        return error('UPDATE_TASK_DESCRIPTION_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENTS.UPDATE_MODEL,
    async (
      _event,
      agentId: unknown,
      model: unknown,
      provider: unknown,
      effortLevel: unknown
    ): Promise<IpcResponse<void>> => {
      try {
        const idValidation = validateInput(z.string(), agentId)
        if (!idValidation.valid) return idValidation.response
        const modelValidation = validateInput(z.string(), model)
        if (!modelValidation.valid) return modelValidation.response
        const providerValidation = validateInput(ModelProviderSchema, provider)
        if (!providerValidation.valid) return providerValidation.response
        const effortValidation = validateInput(EffortLevelSchema, effortLevel)
        if (!effortValidation.valid) return effortValidation.response
        updateAgentModel(
          idValidation.data,
          modelValidation.data,
          providerValidation.data,
          effortValidation.data
        )
        return success(undefined)
      } catch (err) {
        return error('UPDATE_MODEL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENTS.ATTACH_TERMINAL,
    async (_event, agentId: unknown): Promise<IpcResponse<{ socketPath: string; attachCommand: string }>> => {
      try {
        const validation = validateInput(z.string().uuid(), agentId)
        if (!validation.valid) return validation.response
        const result = startPtyProxy(validation.data)
        return success(result)
      } catch (err) {
        return error('ATTACH_TERMINAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENTS.DETACH_TERMINAL,
    async (_event, agentId: unknown): Promise<IpcResponse<void>> => {
      try {
        const validation = validateInput(z.string().uuid(), agentId)
        if (!validation.valid) return validation.response
        stopPtyProxy(validation.data)
        return success(undefined)
      } catch (err) {
        return error('DETACH_TERMINAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENTS.GET_PROXY_PATH,
    async (_event, agentId: unknown): Promise<IpcResponse<string | null>> => {
      try {
        const validation = validateInput(z.string().uuid(), agentId)
        if (!validation.valid) return validation.response
        return success(getPtyProxyPath(validation.data))
      } catch (err) {
        return error('GET_PROXY_PATH_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('Agent IPC handlers registered')
}
