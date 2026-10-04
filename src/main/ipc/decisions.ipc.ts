import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod/v4'
import { ANAMNESIS_DOMAIN_CATEGORIES } from '../../shared/constants/anamnesis-domains'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { getDb } from '../db/connection'
import { getRepoById } from '../db/queries/repos.queries'
import { AnamnesisHttpError, getAnamnesisReader } from '../services/anamnesis-reader'
import type { AnamnesisReader } from '../services/anamnesis-reader'
import { resolveActiveProject } from '../services/helpers/decision-prompt-block'
import type { DecisionsResult } from '../../shared/types/decisions.types'

const DEFAULT_LIMIT = 50

const listSchema = z.object({
  repoId: z.string().min(1),
  domain: z.enum(ANAMNESIS_DOMAIN_CATEGORIES).optional(),
  limit: z.number().int().min(1).max(100).default(DEFAULT_LIMIT)
})

type ListInput = z.infer<typeof listSchema>

const EMPTY_OK: DecisionsResult = { state: 'ok', decisions: [], statuses: [] }

/** Maps a failure to a UI state; the error text is never read, so nothing can leak. */
function failureState(err: unknown): DecisionsResult {
  const status = err instanceof AnamnesisHttpError ? err.status : 0
  if (status === 401 || status === 403) return { state: 'unauthorized' }
  if (status === 503) return { state: 'maintenance' }
  return { state: 'unavailable' }
}

async function loadDecisions(reader: AnamnesisReader, input: ListInput): Promise<DecisionsResult> {
  const repo = getRepoById(getDb(), input.repoId)
  if (!repo) return EMPTY_OK

  const project = await resolveActiveProject(reader, repo.name)
  if (!project) return EMPTY_OK

  const [decisions, statuses] = await Promise.all([
    reader.listDecisions({ projectId: project.id, domain: input.domain, limit: input.limit }),
    reader.getProjectStatus(project.id)
  ])
  return { state: 'ok', decisions, statuses }
}

export function registerDecisionsIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.DECISIONS.LIST, async (_event, raw: unknown): Promise<DecisionsResult> => {
    const parsed = listSchema.safeParse(raw)
    if (!parsed.success) throw new Error('Invalid decisions request')

    const reader = getAnamnesisReader()
    if (!reader) return { state: 'standalone' }

    try {
      return await loadDecisions(reader, parsed.data)
    } catch (err) {
      const result = failureState(err)
      log.warn(`decisions:list failed (${result.state})`)
      return result
    }
  })
}
