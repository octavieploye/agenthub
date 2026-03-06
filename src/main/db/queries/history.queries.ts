import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type { HistoryEntry, HistorySearchResult } from '../../../shared/types/history.types'

function mapRow(row: Record<string, unknown>): HistoryEntry {
  return {
    id: row.id as number,
    agentId: row.agent_id as string,
    content: row.content as string,
    createdAt: row.created_at as string
  }
}

function mapSearchRow(row: Record<string, unknown>): HistorySearchResult {
  return {
    id: row.id as number,
    agentId: row.agent_id as string,
    content: row.content as string,
    createdAt: row.created_at as string,
    rank: row.rank as number
  }
}

export function getHistoryByAgent(db: Database.Database, agentId: string): HistoryEntry[] {
  const rows = db
    .prepare(
      `SELECT * FROM terminal_output WHERE agent_id = ? ORDER BY created_at ASC`
    )
    .all(agentId)
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function searchAgentHistory(
  db: Database.Database,
  agentId: string,
  query: string
): HistorySearchResult[] {
  try {
    const rows = db
      .prepare(
        `SELECT t.id, t.agent_id, t.content, t.created_at, f.rank
         FROM terminal_output_fts f
         JOIN terminal_output t ON t.id = f.rowid
         WHERE terminal_output_fts MATCH ? AND t.agent_id = ?
         ORDER BY f.rank`
      )
      .all(query, agentId)
    return rows.map((r) => mapSearchRow(r as Record<string, unknown>))
  } catch (err) {
    log.debug('FTS5 history search failed', err)
    return []
  }
}

export function insertTerminalOutput(
  db: Database.Database,
  agentId: string,
  content: string
): void {
  const now = new Date().toISOString()

  const result = db
    .prepare(
      `INSERT INTO terminal_output (agent_id, content, created_at) VALUES (?, ?, ?)`
    )
    .run(agentId, content, now)

  const rowId = Number(result.lastInsertRowid)

  db.prepare(`INSERT INTO terminal_output_fts (rowid, content) VALUES (?, ?)`).run(
    rowId,
    content
  )

  log.debug('Terminal output inserted', { agentId, rowId })
}
