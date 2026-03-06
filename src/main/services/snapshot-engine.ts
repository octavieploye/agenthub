import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type {
  SessionSnapshot,
  SnapshotTrigger,
  WorkspaceState,
  ViewMode
} from '../../shared/types/recovery.types'
import type { AgentState } from '../../shared/types/agent.types'
import {
  insertSnapshot,
  getLatestSnapshot,
  pruneOldSnapshots
} from '../db/queries/snapshots.queries'

const SNAPSHOT_INTERVAL_MS = 60_000
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000
const MAX_AGE_HOURS = 24

export interface SnapshotEngineConfig {
  intervalMs?: number
  pruneIntervalMs?: number
  maxAgeHours?: number
}

export interface WorkspaceStateProvider {
  getAgents(): AgentState[]
  getActiveAgentId(): string | null
  getViewMode(): ViewMode
  getSoundEnabled(): boolean
  getFocusedAgentId(): string | null
  getStatusFilter(): string | null
  getAppVersion(): string
}

export class SnapshotEngine {
  private db: Database.Database
  private provider: WorkspaceStateProvider
  private intervalMs: number
  private pruneIntervalMs: number
  private maxAgeHours: number
  private snapshotTimer: ReturnType<typeof setInterval> | null = null
  private pruneTimer: ReturnType<typeof setInterval> | null = null
  private lastSnapshotHash: string | null = null

  constructor(
    db: Database.Database,
    provider: WorkspaceStateProvider,
    config?: SnapshotEngineConfig
  ) {
    this.db = db
    this.provider = provider
    this.intervalMs = config?.intervalMs ?? SNAPSHOT_INTERVAL_MS
    this.pruneIntervalMs = config?.pruneIntervalMs ?? PRUNE_INTERVAL_MS
    this.maxAgeHours = config?.maxAgeHours ?? MAX_AGE_HOURS
  }

  start(): void {
    if (this.snapshotTimer) return

    log.info('Snapshot engine started', { intervalMs: this.intervalMs })

    this.snapshotTimer = setInterval(() => {
      this.takeSnapshot('periodic')
    }, this.intervalMs)

    this.pruneTimer = setInterval(() => {
      this.prune()
    }, this.pruneIntervalMs)
  }

  stop(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer)
      this.snapshotTimer = null
    }
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer)
      this.pruneTimer = null
    }
    log.info('Snapshot engine stopped')
  }

  isRunning(): boolean {
    return this.snapshotTimer !== null
  }

  takeSnapshot(trigger: SnapshotTrigger): SessionSnapshot | null {
    const state = this.buildWorkspaceState()
    const hash = this.computeHash(state)

    if (trigger === 'periodic' && hash === this.lastSnapshotHash) {
      log.debug('Skipping snapshot, no state change')
      return null
    }

    const snapshot = insertSnapshot(this.db, state, trigger)
    this.lastSnapshotHash = hash

    log.debug('Snapshot taken', {
      id: snapshot.id,
      trigger,
      agentCount: state.agents.length
    })

    return snapshot
  }

  getLastSnapshot(): SessionSnapshot | null {
    return getLatestSnapshot(this.db)
  }

  prune(): number {
    return pruneOldSnapshots(this.db, this.maxAgeHours)
  }

  buildWorkspaceState(): WorkspaceState {
    return {
      agents: this.provider.getAgents(),
      activeAgentId: this.provider.getActiveAgentId(),
      viewMode: this.provider.getViewMode(),
      soundEnabled: this.provider.getSoundEnabled(),
      focusedAgentId: this.provider.getFocusedAgentId(),
      statusFilter: this.provider.getStatusFilter(),
      appVersion: this.provider.getAppVersion(),
      timestamp: new Date().toISOString()
    }
  }

  private computeHash(state: WorkspaceState): string {
    const agentSummary = state.agents
      .map((a) => `${a.id}:${a.status}:${a.progress}`)
      .sort()
      .join('|')
    return `${agentSummary}::${state.viewMode}::${state.activeAgentId}::${state.focusedAgentId}::${state.soundEnabled}`
  }
}
