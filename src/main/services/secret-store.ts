import { safeStorage } from 'electron'
import log from 'electron-log/main'
import { getDb } from '../db/connection'

/**
 * Load the Anamnesis auth secret from the DB (decrypted via safeStorage).
 * Returns '' if not set or if decryption fails.
 */
export function loadAnamnesisSecret(): string {
  try {
    const db = getDb()
    const row = db
      .prepare('SELECT anamnesis_auth_secret FROM settings LIMIT 1')
      .get() as { anamnesis_auth_secret: Buffer | null } | undefined
    if (!row?.anamnesis_auth_secret) return ''
    if (!safeStorage.isEncryptionAvailable()) {
      log.warn('secret-store: safeStorage encryption not available — cannot decrypt Anamnesis secret')
      return ''
    }
    return safeStorage.decryptString(row.anamnesis_auth_secret)
  } catch (err) {
    log.warn('secret-store: failed to load Anamnesis secret', {
      error: err instanceof Error ? err.message : String(err),
    })
    return ''
  }
}

/**
 * Encrypt and store the Anamnesis auth secret in the DB via safeStorage.
 */
export function storeAnamnesisSecret(secret: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption not available on this system')
  }
  const encrypted = safeStorage.encryptString(secret)
  const db = getDb()
  // Update the first row that has the anamnesis_auth_secret column.
  const result = db
    .prepare(
      `UPDATE settings SET anamnesis_auth_secret = ? WHERE rowid = (SELECT rowid FROM settings LIMIT 1)`
    )
    .run(encrypted)
  // If no rows exist yet, insert a placeholder row to hold the secret.
  if (result.changes === 0) {
    db.prepare(
      `INSERT INTO settings (key, value, anamnesis_auth_secret) VALUES ('__secret_anchor__', '', ?)`
    ).run(encrypted)
  }
}
