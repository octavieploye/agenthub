import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { getBrainScanner } from '../services/brain-scanner'
import log from 'electron-log/main'

export function registerBrainIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.BRAIN.QUERY, async (_event, { repoId }: { repoId?: string }) => {
    try {
      const brainScanner = getBrainScanner()
      const entries = brainScanner.getBrainEntries(repoId)

      const result = {
        entries,
        summary: {
          active: entries.filter(e => e.status === 'active').length,
          notActioned: entries.filter(e => e.tasksTotal === 0 && e.status !== 'parked' && e.status !== 'implemented').length,
          parked: entries.filter(e => e.status === 'parked').length,
          implemented: entries.filter(e => e.status === 'implemented').length
        }
      }

      return result
    } catch (error) {
      log.error('Error in brain:query:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.BRAIN.UPDATE_STATUS, async (_event, { id, status }: { id: string; status: string }) => {
    try {
      const brainScanner = getBrainScanner()
      brainScanner.updateBrainEntryStatus(id, status)
      return { success: true }
    } catch (error) {
      log.error('Error in brain:update-status:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.BRAIN.REGISTER, async (_event, input: {
    repoId: string
    subject: string
    type: string
    artifactPath: string
    project?: string
    note?: string
  }) => {
    try {
      const brainScanner = getBrainScanner()
      const entryId = brainScanner.registerBrainEntry(
        input.repoId,
        input.subject,
        input.type,
        input.artifactPath,
        input.project,
        input.note
      )
      return { entryId, success: true }
    } catch (error) {
      log.error('Error in brain:register:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.BRAIN.TIMELINE, async (_event, { repoId }: { repoId: string }) => {
    try {
      const brainScanner = getBrainScanner()
      const timeline = await brainScanner.getTimeline(repoId)
      return timeline
    } catch (error) {
      log.error('Error in brain:timeline:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.BRAIN.CREATE_TASK, async (_event, input: {
    brainEntryId: string
    subject?: string
    description?: string
  }) => {
    try {
      const brainScanner = getBrainScanner()
      const taskId = brainScanner.createTaskFromBrainEntry(
        input.brainEntryId,
        input.subject,
        input.description
      )
      return { taskId, success: true }
    } catch (error) {
      log.error('Error in brain:create-task:', error)
      throw error
    }
  })
}
