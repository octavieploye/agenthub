import { randomUUID } from 'crypto'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type { SBARHandoff, CreateSBARInput } from '../../../shared/types/recovery.types'

interface SBARRow {
  id: string
  agent_id: string
  agent_name: string
  repo_id: string
  situation: string
  background: string
  assessment: string
  recommendation: string
  created_at: string
}

function mapRow(row: SBARRow): SBARHandoff {
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    repoId: row.repo_id,
    situation: row.situation,
    background: row.background,
    assessment: row.assessment,
    recommendation: row.recommendation,
    createdAt: row.created_at
  }
}

export function insertSBAR(db: Database.Database, input: CreateSBARInput): SBARHandoff {
  const id = randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO sbar_handoffs (id, agent_id, agent_name, repo_id, situation, background, assessment, recommendation, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.agentId,
    input.agentName,
    input.repoId,
    input.situation,
    input.background,
    input.assessment,
    input.recommendation,
    now
  )

  log.info('SBAR handoff created', { id, agentId: input.agentId })

  return {
    id,
    agentId: input.agentId,
    agentName: input.agentName,
    repoId: input.repoId,
    situation: input.situation,
    background: input.background,
    assessment: input.assessment,
    recommendation: input.recommendation,
    createdAt: now
  }
}

export function getSBARByAgentId(db: Database.Database, agentId: string): SBARHandoff | null {
  const row = db.prepare(
    'SELECT * FROM sbar_handoffs WHERE agent_id = ? ORDER BY rowid DESC LIMIT 1'
  ).get(agentId) as SBARRow | undefined

  return row ? mapRow(row) : null
}

export function getAllSBARs(db: Database.Database): SBARHandoff[] {
  const rows = db.prepare(
    'SELECT * FROM sbar_handoffs ORDER BY rowid DESC'
  ).all() as SBARRow[]

  return rows.map(mapRow)
}

export function deleteSBAR(db: Database.Database, id: string): void {
  const remove = db.transaction(() => {
    db.prepare('UPDATE tasks SET sbar_id = NULL WHERE sbar_id = ?').run(id)
    db.prepare('DELETE FROM sbar_handoffs WHERE id = ?').run(id)
  })
  remove()
  log.debug('SBAR handoff deleted', { id })
}
