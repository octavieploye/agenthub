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

export interface AnamnesisReaderOpts {
  baseUrl: string
  authSecret?: string
  caller?: string
}

export class AnamnesisReader {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>

  constructor(opts: AnamnesisReaderOpts) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.headers = {
      'Content-Type': 'application/json',
      'X-Optimaeus-Caller': opts.caller ?? 'hephaestus',
    }
    if (opts.authSecret) {
      this.headers['Authorization'] = `Bearer ${opts.authSecret}`
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
