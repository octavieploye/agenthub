import { ipcMain } from 'electron'
import { z } from 'zod/v4'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import type { RegisterBrainEntryInput } from '../../shared/types/brain.types'
import { getBrainScanner } from '../services/brain-scanner'
import { validateInput } from './ipc-helpers'
import log from 'electron-log/main'

const registerBrainEntrySchema = z.object({
  repoId: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  type: z.enum([
    'brainstorm',
    'spec',
    'plan',
    'sprint',
    'strategy',
    'marketing',
    'how-to',
    'reference',
    'learning'
  ]),
  artifactPath: z.string().trim().min(1),
  project: z.string().trim().min(1).optional(),
  note: z.string().trim().min(1).optional()
}) satisfies z.ZodType<RegisterBrainEntryInput>

export function registerBrainIpcHandlers(): void {
  // Query: auto-discover first, then return grouped results
  ipcMain.handle(IPC_CHANNELS.BRAIN.QUERY, async (_event, { repoId, skipDiscovery }: { repoId?: string; skipDiscovery?: boolean }) => {
    try {
      const brainScanner = getBrainScanner()

      // Auto-discover artifacts on each query (fast — upsert skips existing)
      if (!skipDiscovery) {
        brainScanner.discoverAllArtifacts()
      }

      const entries = brainScanner.getBrainEntries(repoId)

      // Group entries by repo to match BrainQueryResult[] shape
      const grouped = new Map<string, { repoId: string; repoName: string; entries: typeof entries }>()
      for (const entry of entries) {
        if (!grouped.has(entry.repoId)) {
          grouped.set(entry.repoId, { repoId: entry.repoId, repoName: entry.repoName, entries: [] })
        }
        grouped.get(entry.repoId)!.entries.push(entry)
      }

      return Array.from(grouped.values()).map((group) => ({
        repoId: group.repoId,
        repoName: group.repoName,
        entries: group.entries,
        summary: {
          active: group.entries.filter(e => e.status === 'active').length,
          notActioned: group.entries.filter(e => e.tasksTotal === 0 && e.status !== 'parked' && e.status !== 'implemented').length,
          parked: group.entries.filter(e => e.status === 'parked').length,
          implemented: group.entries.filter(e => e.status === 'implemented').length
        }
      }))
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

  ipcMain.handle(IPC_CHANNELS.BRAIN.REGISTER, async (_event, input: unknown) => {
    try {
      const parsed = validateInput(registerBrainEntrySchema, input)
      if (!parsed.valid) {
        throw new Error(`Invalid brain registration: ${parsed.response.error.message}`)
      }

      const entryId = getBrainScanner().registerBrainEntry(parsed.data)
      return { entryId, success: true }
    } catch (error) {
      log.error('Error in brain:register:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.BRAIN.TIMELINE, async (_event, { repoId }: { repoId: string }) => {
    try {
      const brainScanner = getBrainScanner()
      return await brainScanner.getTimeline(repoId)
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
