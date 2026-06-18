import { ipcMain } from 'electron'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { updateTaskPosition, insertTask } from '../db/queries/tasks.queries'
import type { WindowManager } from '../services/window-manager'
import type { TaskPriority } from '../../shared/types/task.types'

interface SprintStory {
  title: string
  description: string
  priority: TaskPriority
  sprintName: string
  epicName: string
  repoId: string
}

export function registerKanbanHandlers(db: Database.Database, windowManager: WindowManager): void {
  ipcMain.handle(IPC_CHANNELS.KANBAN.OPEN, (_event, agentId?: string) => {
    windowManager.createKanbanWindow(agentId)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.KANBAN.UPDATE_POSITION, (_event, taskId: string, position: number) => {
    try {
      updateTaskPosition(db, taskId, position)
      return { success: true }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.KANBAN.SPRINT_INTAKE, (_event, stories: SprintStory[]) => {
    try {
      const created = stories.map((s) =>
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
      return { success: true, data: created }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })

  log.info('Kanban IPC handlers registered')
}
