import log from 'electron-log/main'
import type Database from 'better-sqlite3'

export interface SearchResult {
  type: 'agent' | 'task' | 'repo' | 'terminal'
  id: string
  title: string
  subtitle: string
  score: number
}

export function searchAgents(db: Database.Database, query: string): SearchResult[] {
  const pattern = `%${query}%`
  const rows = db
    .prepare(
      `SELECT id, name, task_description, cwd, status FROM agents
       WHERE name LIKE ? OR task_description LIKE ? OR cwd LIKE ?
       ORDER BY updated_at DESC LIMIT 10`
    )
    .all(pattern, pattern, pattern) as Record<string, unknown>[]

  return rows.map((r) => ({
    type: 'agent' as const,
    id: r.id as string,
    title: r.name as string,
    subtitle: `${(r.cwd as string).split('/').pop()} — ${r.status}`,
    score: 1
  }))
}

export function searchTasks(db: Database.Database, query: string): SearchResult[] {
  const pattern = `%${query}%`
  const rows = db
    .prepare(
      `SELECT t.id, t.title, t.description, t.status, t.priority, r.name as repo_name
       FROM tasks t LEFT JOIN repos r ON t.repo_id = r.id
       WHERE t.title LIKE ? OR t.description LIKE ?
       ORDER BY t.priority ASC, t.updated_at DESC LIMIT 10`
    )
    .all(pattern, pattern) as Record<string, unknown>[]

  return rows.map((r) => ({
    type: 'task' as const,
    id: r.id as string,
    title: r.title as string,
    subtitle: `${r.repo_name ?? 'Unknown'} — P${r.priority} — ${r.status}`,
    score: 1
  }))
}

export function searchRepos(db: Database.Database, query: string): SearchResult[] {
  const pattern = `%${query}%`
  const rows = db
    .prepare(
      `SELECT id, name, path FROM repos WHERE hidden = 0 AND (name LIKE ? OR path LIKE ?) ORDER BY name LIMIT 10`
    )
    .all(pattern, pattern) as Record<string, unknown>[]

  return rows.map((r) => ({
    type: 'repo' as const,
    id: r.id as string,
    title: r.name as string,
    subtitle: r.path as string,
    score: 1
  }))
}

export function searchTerminalOutput(db: Database.Database, query: string): SearchResult[] {
  try {
    const rows = db
      .prepare(
        `SELECT t.agent_id, a.name, snippet(terminal_output_fts, 0, '<<', '>>', '...', 32) as snippet
         FROM terminal_output_fts
         JOIN terminal_output t ON terminal_output_fts.rowid = t.id
         LEFT JOIN agents a ON t.agent_id = a.id
         WHERE terminal_output_fts MATCH ?
         ORDER BY rank LIMIT 10`
      )
      .all(query) as Record<string, unknown>[]

    return rows.map((r) => ({
      type: 'terminal' as const,
      id: r.agent_id as string,
      title: (r.name as string) ?? 'Unknown Agent',
      subtitle: (r.snippet as string) ?? '',
      score: 1
    }))
  } catch (err) {
    log.debug('FTS5 search failed (likely empty table)', err)
    return []
  }
}

export function searchAll(db: Database.Database, query: string): SearchResult[] {
  if (!query || query.trim().length === 0) return []

  const trimmed = query.trim()
  const agents = searchAgents(db, trimmed)
  const tasks = searchTasks(db, trimmed)
  const repos = searchRepos(db, trimmed)
  const terminal = searchTerminalOutput(db, trimmed)

  return [...agents, ...tasks, ...repos, ...terminal]
}
