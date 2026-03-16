import { exec, spawn } from 'child_process'
import { homedir } from 'os'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type { ContainerInfo, ContainerStatus, DockerContainerConfig } from '../../shared/types/docker.types'
import { DOCKER_IMAGE_TAG, DOCKER_CONTAINER_PREFIX, DOCKER_DEFAULT_TTL_DAYS } from '../../shared/types/docker.types'

const execAsync = promisify(exec)

interface ContainerRecord {
  id: string
  repoId: string
  containerId: string
  status: ContainerStatus
  lastActivity: number
  config: DockerContainerConfig
}

interface ContainerManagerDeps {
  logInfo: (message: string, meta?: Record<string, unknown>) => void
  logWarning: (message: string, meta?: Record<string, unknown>) => void
}

export class ContainerManager {
  private containers = new Map<string, ContainerRecord>()
  private execCounts = new Map<string, number>()
  private db: Database.Database | null = null
  private readonly deps: ContainerManagerDeps
  private ttlDays: number = DOCKER_DEFAULT_TTL_DAYS

  constructor(deps: ContainerManagerDeps) {
    this.deps = deps
  }

  async init(db: Database.Database, ttlDays?: number): Promise<void> {
    this.db = db
    if (ttlDays !== undefined) this.ttlDays = ttlDays

    // Load persisted containers into memory
    const rows = db.prepare('SELECT * FROM containers').all() as Array<{
      id: string
      repo_id: string
      container_id: string
      status: string
      created_at: string
      last_activity: string
      config_json: string
    }>

    for (const row of rows) {
      const config = JSON.parse(row.config_json) as DockerContainerConfig
      this.containers.set(row.repo_id, {
        id: row.id,
        repoId: row.repo_id,
        containerId: row.container_id,
        status: row.status as ContainerStatus,
        lastActivity: new Date(row.last_activity).getTime(),
        config
      })
    }

    // TTL cleanup: destroy containers idle beyond ttlDays
    const ttlMs = this.ttlDays * 24 * 60 * 60 * 1000
    const now = Date.now()
    for (const [repoId, record] of this.containers) {
      if (record.status === 'stopped' && now - record.lastActivity > ttlMs) {
        this.deps.logInfo('ContainerManager: TTL expired, destroying container', { repoId, containerId: record.containerId })
        await this.destroyContainer(repoId).catch((err) => {
          this.deps.logWarning('ContainerManager: failed to destroy expired container', { repoId, err: String(err) })
        })
      }
    }

    // Orphan detection: list agenthub-* containers from Docker, reconcile with DB
    await this.detectOrphans()
  }

  private async detectOrphans(): Promise<void> {
    try {
      const { stdout } = await execAsync(
        `docker ps -a --filter "name=${DOCKER_CONTAINER_PREFIX}" --format "{{.ID}}\\t{{.Names}}\\t{{.Status}}"`
      )
      const lines = stdout.trim().split('\n').filter(Boolean)
      const knownIds = new Set(Array.from(this.containers.values()).map((r) => r.containerId))
      for (const line of lines) {
        const [id] = line.split('\t')
        if (id && !knownIds.has(id)) {
          this.deps.logWarning('ContainerManager: orphan container detected', { id })
          // Orphans are logged but not auto-destroyed — UI (S5) will surface them
        }
      }
    } catch {
      // Docker not available — skip orphan detection
    }
  }

  async ensureContainer(repoId: string, repoPath: string, config: DockerContainerConfig): Promise<string> {
    const existing = this.containers.get(repoId)

    if (existing && existing.status === 'running') {
      this.updateLastActivity(repoId)
      return existing.containerId
    }

    if (existing && existing.status === 'stopped') {
      this.deps.logInfo('ContainerManager: restarting stopped container', { repoId, containerId: existing.containerId })
      await execAsync(`docker start ${existing.containerId}`)
      this.setStatus(repoId, 'running')
      this.updateLastActivity(repoId)
      return existing.containerId
    }

    // Create new container
    const containerName = `${DOCKER_CONTAINER_PREFIX}${repoId.slice(0, 8)}`
    const home = homedir()

    // Check for an orphaned container with this name (e.g. from a previous session not in DB)
    try {
      const { stdout: psOut } = await execAsync(
        `docker ps -a --filter "name=^/${containerName}$" --format "{{.ID}}\\t{{.Status}}"`
      )
      const line = psOut.trim()
      if (line) {
        const [orphanId, ...statusParts] = line.split('\t')
        const statusStr = statusParts.join('\t')
        if (orphanId) {
          this.deps.logInfo('ContainerManager: found orphan container, reusing', { repoId, orphanId, statusStr })
          const isRunning = statusStr.startsWith('Up')
          if (!isRunning) {
            await execAsync(`docker start ${orphanId}`)
          }
          const record: ContainerRecord = {
            id: randomUUID(),
            repoId,
            containerId: orphanId,
            status: 'running',
            lastActivity: Date.now(),
            config
          }
          this.containers.set(repoId, record)
          this.persistContainer(repoId, record)
          this.deps.logInfo('ContainerManager: orphan container registered and started', { repoId, orphanId })
          return orphanId
        }
      }
    } catch {
      // Docker not available or no orphan — proceed with create
    }

    const createArgs = [
      'create',
      '--name', containerName,
      ...(config.networkMode === 'none' ? ['--network', 'none'] : ['--network', 'host']),
      '-v', `${repoPath}:/workspace`,
      '-v', `${home}/.claude:/home/agent/.claude`,
      ...(config.isLeadAgent ? [
        '-v', `${home}/.gitconfig:/home/agent/.gitconfig:ro`,
        '-v', `${home}/.ssh:/home/agent/.ssh:ro`
      ] : []),
      '--cpus', String(config.cpus),
      '--memory', `${config.memoryGb}g`,
      DOCKER_IMAGE_TAG
    ]

    const containerId = await new Promise<string>((resolve, reject) => {
      const proc = spawn('docker', createArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
      let out = ''
      let errOut = ''
      proc.stdout?.on('data', (d: Buffer) => { out += d.toString() })
      proc.stderr?.on('data', (d: Buffer) => { errOut += d.toString() })
      proc.on('close', (code) => {
        if (code === 0) resolve(out.trim())
        else reject(new Error(`docker create exited ${code}: ${errOut.trim()}`))
      })
      proc.on('error', reject)
    })

    await execAsync(`docker start ${containerId}`)

    const record: ContainerRecord = {
      id: randomUUID(),
      repoId,
      containerId,
      status: 'running',
      lastActivity: Date.now(),
      config
    }
    this.containers.set(repoId, record)
    this.persistContainer(repoId, record)

    this.deps.logInfo('ContainerManager: container created and started', { repoId, containerId, containerName })
    return containerId
  }

  async stopContainer(repoId: string): Promise<void> {
    const record = this.containers.get(repoId)
    if (!record || record.status === 'stopped') return
    await execAsync(`docker stop ${record.containerId}`)
    this.setStatus(repoId, 'stopped')
    this.updateLastActivity(repoId)
    this.deps.logInfo('ContainerManager: container stopped', { repoId, containerId: record.containerId })
  }

  async destroyContainer(repoId: string): Promise<void> {
    const record = this.containers.get(repoId)
    if (!record || record.status === 'destroyed') return
    try {
      await execAsync(`docker rm -f ${record.containerId}`)
    } catch {
      // May already be removed
    }
    this.containers.delete(repoId)
    this.db?.prepare('DELETE FROM containers WHERE repo_id = ?').run(repoId)
    this.deps.logInfo('ContainerManager: container destroyed', { repoId, containerId: record.containerId })
  }

  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = []
    for (const repoId of this.containers.keys()) {
      stopPromises.push(
        this.stopContainer(repoId).catch((err) => {
          this.deps.logWarning('ContainerManager: failed to stop container on shutdown', { repoId, err: String(err) })
        })
      )
    }
    await Promise.all(stopPromises)
  }

  listContainers(): ContainerInfo[] {
    return Array.from(this.containers.values()).map((r) => ({
      id: r.id,
      repoId: r.repoId,
      containerId: r.containerId,
      status: r.status,
      createdAt: new Date(r.lastActivity).toISOString(),
      lastActivity: new Date(r.lastActivity).toISOString(),
      config: r.config
    }))
  }

  getContainerForRepo(repoId: string): ContainerRecord | undefined {
    return this.containers.get(repoId)
  }

  updateLastActivity(repoId: string): void {
    const record = this.containers.get(repoId)
    if (!record) return
    record.lastActivity = Date.now()
    this.db?.prepare('UPDATE containers SET last_activity = datetime("now") WHERE repo_id = ?').run(repoId)
  }

  private setStatus(repoId: string, status: ContainerStatus): void {
    const record = this.containers.get(repoId)
    if (!record) return
    record.status = status
    this.db?.prepare('UPDATE containers SET status = ? WHERE repo_id = ?').run(status, repoId)
  }

  incrementExecCount(repoId: string): void {
    this.execCounts.set(repoId, (this.execCounts.get(repoId) ?? 0) + 1)
    this.deps.logInfo('ContainerManager: exec count incremented', {
      repoId,
      count: this.execCounts.get(repoId)
    })
  }

  decrementExecCount(repoId: string): void {
    const current = this.execCounts.get(repoId) ?? 0
    const next = Math.max(0, current - 1)
    this.execCounts.set(repoId, next)
    this.deps.logInfo('ContainerManager: exec count decremented', { repoId, count: next })
  }

  getExecCount(repoId: string): number {
    return this.execCounts.get(repoId) ?? 0
  }

  async stopContainerIfIdle(repoId: string): Promise<void> {
    const count = this.getExecCount(repoId)
    if (count > 0) {
      this.deps.logInfo('ContainerManager: container has active execs, not stopping', { repoId, count })
      return
    }
    await this.stopContainer(repoId)
  }

  private persistContainer(repoId: string, record: ContainerRecord): void {
    if (!this.db) return
    if (!record.id) {
      record.id = randomUUID()
    }
    this.db.prepare(`
      INSERT OR REPLACE INTO containers (id, repo_id, container_id, status, config_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(record.id, repoId, record.containerId, record.status, JSON.stringify(record.config))
  }
}
