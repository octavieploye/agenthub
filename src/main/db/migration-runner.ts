import Database from 'better-sqlite3'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import log from 'electron-log/main'

export function runMigrations(db: Database.Database, migrationsDir?: string): void {
  const dir = migrationsDir ?? join(__dirname, 'migrations')

  let files: string[]
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
  } catch {
    log.warn('No migrations directory found at', dir)
    return
  }

  const currentVersion = db.pragma('user_version', { simple: true }) as number
  log.info('Current DB version:', currentVersion)

  for (const file of files) {
    const match = file.match(/^(\d+)/)
    if (!match) continue

    const version = parseInt(match[1], 10)
    if (version <= currentVersion) continue

    log.info(`Applying migration ${file}`)
    const sql = readFileSync(join(dir, file), 'utf-8')
    db.exec(sql)
    db.pragma(`user_version = ${version}`)
    log.info(`Migration ${file} applied, DB version now ${version}`)
  }
}
