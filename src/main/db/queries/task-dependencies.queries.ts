import type Database from 'better-sqlite3'

export function insertTaskDependency(
  db: Database.Database,
  taskId: string,
  dependsOnId: string
): void {
  db.prepare(
    'INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)'
  ).run(taskId, dependsOnId)
}

export function getDependencyMap(db: Database.Database): Map<string, string[]> {
  const rows = db.prepare('SELECT task_id, depends_on_id FROM task_dependencies').all() as {
    task_id: string
    depends_on_id: string
  }[]
  const map = new Map<string, string[]>()
  for (const row of rows) {
    const existing = map.get(row.task_id) ?? []
    existing.push(row.depends_on_id)
    map.set(row.task_id, existing)
  }
  return map
}
