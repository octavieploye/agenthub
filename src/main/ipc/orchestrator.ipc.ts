import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { getKanbanOrchestrator } from '../services/service-orchestrator'

const startSchema = z.object({
  sprintName: z.string().min(1),
  repoId: z.string().min(1),
  projectId: z.string().optional(),
  concurrencyCap: z.number().int().min(1).max(10).optional(),
  telegramNotify: z.boolean().optional(),
})

const runIdSchema = z.object({
  runId: z.string().min(1),
})

const taskIdSchema = z.object({
  taskId: z.string().min(1),
})

export function registerOrchestratorHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.START, (_event, input: unknown) => {
    const parsed = startSchema.parse(input)
    const orchestrator = getKanbanOrchestrator()
    if (!orchestrator) throw new Error('Orchestrator service not initialized')
    try {
      return orchestrator.start(parsed)
    } catch (err) {
      log.error('Orchestrator start failed', { err })
      throw err
    }
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.PAUSE, (_event, input: unknown) => {
    const { runId } = runIdSchema.parse(input)
    const orchestrator = getKanbanOrchestrator()
    if (!orchestrator) throw new Error('Orchestrator service not initialized')
    orchestrator.pause(runId)
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.RESUME, (_event, input: unknown) => {
    const { runId } = runIdSchema.parse(input)
    const orchestrator = getKanbanOrchestrator()
    if (!orchestrator) throw new Error('Orchestrator service not initialized')
    orchestrator.resume(runId)
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.STATUS, () => {
    const orchestrator = getKanbanOrchestrator()
    if (!orchestrator) throw new Error('Orchestrator service not initialized')
    return orchestrator.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.TASK_LOG, (_event, input: unknown) => {
    const { taskId } = taskIdSchema.parse(input)
    const orchestrator = getKanbanOrchestrator()
    if (!orchestrator) throw new Error('Orchestrator service not initialized')
    return orchestrator.getTaskLog(taskId)
  })
}
