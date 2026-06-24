import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod/v4'
import { readdirSync, existsSync } from 'fs'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { updateTaskPosition, insertTask } from '../db/queries/tasks.queries'
import { getWindowManager, getSprintWatcher, getIntakeDir } from '../services/service-orchestrator'
import { getDb } from '../db/connection'
import { validateInput, success, error } from './ipc-helpers'
import { emitToAllRenderers } from '../utils/emit-to-all-renderers'

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

export function registerKanbanHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.KANBAN.OPEN, (_event, agentId?: string) => {
    const wm = getWindowManager()
    if (!wm) return error('KANBAN_ERROR', 'WindowManager not initialized')
    wm.createKanbanWindow(agentId)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.KANBAN.UPDATE_POSITION, (_event, taskId: unknown, position: unknown) => {
    try {
      const parsed = validateInput(updatePositionSchema, { taskId, position })
      if (!parsed.valid) return parsed.response
      updateTaskPosition(getDb(), parsed.data.taskId, parsed.data.position)
      return success(undefined)
    } catch (err) {
      return error('KANBAN_ERROR', String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.KANBAN.SPRINT_INTAKE, (_event, stories: unknown) => {
    try {
      const db = getDb()
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

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  ipcMain.handle(IPC_CHANNELS.KANBAN.SPRINT_CONFIRM, (_event, pendingId: string) => {
    if (typeof pendingId !== 'string' || !UUID_RE.test(pendingId)) {
      return { success: false, error: { message: 'Invalid pendingId format' } }
    }
    try {
      const sw = getSprintWatcher()
      if (!sw) return { success: false, error: { message: 'SprintWatcher not initialized' } }
      sw.confirm(getDb(), pendingId, emitToAllRenderers)
      return { success: true }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.KANBAN.SPRINT_REJECT, (_event, pendingId: string) => {
    if (typeof pendingId !== 'string' || !UUID_RE.test(pendingId)) {
      return { success: false, error: { message: 'Invalid pendingId format' } }
    }
    try {
      const sw = getSprintWatcher()
      if (!sw) return { success: false, error: { message: 'SprintWatcher not initialized' } }
      sw.reject(pendingId)
      return { success: true }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.KANBAN.SPRINT_CONFIRM_DRAFT, (_event, projectId: string) => {
    const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/
    if (!SAFE_ID_RE.test(projectId)) {
      return { success: false, error: { message: 'Invalid projectId format' } }
    }
    try {
      const sw = getSprintWatcher()
      if (!sw) return { success: false, error: { message: 'SprintWatcher not initialized' } }
      sw.confirmDraft(projectId, getIntakeDir())
      return { success: true }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.KANBAN.GET_DRAFTS, () => {
    const dir = getIntakeDir()
    if (!existsSync(dir)) return { success: true, data: [] }
    try {
      const files = readdirSync(dir)
      const drafts = files
        .filter((f) => f.match(/^sprint-.+\.draft\.json$/))
        .map((f) => ({
          projectId: f.replace(/^sprint-/, '').replace(/\.draft\.json$/, ''),
          draftFilename: f
        }))
      return { success: true, data: drafts }
    } catch (err) {
      return error('GET_DRAFTS_ERROR', String(err))
    }
  })

  log.info('Kanban IPC handlers registered')
}
