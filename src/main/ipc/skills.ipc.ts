import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod/v4'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getSkillsService } from '../services/service-orchestrator'
import type { IpcResponse } from '../../shared/types/ipc.types'
import type { SkillItem, SkillExecutionResult } from '../../shared/types/skills.types'

const listSchema = z.object({
  repoPath: z.string().optional()
})

const executeSchema = z.object({
  skillId: z.string().min(1),
  repoPath: z.string().optional()
})

const refreshSchema = z.object({
  repoPath: z.string().optional()
})

export function registerSkillsHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.SKILLS.LIST,
    async (_event, input: unknown): Promise<IpcResponse<SkillItem[]>> => {
      try {
        const service = getSkillsService()
        if (!service) return error('SKILLS_SERVICE_UNAVAILABLE', 'Skills service not initialized')

        const validation = validateInput(listSchema, input)
        if (!validation.valid) return validation.response

        const skills = service.listSkills(validation.data.repoPath)
        return success(skills)
      } catch (err) {
        log.error('Skills list error:', err)
        return error('SKILLS_LIST_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SKILLS.EXECUTE,
    async (_event, input: unknown): Promise<IpcResponse<SkillExecutionResult>> => {
      try {
        const service = getSkillsService()
        if (!service) return error('SKILLS_SERVICE_UNAVAILABLE', 'Skills service not initialized')

        const validation = validateInput(executeSchema, input)
        if (!validation.valid) return validation.response

        const result = await service.executeSkill(validation.data.skillId, validation.data.repoPath)
        return success(result)
      } catch (err) {
        log.error('Skills execute error:', err)
        return error('SKILLS_EXECUTE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SKILLS.REFRESH,
    async (_event, input: unknown): Promise<IpcResponse<SkillItem[]>> => {
      try {
        const service = getSkillsService()
        if (!service) return error('SKILLS_SERVICE_UNAVAILABLE', 'Skills service not initialized')

        const validation = validateInput(refreshSchema, input)
        if (!validation.valid) return validation.response

        const skills = service.refresh(validation.data.repoPath)
        return success(skills)
      } catch (err) {
        log.error('Skills refresh error:', err)
        return error('SKILLS_REFRESH_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('Skills IPC handlers registered')
}
