import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod/v4'
import type Database from 'better-sqlite3'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { updateTaskPosition, insertTask } from '../db/queries/tasks.queries'
import type { WindowManager } from '../services/window-manager'
import { validateInput, success, error } from './ipc-helpers'

const sprintStorySchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  priority: z.number().int().min(1).max(5),
  sprintName: z.string(),
  epicName: z.string(),
  repoId: z.string().min(1)
})

const sprintIntakeSchema = z.array(sprintStorySchema)

const updatePositionSchema = z.object({
  taskId: z.string().min(1),
  position: z.number().int().min(0)
})

export function registerKanbanHandlers(db: Database.Database, windowManager: WindowManager): void {
  ipcMain.handle(IPC_CHANNELS.KANBAN.OPEN, (_event, agentId?: string) => {
    windowManager.createKanbanWindow(agentId)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.KANBAN.UPDATE_POSITION, (_event, taskId: unknown, position: unknown) => {
    try {
      const parsed = validateInput(updatePositionSchema, { taskId, position })
      if (!parsed.valid) return parsed.response
      updateTaskPosition(db, parsed.data.taskId, parsed.data.position)
      return success(undefined)
    } catch (err) {
      return error('KANBAN_ERROR', String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.KANBAN.SPRINT_INTAKE, (_event, stories: unknown) => {
    try {
      const parsed = validateInput(sprintIntakeSchema, stories)
      if (!parsed.valid) return parsed.response
      const created = parsed.data.map((s) =>
        insertTask(db, {
          repoId: s.repoId,
          title: s.title,
          description: s.description,
          priority: s.priority,
          status: 'backlog',
          sprintName: s.sprintName,
          epicName: s.epicName
        })
      )
      return success(created)
    } catch (err) {
      return error('KANBAN_ERROR', String(err))
    }
  })

  log.info('Kanban IPC handlers registered')
}
