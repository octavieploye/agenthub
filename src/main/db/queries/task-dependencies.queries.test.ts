import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'
import { insertTask } from './tasks.queries'
import { insertTaskDependency, getDependencyMap } from './task-dependencies.queries'

let db: Database.Database
let repoId: string

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db)
  db.prepare("INSERT INTO repos (id, name, path, created_at) VALUES ('r1', 'test', '/tmp', datetime('now'))").run()
  repoId = 'r1'
})

describe('insertTaskDependency', () => {
  it('inserts a dependency between two tasks', () => {
    const t1 = insertTask(db, { repoId, title: 'Task A' })
    const t2 = insertTask(db, { repoId, title: 'Task B' })
    insertTaskDependency(db, t2.id, t1.id)
    const row = db.prepare('SELECT * FROM task_dependencies WHERE task_id = ?').get(t2.id) as Record<string, unknown>
    expect(row).not.toBeNull()
    expect(row.depends_on_id).toBe(t1.id)
  })

  it('is a no-op on duplicate insert (PRIMARY KEY constraint)', () => {
    const t1 = insertTask(db, { repoId, title: 'Task A' })
    const t2 = insertTask(db, { repoId, title: 'Task B' })
    insertTaskDependency(db, t2.id, t1.id)
    expect(() => insertTaskDependency(db, t2.id, t1.id)).not.toThrow()
  })
})

describe('getDependencyMap', () => {
  it('returns empty map when no dependencies exist', () => {
    const map = getDependencyMap(db)
    expect(map.size).toBe(0)
  })

  it('returns correct map for multiple dependencies', () => {
    const t1 = insertTask(db, { repoId, title: 'Task A' })
    const t2 = insertTask(db, { repoId, title: 'Task B' })
    const t3 = insertTask(db, { repoId, title: 'Task C' })
    insertTaskDependency(db, t2.id, t1.id)
    insertTaskDependency(db, t3.id, t1.id)
    insertTaskDependency(db, t3.id, t2.id)

    const map = getDependencyMap(db)
    expect(map.get(t2.id)).toEqual([t1.id])
    expect(map.get(t3.id)).toContain(t1.id)
    expect(map.get(t3.id)).toContain(t2.id)
    expect(map.get(t1.id)).toBeUndefined()
  })
})
