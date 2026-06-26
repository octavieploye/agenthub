import log from 'electron-log/main'

export interface ForgejoBuildOutcome {
  repoName: string
  sprintId: string
  status: 'done' | 'failed'
  summary: string
  completedAt: string
}

export interface IForgejoAdapter {
  isAvailable(): Promise<boolean>
  pushBuildOutcome(outcome: ForgejoBuildOutcome): Promise<void>
}

export class NullForgejoAdapter implements IForgejoAdapter {
  async isAvailable(): Promise<boolean> {
    return false
  }

  async pushBuildOutcome(_outcome: ForgejoBuildOutcome): Promise<void> {
    // standalone mode — Forgejo not connected
  }
}

interface ForgejoAdapterDeps {
  fetch?: typeof globalThis.fetch
}

export class ForgejoAdapter implements IForgejoAdapter {
  private baseUrl: string
  private token: string
  private fetch: typeof globalThis.fetch

  constructor(baseUrl: string, token: string, deps: ForgejoAdapterDeps = {}) {
    this.baseUrl = baseUrl
    this.token = token
    this.fetch = deps.fetch ?? globalThis.fetch
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.fetch(`${this.baseUrl}/api/v1/version`, {
        headers: { Authorization: `token ${this.token}` },
        signal: AbortSignal.timeout(3_000)
      })
      return res.ok
    } catch {
      return false
    }
  }

  async pushBuildOutcome(outcome: ForgejoBuildOutcome): Promise<void> {
    // TODO: implement Forgejo API write when integration is built
    log.info('ForgejoAdapter: pushBuildOutcome (stub — not yet implemented)', { repoName: outcome.repoName, sprintId: outcome.sprintId })
  }
}
