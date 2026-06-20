import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getDb } from '../db/connection'
import {
  getAllTasks,
  getTasksByRepo,
  getTasksByStatus,
  searchTasks,
  insertTask,
  updateTask,
  deleteTask
} from '../db/queries/tasks.queries'
import type { IpcResponse } from '../../shared/types/ipc.types'
import type { TaskItem, CreateTaskInput, UpdateTaskInput, TaskStatus } from '../../shared/types/task.types'
import { z } from 'zod/v4'

const categorySchema = z
  .enum(['backend', 'frontend', 'database', 'schema', 'functionality'])
  .nullable()
  .optional()

const createTaskSchema = z.object({
  repoId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  status: z
    .enum(['backlog', 'today', 'in_progress', 'completed', 'tested', 'interrupted'])
    .optional(),
  category: categorySchema,
  sprintName: z.string().optional(),
  epicName: z.string().optional(),
  projectId: z.string().nullable().optional(),
  note: z.string().nullable().optional()
})

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  status: z
    .enum(['backlog', 'today', 'in_progress', 'completed', 'tested', 'interrupted'])
    .optional(),
  category: categorySchema,
  agentId: z.string().nullable().optional(),
  position: z.number().int().optional(),
  sbarId: z.string().nullable().optional(),
  sprintName: z.string().nullable().optional(),
  epicName: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  sectionTargetDate: z.string().nullable().optional(),
  note: z.string().nullable().optional()
})

export function registerTasksHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.TASKS.LIST,
    async (): Promise<IpcResponse<TaskItem[]>> => {
      try {
        return success(getAllTasks(getDb()))
      } catch (err) {
        return error('TASKS_LIST_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.TASKS.GET_BY_REPO,
    async (_event, repoId: unknown): Promise<IpcResponse<TaskItem[]>> => {
      try {
        const validation = validateInput(z.string(), repoId)
        if (!validation.valid) return validation.response
        return success(getTasksByRepo(getDb(), validation.data))
      } catch (err) {
        return error('TASKS_GET_BY_REPO_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.TASKS.GET_BY_STATUS,
    async (_event, status: unknown): Promise<IpcResponse<TaskItem[]>> => {
      try {
        const validation = validateInput(
          z.enum(['backlog', 'today', 'in_progress', 'completed', 'tested', 'interrupted']),
          status
        )
        if (!validation.valid) return validation.response
        return success(getTasksByStatus(getDb(), validation.data as TaskStatus))
      } catch (err) {
        return error('TASKS_GET_BY_STATUS_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.TASKS.CREATE,
    async (_event, input: unknown): Promise<IpcResponse<TaskItem>> => {
      try {
        const validation = validateInput(createTaskSchema, input)
        if (!validation.valid) return validation.response
        const result = insertTask(getDb(), validation.data as CreateTaskInput)
        return success(result)
      } catch (err) {
        return error('TASKS_CREATE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.TASKS.UPDATE,
    async (_event, id: unknown, input: unknown): Promise<IpcResponse<void>> => {
      try {
        const idValidation = validateInput(z.string(), id)
        if (!idValidation.valid) return idValidation.response
        const inputValidation = validateInput(updateTaskSchema, input)
        if (!inputValidation.valid) return inputValidation.response
        updateTask(getDb(), idValidation.data, inputValidation.data as UpdateTaskInput)
        return success(undefined)
      } catch (err) {
        return error('TASKS_UPDATE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.TASKS.DELETE,
    async (_event, id: unknown): Promise<IpcResponse<void>> => {
      try {
        const validation = validateInput(z.string(), id)
        if (!validation.valid) return validation.response
        deleteTask(getDb(), validation.data)
        return success(undefined)
      } catch (err) {
        return error('TASKS_DELETE_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.TASKS.SEARCH,
    async (_event, query: unknown): Promise<IpcResponse<TaskItem[]>> => {
      try {
        const validation = validateInput(z.string(), query)
        if (!validation.valid) return validation.response
        return success(searchTasks(getDb(), validation.data))
      } catch (err) {
        return error('TASKS_SEARCH_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('Tasks IPC handlers registered')
}
