import { safeStorage } from 'electron'
import log from 'electron-log/main'
import { getDb } from '../db/connection'

/**
 * Single source of the Anamnesis auth secret: `settings.anamnesis_auth_secret`
 * (encrypted via Electron safeStorage). Environment variables are never read here —
 * `ANAMNESIS_AUTH_SECRET` is only imported once via `bootstrapAnamnesisSecretFromEnv()`.
 */

/** Dedicated settings row that holds the encrypted secret (value column stays ''). */
const SECRET_ANCHOR_KEY = '__secret_anchor__'

/** Read the encrypted blob, wherever it is stored (anchor row, or a legacy first-row placement). */
function readSecretBlob(): Buffer | null {
  const row = getDb()
    .prepare('SELECT anamnesis_auth_secret FROM settings WHERE anamnesis_auth_secret IS NOT NULL LIMIT 1')
    .get() as { anamnesis_auth_secret: Buffer | null } | undefined
  return row?.anamnesis_auth_secret ?? null
}

/**
 * Load the Anamnesis auth secret from the DB (decrypted via safeStorage).
 * Returns '' if not set or if decryption fails.
 */
export function loadAnamnesisSecret(): string {
  try {
    const blob = readSecretBlob()
    if (!blob) return ''
    if (!safeStorage.isEncryptionAvailable()) {
      log.warn('secret-store: safeStorage encryption not available — cannot decrypt Anamnesis secret')
      return ''
    }
    return safeStorage.decryptString(blob)
  } catch (err) {
    log.warn('secret-store: failed to load Anamnesis secret', {
      error: err instanceof Error ? err.message : String(err),
    })
    return ''
  }
}

/** True when an encrypted secret is stored. Never decrypts, never exposes the value. */
export function hasAnamnesisSecret(): boolean {
  try {
    return readSecretBlob() !== null
  } catch {
    return false
  }
}

/**
 * Encrypt and store the Anamnesis auth secret in the DB via safeStorage.
 * The blob lives on a dedicated anchor row so deleting/replacing ordinary settings never drops it.
 */
export function storeAnamnesisSecret(secret: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption not available on this system')
  }
  const encrypted = safeStorage.encryptString(secret)
  const db = getDb()
  db.transaction(() => {
    // Drop any legacy placement (first settings row) so only one encrypted copy exists.
    db.prepare(
      'UPDATE settings SET anamnesis_auth_secret = NULL WHERE anamnesis_auth_secret IS NOT NULL AND key != ?'
    ).run(SECRET_ANCHOR_KEY)
    db.prepare(
      `INSERT INTO settings (key, value, anamnesis_auth_secret) VALUES (?, '', ?)
       ON CONFLICT(key) DO UPDATE SET anamnesis_auth_secret = excluded.anamnesis_auth_secret`
    ).run(SECRET_ANCHOR_KEY, encrypted)
  })()
}

/**
 * One-time bootstrap: import `env.ANAMNESIS_AUTH_SECRET` into the store.
 * Returns true only when the secret was imported now. Returns false when the env var is
 * unset/blank or a secret is already stored (a Settings-UI value always wins; later env values are ignored).
 */
export function bootstrapAnamnesisSecretFromEnv(
  env: Record<string, string | undefined> = process.env
): boolean {
  const candidate = env['ANAMNESIS_AUTH_SECRET']?.trim()
  if (!candidate) return false
  if (hasAnamnesisSecret()) return false
  storeAnamnesisSecret(candidate)
  return true
}
