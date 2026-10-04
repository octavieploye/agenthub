import log from 'electron-log/main'
import type {
  LifecycleMetrics,
  LayerDistribution,
  LifecycleHistoryEntry,
  ArchivedPage,
  PolicyUpdateRequest,
  PolicyResponse,
  LifecycleRunResult,
  RestoreResult,
} from '../../shared/types/lifecycle.types'
import type {
  DecisionDomain,
  DecisionItem,
  ProjectRef,
  ProjectStatusItem
} from '../../shared/types/decisions.types'
import { resolveAnamnesisAuthHeaders } from './helpers/anamnesis-bearer'

export interface AnamnesisReaderOpts {
  baseUrl: string
  authSecret?: string
  caller?: string
}

/** Per-request budget for the shared-brain reads, which sit on the agent-spawn path. */
const BOUNDED_REQUEST_TIMEOUT_MS = 2000
const DECISIONS_DEFAULT_LIMIT = 50
const DECISIONS_MAX_LIMIT = 500

/**
 * A failed bounded Anamnesis read. `status` is the HTTP status, or 0 when no response was
 * obtained (timeout, network error, unreadable body). The message is fixed: it never carries
 * the response body or the request's query values.
 */
export class AnamnesisHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(
      status === 0
        ? 'Anamnesis request failed (no response)'
        : `Anamnesis request failed (status ${status})`
    )
    this.name = 'AnamnesisHttpError'
    this.status = status
  }
}

function clampDecisionsLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DECISIONS_DEFAULT_LIMIT
  return Math.min(DECISIONS_MAX_LIMIT, Math.max(1, Math.trunc(limit)))
}

export class AnamnesisReader {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>

  constructor(opts: AnamnesisReaderOpts) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.headers = {
      'Content-Type': 'application/json',
      'X-Optimaeus-Caller': opts.caller ?? 'hephaestus',
      ...resolveAnamnesisAuthHeaders(this.baseUrl, opts.authSecret),
    }
  }

  async getMetrics(): Promise<LifecycleMetrics> {
    return this.get<LifecycleMetrics>('/lifecycle/metrics')
  }

  async getDistribution(): Promise<LayerDistribution[]> {
    return this.get<LayerDistribution[]>('/lifecycle/distribution')
  }

  async getHistory(limit = 20): Promise<LifecycleHistoryEntry[]> {
    return this.get<LifecycleHistoryEntry[]>(`/lifecycle/history?limit=${limit}`)
  }

  async getArchived(params?: {
    layer?: string
    page?: number
    page_size?: number
  }): Promise<ArchivedPage> {
    const qs = new URLSearchParams()
    if (params?.layer) qs.set('layer', params.layer)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.page_size) qs.set('page_size', String(params.page_size))
    const query = qs.toString()
    return this.get<ArchivedPage>(`/lifecycle/archived${query ? `?${query}` : ''}`)
  }

  async updatePolicy(layer: string, policy: PolicyUpdateRequest): Promise<PolicyResponse> {
    return this.put<PolicyResponse>(`/lifecycle/policies/${layer}`, policy)
  }

  async runCycle(): Promise<LifecycleRunResult> {
    return this.post<LifecycleRunResult>('/lifecycle/run')
  }

  async restore(archiveId: string): Promise<RestoreResult> {
    return this.post<RestoreResult>(`/lifecycle/archive/${archiveId}/restore`)
  }

  async listDecisions(params: {
    projectId: string
    domain?: DecisionDomain
    limit?: number
  }): Promise<DecisionItem[]> {
    const qs = new URLSearchParams({ project_id: params.projectId })
    if (params.domain) qs.set('domain', params.domain)
    qs.set('limit', String(clampDecisionsLimit(params.limit)))
    return this.getBounded<DecisionItem[]>(`/decisions?${qs.toString()}`)
  }

  async getProjectStatus(projectId: string): Promise<ProjectStatusItem[]> {
    return this.getBounded<ProjectStatusItem[]>(`/projects/${encodeURIComponent(projectId)}/status`)
  }

  /** The project registered under `name`, or null when Anamnesis does not know it (404). */
  async getProjectByName(name: string): Promise<ProjectRef | null> {
    const key = encodeURIComponent(name.trim().toLowerCase())
    try {
      const row = await this.getBounded<ProjectRef>(`/projects/${key}`)
      return { id: row.id, name: row.name, tier: row.tier }
    } catch (err) {
      if (err instanceof AnamnesisHttpError && err.status === 404) return null
      throw err
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.get('/health')
      return true
    } catch {
      return false
    }
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, { method: 'GET', headers: this.headers })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Anamnesis GET ${path} failed: ${res.status} ${text}`)
    }
    return res.json() as Promise<T>
  }

  /**
   * GET with a hard timeout and a body-free error: any non-2xx throws AnamnesisHttpError(status),
   * any timeout, network or parse failure throws AnamnesisHttpError(0).
   */
  private async getBounded<T>(path: string): Promise<T> {
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(BOUNDED_REQUEST_TIMEOUT_MS)
      })
    } catch {
      throw new AnamnesisHttpError(0)
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined)
      throw new AnamnesisHttpError(res.status)
    }
    try {
      return (await res.json()) as T
    } catch {
      throw new AnamnesisHttpError(0)
    }
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Anamnesis POST ${path} failed: ${res.status} ${text}`)
    }
    return res.json() as Promise<T>
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Anamnesis PUT ${path} failed: ${res.status} ${text}`)
    }
    return res.json() as Promise<T>
  }
}

let reader: AnamnesisReader | null = null

export function initAnamnesisReader(opts: AnamnesisReaderOpts): void {
  reader = new AnamnesisReader(opts)
  log.info('AnamnesisReader initialized', { baseUrl: opts.baseUrl })
}

export function getAnamnesisReader(): AnamnesisReader | null {
  return reader
}
