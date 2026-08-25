import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { getKanbanOrchestrator } from '../services/service-orchestrator'
import { success, error, validateInput } from './ipc-helpers'

const startSchema = z.object({
  sprintName: z.string().min(1),
  repoId: z.string().min(1),
  projectId: z.string().optional(),
  concurrencyCap: z.number().int().min(1).max(10).optional(),
  telegramNotify: z.boolean().optional(),
  singleTaskId: z.string().optional(),
})

const runIdSchema = z.object({
  runId: z.string().min(1),
})

const taskIdSchema = z.object({
  taskId: z.string().min(1),
})

function getOrchestrator() {
  const orchestrator = getKanbanOrchestrator()
  if (!orchestrator) throw new Error('Orchestrator service not initialized')
  return orchestrator
}

export function registerOrchestratorHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.START, (_event, input: unknown) => {
    const v = validateInput(startSchema, input)
    if (!v.valid) return v.response
    try {
      return success(getOrchestrator().start(v.data))
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

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.RETRY_FAILURES, () => {
    try {
      return success(getOrchestrator().getRetryFailures())
    } catch (err) {
      return error('ORCHESTRATOR_RETRY_FAILURES_FAILED', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.ACKNOWLEDGE_RETRY_FAILURES, () => {
    try {
      getOrchestrator().acknowledgeRetryFailures()
      return success(undefined)
    } catch (err) {
      return error('ORCHESTRATOR_ACK_RETRY_FAILED', err instanceof Error ? err.message : String(err))
    }
  })

  const securityApprovalSchema = z.object({
    runId: z.string().min(1),
    taskId: z.string().min(1),
    approved: z.boolean(),
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATOR.APPROVE_SECURITY, (_event, input: unknown) => {
    const v = validateInput(securityApprovalSchema, input)
    if (!v.valid) return v.response
    try {
      getOrchestrator().approveSecurityFindings(v.data.runId, v.data.taskId, v.data.approved)
      return success(undefined)
    } catch (err) {
      return error('ORCHESTRATOR_APPROVE_SECURITY_FAILED', err instanceof Error ? err.message : String(err))
    }
  })
}
