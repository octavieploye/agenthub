import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { getScheduler } from '../services/service-orchestrator'
import { getDb } from '../db/connection'
import { getTaskById } from '../db/queries/tasks.queries'
import { success, error, validateInput } from './ipc-helpers'

const startSchema = z.object({
  sprintName: z.string().min(1),
  repoId: z.string().min(1),
  projectId: z.string().optional(),
  concurrencyCap: z.number().int().min(1).max(10).optional(),
  telegramNotify: z.boolean().optional(),
  singleTaskId: z.string().optional(),
  confirmed: z.boolean().optional(),
  startedBy: z.string().optional(),
  triggerSource: z.enum(['manual', 'date-watcher', 'sprint-watcher', 'single-task']).optional(),
  taskIds: z.array(z.string()).optional(),
})

const runIdSchema = z.object({
  runId: z.string().min(1),
})

const taskIdSchema = z.object({
  taskId: z.string().min(1),
})

function getOrchestrator() {
  const orchestrator = getScheduler()
  if (!orchestrator) throw new Error('Orchestrator service not initialized')
  return orchestrator
}

export function registerOrchestratorHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.START, (_event, input: unknown) => {
    const v = validateInput(startSchema, input)
    if (!v.valid) return v.response
    // S4: Defense in depth — reject manual start without explicit confirmation
    if (v.data.confirmed !== true) {
      return error('ORCHESTRATOR_NOT_CONFIRMED', 'Manual start requires confirmed: true')
    }
    // R-003: Restrict triggerSource from renderer — only 'manual' and 'single-task' are valid from IPC
    const allowedFromIpc = new Set(['manual', 'single-task'])
    const sanitized = { ...v.data, triggerSource: allowedFromIpc.has(v.data.triggerSource ?? '') ? v.data.triggerSource : 'manual' as const }
    try {
      const run = getOrchestrator().start({
        sprintName: sanitized.sprintName,
        repoId: sanitized.repoId,
        taskIds: sanitized.taskIds,
      })
      return success(run)
    } catch (err) {
      return error('ORCHESTRATOR_START_FAILED', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.PAUSE, (_event, input: unknown) => {
    const v = validateInput(runIdSchema, input)
    if (!v.valid) return v.response
    try {
      getOrchestrator().pause(v.data.runId)
      return success(undefined)
    } catch (err) {
      return error('ORCHESTRATOR_PAUSE_FAILED', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.RESUME, (_event, input: unknown) => {
    const v = validateInput(runIdSchema, input)
    if (!v.valid) return v.response
    try {
      getOrchestrator().resume(v.data.runId)
      return success(undefined)
    } catch (err) {
      return error('ORCHESTRATOR_RESUME_FAILED', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.STATUS, () => {
    try {
      return success(getOrchestrator().getStatus())
    } catch (err) {
      return error('ORCHESTRATOR_STATUS_FAILED', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.TASK_LOG, (_event, input: unknown) => {
    const v = validateInput(taskIdSchema, input)
    if (!v.valid) return v.response
    try {
      return success(getOrchestrator().getTaskLog(v.data.taskId))
    } catch (err) {
      return error('ORCHESTRATOR_TASK_LOG_FAILED', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.CANCEL, (_event, input: unknown) => {
    const v = validateInput(runIdSchema, input)
    if (!v.valid) return v.response
    try {
      getOrchestrator().cancel(v.data.runId)
      return success(undefined)
    } catch (err) {
      return error('ORCHESTRATOR_CANCEL_FAILED', err instanceof Error ? err.message : String(err))
    }
  })

  const taskApprovalSchema = z.object({
    runId: z.string().min(1),
    taskId: z.string().min(1),
    approved: z.boolean(),
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.APPROVE_TASK, (_event, input: unknown) => {
    const v = validateInput(taskApprovalSchema, input)
    if (!v.valid) return v.response
    try {
      getOrchestrator().approveTaskDispatch(v.data.runId, v.data.taskId, v.data.approved)
      return success(undefined)
    } catch (err) {
      return error('ORCHESTRATOR_APPROVE_TASK_FAILED', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.START_SINGLE_TASK, (_event, input: unknown) => {
    const schema = z.object({ taskId: z.string().min(1) })
    const v = validateInput(schema, input)
    if (!v.valid) return v.response
    try {
      const db = getDb()
      const task = getTaskById(db, v.data.taskId)
      if (!task) return error('TASK_NOT_FOUND', `Task not found: ${v.data.taskId}`)
      const run = getOrchestrator().startSingleTask({
        taskId: v.data.taskId,
      })
      return success(run)
    } catch (err) {
      return error('ORCHESTRATOR_START_SINGLE_TASK_FAILED', err instanceof Error ? err.message : String(err))
    }
  })
}
