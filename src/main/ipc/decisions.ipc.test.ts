import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ reader: null as unknown }))

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}))

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

// Real AnamnesisReader + AnamnesisHttpError; only the singleton accessor is swapped.
vi.mock('../services/anamnesis-reader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/anamnesis-reader')>()
  return { ...actual, getAnamnesisReader: () => state.reader }
})

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { getDb, closeDb, resetDb } from '../db/connection'
import { insertRepo } from '../db/queries/repos.queries'
import { AnamnesisReader } from '../services/anamnesis-reader'
import { registerDecisionsIpcHandlers } from './decisions.ipc'

const PROJECT_ID = '35a5b599-27de-4b28-a609-e2edb5ae6d86'
const REPO_NAME = 'Decision-Repo'
const PROJECT_PATH = `/projects/${REPO_NAME.toLowerCase()}`
const BODY_MARKER = 'LEAK-MARKER-55aa'
const BASE_URL = 'http://localhost:19300'

/** G-T4a adds IPC_CHANNELS.DECISIONS; looked up lazily so this file compiles before it exists. */
function listChannel(): string {
  return (IPC_CHANNELS as unknown as { DECISIONS: { LIST: string } }).DECISIONS.LIST
}

function getHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(([registered]) => registered === channel)
  if (!call) throw new Error(`No handler for ${channel}`)
  return call[1] as (...args: unknown[]) => Promise<unknown>
}

const decisionRow = {
  id: 'd-1',
  project_id: PROJECT_ID,
  domain: 'code',
  title: 'Use SQLite',
  summary: null,
  rationale: null,
  status: 'done',
  owner_entity: 'hephaestus',
  decided_by: null,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-02T10:00:00Z',
  decided_at: null,
  supersedes_id: null,
  ethical_review_id: null
}
const statusRow = {
  project_id: PROJECT_ID,
  domain: 'code',
  state: 'on track',
  summary: null,
  updated_by: null,
  updated_at: '2026-10-02T10:00:00Z'
}

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body, text: async () => '' } as Response
}
function failResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({ detail: BODY_MARKER }),
    text: async () => `upstream said ${BODY_MARKER}`
  } as Response
}

let fetchMock: ReturnType<typeof vi.fn>

function stubFetch(impl: (url: URL) => Promise<Response>): void {
  fetchMock = vi.fn(async (input: unknown) => impl(new URL(String(input))))
  vi.stubGlobal('fetch', fetchMock)
}

function projectRow(tier: string): unknown {
  return { id: PROJECT_ID, name: REPO_NAME.toLowerCase(), tier }
}

function stubHappyFetch(tier = 'active'): void {
  stubFetch(async (url) => {
    if (url.pathname === PROJECT_PATH) return okResponse(projectRow(tier))
    if (url.pathname === '/decisions') return okResponse([decisionRow])
    if (url.pathname === `/projects/${PROJECT_ID}/status`) return okResponse([statusRow])
    return failResponse(404)
  })
}

describe('decisions.ipc — DECISIONS.LIST', () => {
  let repoId: string

  beforeEach(() => {
    vi.clearAllMocks()
    resetDb()
    repoId = insertRepo(getDb(':memory:'), { name: REPO_NAME, path: '/tmp/decision-repo' }).id
    state.reader = new AnamnesisReader({ baseUrl: BASE_URL })
    registerDecisionsIpcHandlers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    closeDb()
  })

  it.each([
    [undefined],
    [null],
    [{}],
    [{ repoId: '' }],
    [{ repoId: 123 }],
    [{ repoId: 'any-repo', domain: 'bogus' }],
    [{ repoId: 'any-repo', limit: 0 }],
    [{ repoId: 'any-repo', limit: 101 }],
    [{ repoId: 'any-repo', limit: 'ten' }]
  ])('rejects invalid input %j without any fetch', async (input) => {
    stubHappyFetch()
    await expect(getHandler(listChannel())(undefined, input)).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns {state:"standalone"} and makes no fetch when there is no reader', async () => {
    state.reader = null
    stubHappyFetch()

    const result = await getHandler(listChannel())(undefined, { repoId })

    expect(result).toEqual({ state: 'standalone' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns {state:"ok", decisions, statuses} on success', async () => {
    stubHappyFetch()

    const result = await getHandler(listChannel())(undefined, {
      repoId,
      domain: 'code',
      limit: 20
    })

    expect(result).toEqual({
      state: 'ok',
      decisions: [
        {
          id: decisionRow.id,
          domain: decisionRow.domain,
          title: decisionRow.title,
          summary: decisionRow.summary,
          status: decisionRow.status
        }
      ],
      statuses: [
        {
          project_id: statusRow.project_id,
          domain: statusRow.domain,
          state: statusRow.state,
          summary: statusRow.summary
        }
      ]
    })
  })

  it('forwards only the fields the panel shows: rationale and the other columns never cross IPC', async () => {
    stubFetch(async (url) => {
      if (url.pathname === PROJECT_PATH) return okResponse(projectRow('active'))
      if (url.pathname === '/decisions') {
        return okResponse([{ ...decisionRow, rationale: BODY_MARKER, decided_by: BODY_MARKER }])
      }
      if (url.pathname === `/projects/${PROJECT_ID}/status`) {
        return okResponse([{ ...statusRow, updated_by: BODY_MARKER }])
      }
      return failResponse(404)
    })

    const result = (await getHandler(listChannel())(undefined, { repoId })) as {
      state: string
      decisions: Record<string, unknown>[]
      statuses: Record<string, unknown>[]
    }

    expect(result.state).toBe('ok')
    expect(JSON.stringify(result)).not.toContain(BODY_MARKER)
    expect(Object.keys(result.decisions[0]).sort()).toEqual([
      'domain',
      'id',
      'status',
      'summary',
      'title'
    ])
    expect(Object.keys(result.statuses[0]).sort()).toEqual([
      'domain',
      'project_id',
      'state',
      'summary'
    ])
  })

  it('filters the request by project, domain and limit and never sends include_archive', async () => {
    stubHappyFetch()

    await getHandler(listChannel())(undefined, { repoId, domain: 'legal', limit: 5 })

    const urls = fetchMock.mock.calls.map(([u]) => new URL(String(u)))
    const decisionsUrl = urls.find((u) => u.pathname === '/decisions')
    expect(decisionsUrl).toBeDefined()
    expect(decisionsUrl!.searchParams.get('project_id')).toBe(PROJECT_ID)
    expect(decisionsUrl!.searchParams.get('domain')).toBe('legal')
    expect(decisionsUrl!.searchParams.get('limit')).toBe('5')
    for (const u of urls) expect(u.searchParams.has('include_archive')).toBe(false)
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [503, 'maintenance'],
    [500, 'unavailable'],
    [429, 'unavailable']
  ])('maps an Anamnesis %i to {state:"%s"} and leaks no error text', async (status, expected) => {
    stubFetch(async () => failResponse(status))

    const result = await getHandler(listChannel())(undefined, { repoId })

    expect(result).toEqual({ state: expected })
    expect(JSON.stringify(result)).not.toContain(BODY_MARKER)
  })

  it('maps a timeout to {state:"unavailable"}', async () => {
    stubFetch(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })

    const result = await getHandler(listChannel())(undefined, { repoId })

    expect(result).toEqual({ state: 'unavailable' })
  })

  it('maps a network failure to {state:"unavailable"} without leaking its message', async () => {
    stubFetch(async () => {
      throw new TypeError(`fetch failed ${BODY_MARKER}`)
    })

    const result = await getHandler(listChannel())(undefined, { repoId })

    expect(result).toEqual({ state: 'unavailable' })
    expect(JSON.stringify(result)).not.toContain(BODY_MARKER)
  })

  it('maps a 404 on /decisions to {state:"unavailable"} and leaks no error text', async () => {
    stubFetch(async (url) => {
      if (url.pathname === PROJECT_PATH) return okResponse(projectRow('active'))
      return failResponse(404)
    })

    const result = await getHandler(listChannel())(undefined, { repoId })

    expect(result).toEqual({ state: 'unavailable' })
    expect(JSON.stringify(result)).not.toContain(BODY_MARKER)
  })

  // Documented choice: an unknown AgentHub repo id is "no decisions", not an error — same outcome
  // as a project Anamnesis does not know — so the renderer never learns whether an id exists.
  it('returns an empty ok for an unknown repo id without any fetch', async () => {
    stubHappyFetch()

    const result = await getHandler(listChannel())(undefined, { repoId: 'no-such-repo-id' })

    expect(result).toEqual({ state: 'ok', decisions: [], statuses: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns an empty ok when Anamnesis does not know the project (404 on the lookup)', async () => {
    stubFetch(async () => failResponse(404))

    const result = await getHandler(listChannel())(undefined, { repoId })

    expect(result).toEqual({ state: 'ok', decisions: [], statuses: [] })
    expect(JSON.stringify(result)).not.toContain(BODY_MARKER)
  })

  it('returns an empty ok and requests no decisions for an archived project', async () => {
    stubHappyFetch('archive')

    const result = await getHandler(listChannel())(undefined, { repoId })

    expect(result).toEqual({ state: 'ok', decisions: [], statuses: [] })
    const paths = fetchMock.mock.calls.map(([u]) => new URL(String(u)).pathname)
    expect(paths).not.toContain('/decisions')
    expect(paths.some((p) => p.endsWith('/status'))).toBe(false)
  })
})
