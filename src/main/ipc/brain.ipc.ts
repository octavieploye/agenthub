import { ipcMain } from 'electron'
import { getBrainScanner } from '../services/brain-scanner'
import log from 'electron-log/main'

export function registerBrainIpcHandlers(): void {
  const brainScanner = getBrainScanner()

  /**
   * Get brain entries, optionally filtered by repo
   */
  ipcMain.handle('brain:query', async (event, { repoId }: { repoId?: string }) => {
    try {
      const entries = brainScanner.getBrainEntries(repoId)

      // Group by repo for the response
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

  /**
   * Update brain entry status
   */
  ipcMain.handle('brain:update-status', async (event, { id, status }: { id: string; status: string }) => {
    try {
      brainScanner.updateBrainEntryStatus(id, status)
      return { success: true }
    } catch (error) {
      log.error('Error in brain:update-status:', error)
      throw error
    }
  })

  /**
   * Register a new brain entry
   */
  ipcMain.handle('brain:register', async (event, input: {
    repoId: string
    subject: string
    type: string
    artifactPath: string
    project?: string
    note?: string
  }) => {
    try {
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

  /**
   * Get timeline entries (brain events + git commits)
   */
  ipcMain.handle('brain:timeline', async (event, { repoId }: { repoId: string }) => {
    try {
      const timeline = await brainScanner.getTimeline(repoId)
      return timeline
    } catch (error) {
      log.error('Error in brain:timeline:', error)
      throw error
    }
  })

  /**
   * Create a task from a brain entry
   */
  ipcMain.handle('brain:create-task', async (event, input: {
    brainEntryId: string
    subject?: string
    description?: string
  }) => {
    try {
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