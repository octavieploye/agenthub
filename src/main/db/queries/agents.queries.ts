import { randomUUID } from 'crypto'
import log from 'electron-log/main'
import type { AgentState, AgentLifecycleStatus, StatusConfidence } from '../../../shared/types/agent.types'
import type Database from 'better-sqlite3'

function mapRow(row: Record<string, unknown>): AgentState {
  return {
    id: row.id as string,
    repoId: row.repo_id as string,
    name: row.name as string,
    status: row.status as AgentLifecycleStatus,
    confidence: row.confidence as StatusConfidence,
    model: row.model as string,
    provider: row.provider as AgentState['provider'],
    taskDescription: (row.task_description as string) ?? '',
    pid: row.pid as number | null,
    ptyFd: row.pty_fd as number | null,
    cwd: row.cwd as string,
    progress: (row.progress as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    color: (row.color as string) ?? '#3B82F6'
  }
}

export function getAllAgents(db: Database.Database): AgentState[] {
  const rows = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all()
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function getAgentById(db: Database.Database, id: string): AgentState | null {
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? mapRow(row) : null
}

export function insertAgent(
  db: Database.Database,
  agent: {
    repoId: string
    name: string
    cwd: string
    model?: string
    provider?: AgentState['provider']
    taskDescription?: string
    color?: string
  }
): AgentState {
  const id = randomUUID()
  const now = new Date().toISOString()
  const color = agent.color ?? '#3B82F6'

  db.prepare(
    `INSERT INTO agents (id, repo_id, name, cwd, model, provider, task_description, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    agent.repoId,
    agent.name,
    agent.cwd,
    agent.model ?? 'claude-sonnet-4-20250514',
    agent.provider ?? 'anthropic',
    agent.taskDescription ?? '',
    color,
    now,
    now
  )

  log.info('Agent inserted', { id, name: agent.name })
  return {
    id,
    repoId: agent.repoId,
    name: agent.name,
    status: 'spawning',
    confidence: 'unknown',
    model: agent.model ?? 'claude-sonnet-4-20250514',
    provider: agent.provider ?? 'anthropic',
    taskDescription: agent.taskDescription ?? '',
    pid: null,
    ptyFd: null,
    cwd: agent.cwd,
    progress: 0,
    createdAt: now,
    updatedAt: now,
    color
  }
}

export function updateAgentStatus(
  db: Database.Database,
  id: string,
  status: AgentLifecycleStatus,
  confidence: StatusConfidence
): void {
  const now = new Date().toISOString()
  db.prepare('UPDATE agents SET status = ?, confidence = ?, updated_at = ? WHERE id = ?').run(
    status,
    confidence,
    now,
    id
  )
  log.debug('Agent status updated', { id, status, confidence })
}

export function updateAgentPid(
  db: Database.Database,
  id: string,
  pid: number,
  ptyFd: number | null
): void {
  db.prepare('UPDATE agents SET pid = ?, pty_fd = ?, updated_at = ? WHERE id = ?').run(
    pid,
    ptyFd,
    new Date().toISOString(),
    id
  )
  log.debug('Agent PID updated', { id, pid })
}

export function deleteAgent(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM agents WHERE id = ?').run(id)
  log.info('Agent deleted', { id })
}
