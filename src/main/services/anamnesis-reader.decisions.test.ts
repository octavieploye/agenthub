// @vitest-environment node
import http from 'http'
import type { AddressInfo } from 'net'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AnamnesisReader, AnamnesisHttpError } from './anamnesis-reader'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

/** Unique string placed in every error body: it must never surface in a thrown error. */
const BODY_MARKER = 'LEAK-MARKER-7c41e9b2'
const PROJECT_ID = '35a5b599-27de-4b28-a609-e2edb5ae6d86'

interface Seen {
  method: string
  path: string
  query: URLSearchParams
  headers: http.IncomingHttpHeaders
}

let server: http.Server
let baseUrl: string
let seen: Seen[]
let respond: (req: http.IncomingMessage, res: http.ServerResponse) => void

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

beforeEach(async () => {
  seen = []
  respond = (_req, res) => json(res, 200, [])
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://fake.local')
    seen.push({
      method: req.method ?? '',
      path: url.pathname,
      query: url.searchParams,
      headers: req.headers
    })
    respond(req, res)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

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

describe('AnamnesisReader.listDecisions', () => {
  it('GETs /decisions with project_id, domain and limit', async () => {
    respond = (_req, res) => json(res, 200, [decisionRow])
    const reader = new AnamnesisReader({ baseUrl })

    const out = await reader.listDecisions({ projectId: PROJECT_ID, domain: 'code', limit: 7 })

    expect(out).toEqual([decisionRow])
    expect(seen).toHaveLength(1)
    expect(seen[0].method).toBe('GET')
    expect(seen[0].path).toBe('/decisions')
    expect(seen[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(seen[0].query.get('domain')).toBe('code')
    expect(seen[0].query.get('limit')).toBe('7')
  })

  it('omits the domain parameter when no domain is given', async () => {
    const reader = new AnamnesisReader({ baseUrl })
    await reader.listDecisions({ projectId: PROJECT_ID })
    expect(seen[0].query.has('domain')).toBe(false)
  })

  it.each([
    ['no domain', { projectId: PROJECT_ID }],
    ['a domain', { projectId: PROJECT_ID, domain: 'legal' as const }],
    ['a limit', { projectId: PROJECT_ID, limit: 50 }]
  ])('NEVER sends include_archive (%s)', async (_label, args) => {
    const reader = new AnamnesisReader({ baseUrl })
    await reader.listDecisions(args)
    expect(seen[0].query.has('include_archive')).toBe(false)
  })

  it('sends X-Optimaeus-Caller: hephaestus', async () => {
    const reader = new AnamnesisReader({ baseUrl })
    await reader.listDecisions({ projectId: PROJECT_ID })
    expect(seen[0].headers['x-optimaeus-caller']).toBe('hephaestus')
  })

  it('sends a bearer only when a secret is stored', async () => {
    await new AnamnesisReader({ baseUrl, authSecret: 'tok-123' }).listDecisions({
      projectId: PROJECT_ID
    })
    await new AnamnesisReader({ baseUrl }).listDecisions({ projectId: PROJECT_ID })
    expect(seen[0].headers['authorization']).toBe('Bearer tok-123')
    expect(seen[1].headers['authorization']).toBeUndefined()
  })
})

describe('AnamnesisReader.getProjectStatus', () => {
  it('GETs /projects/{id}/status and returns the rows', async () => {
    const rows = [
      {
        project_id: PROJECT_ID,
        domain: 'code',
        state: 'on track',
        summary: null,
        updated_by: null,
        updated_at: '2026-10-02T10:00:00Z'
      }
    ]
    respond = (_req, res) => json(res, 200, rows)
    const reader = new AnamnesisReader({ baseUrl })

    const out = await reader.getProjectStatus(PROJECT_ID)

    expect(out).toEqual(rows)
    expect(seen[0].path).toBe(`/projects/${PROJECT_ID}/status`)
    expect(seen[0].headers['x-optimaeus-caller']).toBe('hephaestus')
  })
})

describe('AnamnesisReader.getProjectByName', () => {
  it('lower-cases and trims the name', async () => {
    respond = (_req, res) =>
      json(res, 200, {
        id: PROJECT_ID,
        name: 'agenthub',
        created_at: 'x',
        created: false,
        tier: 'live'
      })
    const reader = new AnamnesisReader({ baseUrl })

    await reader.getProjectByName('  AgentHub  ')

    expect(seen[0].path).toBe('/projects/agenthub')
  })

  it('URL-encodes the name', async () => {
    respond = (_req, res) => json(res, 200, { id: PROJECT_ID, name: 'x', tier: 'live' })
    const reader = new AnamnesisReader({ baseUrl })

    await reader.getProjectByName('My Repo/Evil?x=1')

    expect(seen[0].path).toBe('/projects/my%20repo%2Fevil%3Fx%3D1')
    expect(seen[0].query.has('x')).toBe(false)
  })

  it('returns {id, name, tier} on success, passing the tier through', async () => {
    respond = (_req, res) =>
      json(res, 200, {
        id: PROJECT_ID,
        name: 'old-repo',
        created_at: 'x',
        created: false,
        tier: 'archive'
      })
    const reader = new AnamnesisReader({ baseUrl })

    const out = await reader.getProjectByName('old-repo')

    expect(out).toMatchObject({ id: PROJECT_ID, name: 'old-repo', tier: 'archive' })
  })

  it('returns null on 404', async () => {
    respond = (_req, res) => json(res, 404, { detail: BODY_MARKER })
    const reader = new AnamnesisReader({ baseUrl })
    await expect(reader.getProjectByName('ghost')).resolves.toBeNull()
  })
})

describe('AnamnesisReader error handling', () => {
  const statuses = [401, 403, 404, 429, 500, 503]

  const calls: Array<[string, (r: AnamnesisReader) => Promise<unknown>, number[]]> = [
    ['listDecisions', (r) => r.listDecisions({ projectId: PROJECT_ID }), statuses],
    ['getProjectStatus', (r) => r.getProjectStatus(PROJECT_ID), statuses],
    // 404 is a normal answer for getProjectByName (-> null), covered above
    ['getProjectByName', (r) => r.getProjectByName('agenthub'), statuses.filter((s) => s !== 404)]
  ]

  for (const [name, call, codes] of calls) {
    it.each(codes)(
      `${name}: status %i throws AnamnesisHttpError without the response body`,
      async (status) => {
        respond = (_req, res) => {
          res.writeHead(status, { 'Content-Type': 'text/plain' })
          res.end(`upstream said ${BODY_MARKER}`)
        }
        const reader = new AnamnesisReader({ baseUrl })

        const err = await call(reader).then(
          () => null,
          (e: unknown) => e
        )

        expect(err).toBeInstanceOf(AnamnesisHttpError)
        expect((err as AnamnesisHttpError).status).toBe(status)
        expect((err as Error).message).not.toContain(BODY_MARKER)
      }
    )
  }

  it('rejects within ~2.5 s when the server never answers', async () => {
    respond = () => {
      /* never answer */
    }
    const reader = new AnamnesisReader({ baseUrl })
    const started = Date.now()

    await expect(reader.listDecisions({ projectId: PROJECT_ID })).rejects.toBeDefined()

    expect(Date.now() - started).toBeLessThan(2500)
  }, 6000)
})
