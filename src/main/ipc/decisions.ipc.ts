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
import type {
  DecisionItem,
  DecisionsResult,
  ProjectStatusItem
} from '../../shared/types/decisions.types'

const DEFAULT_LIMIT = 50

const listSchema = z.object({
  repoId: z.string().min(1),
  domain: z.enum(ANAMNESIS_DOMAIN_CATEGORIES).optional(),
  limit: z.number().int().min(1).max(100).default(DEFAULT_LIMIT)
})

type ListInput = z.infer<typeof listSchema>

/** The decision fields the Decisions panel shows; every other column stays in the main process. */
export type PanelDecision = Pick<DecisionItem, 'id' | 'domain' | 'title' | 'summary' | 'status'>
export type PanelStatus = Pick<ProjectStatusItem, 'project_id' | 'domain' | 'state' | 'summary'>

/**
 * What crosses IPC. A strict subset of `DecisionsResult`, which still declares the full rows in
 * the shared renderer-facing types (`ipc.types.ts`); the panel reads only the fields kept here.
 */
export type PanelDecisionsResult =
  | { state: 'ok'; decisions: PanelDecision[]; statuses: PanelStatus[] }
  | Exclude<DecisionsResult, { state: 'ok' }>

const EMPTY_OK: PanelDecisionsResult = { state: 'ok', decisions: [], statuses: [] }

function toPanelDecision(row: DecisionItem): PanelDecision {
  return {
    id: row.id,
    domain: row.domain,
    title: row.title,
    summary: row.summary,
    status: row.status
  }
}

function toPanelStatus(row: ProjectStatusItem): PanelStatus {
  return { project_id: row.project_id, domain: row.domain, state: row.state, summary: row.summary }
}

/** Maps a failure to a UI state; the error text is never read, so nothing can leak. */
function failureState(err: unknown): PanelDecisionsResult {
  const status = err instanceof AnamnesisHttpError ? err.status : 0
  if (status === 401 || status === 403) return { state: 'unauthorized' }
  if (status === 503) return { state: 'maintenance' }
  return { state: 'unavailable' }
}

async function loadDecisions(
  reader: AnamnesisReader,
  input: ListInput
): Promise<PanelDecisionsResult> {
  const repo = getRepoById(getDb(), input.repoId)
  if (!repo) return EMPTY_OK

  const project = await resolveActiveProject(reader, repo.name)
  if (!project) return EMPTY_OK

  const [decisions, statuses] = await Promise.all([
    reader.listDecisions({ projectId: project.id, domain: input.domain, limit: input.limit }),
    reader.getProjectStatus(project.id)
  ])
  return {
    state: 'ok',
    decisions: decisions.map(toPanelDecision),
    statuses: statuses.map(toPanelStatus)
  }
}

export function registerDecisionsIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.DECISIONS.LIST, async (_event, raw: unknown): Promise<PanelDecisionsResult> => {
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
