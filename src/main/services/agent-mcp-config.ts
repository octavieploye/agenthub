import { readFileSync } from 'fs'

/**
 * Reads the `mcpServers` block from a Claude settings.json file.
 * Returns an empty object on any error (missing file, malformed JSON, no mcpServers key).
 * This is intentionally a pure I/O function with no Electron dependencies so it can be unit-tested.
 */
export function readSettingsMcpServers(settingsPath: string): Record<string, unknown> {
  try {
    const raw = readFileSync(settingsPath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'mcpServers' in parsed &&
      typeof (parsed as Record<string, unknown>).mcpServers === 'object' &&
      (parsed as Record<string, unknown>).mcpServers !== null
    ) {
      return (parsed as Record<string, unknown>).mcpServers as Record<string, unknown>
    }
  } catch {
    // missing file, malformed JSON, or permission error — fall through
  }
  return {}
}

/**
 * Returns a copy of `mcpServers` whose `anamnesis` entry carries the spawned agent's
 * Anamnesis environment: OPTIMAEUS_CALLER is always 'hephaestus', AUTH_SECRET is set only
 * when a non-empty secret is available. Never invents an anamnesis entry; never mutates input.
 */
export function applyAnamnesisEnv(
  mcpServers: Record<string, unknown>,
  secret: string | null
): Record<string, unknown> {
  const anamnesis = mcpServers['anamnesis']
  if (anamnesis === null || typeof anamnesis !== 'object') return mcpServers
  const entry = anamnesis as Record<string, unknown>
  const env: Record<string, string> = { ...((entry.env ?? {}) as Record<string, string>) }
  env['OPTIMAEUS_CALLER'] = 'hephaestus'
  if (typeof secret === 'string' && secret.length > 0) env['AUTH_SECRET'] = secret
  return { ...mcpServers, anamnesis: { ...entry, env } }
}
