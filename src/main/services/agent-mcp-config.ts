import { readFileSync } from 'fs'
import { DEFAULT_ANAMNESIS_URL } from '../../shared/constants/defaults'
import { resolveAnamnesisSecretForUrl } from './helpers/anamnesis-bearer'

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
 * The URL the anamnesis MCP child will actually call: its own env entry, else the inherited
 * process env, else the Anamnesis client default.
 */
function effectiveAnamnesisUrl(env: Record<string, string>): string {
  return env['ANAMNESIS_URL'] ?? process.env['ANAMNESIS_URL'] ?? DEFAULT_ANAMNESIS_URL
}

/**
 * Returns a copy of `mcpServers` whose `anamnesis` entry carries the spawned agent's
 * Anamnesis environment: OPTIMAEUS_CALLER is always 'hephaestus', AUTH_SECRET is set only
 * when a non-empty secret is available AND the effective ANAMNESIS_URL is https or loopback
 * http (S99; otherwise a warning is logged). Never invents an anamnesis entry; never mutates input.
 */
export function applyAnamnesisEnv(
  mcpServers: Record<string, unknown>,
  secret: string | null
): Record<string, unknown> {
  const anamnesis = mcpServers['anamnesis']
  if (anamnesis === null || typeof anamnesis !== 'object') return mcpServers
  const entry = anamnesis as Record<string, unknown>
  const env: Record<string, string> = { ...((entry.env ?? {}) as Record<string, string>) }
  // S102: strip any AUTH_SECRET the target repo's own env may carry BEFORE the URL
  // gate below decides whether to inject AgentHub's secret. A pre-existing value must
  // never reach the MCP child when the gate refuses to re-admit one.
  delete env['AUTH_SECRET']
  env['OPTIMAEUS_CALLER'] = 'hephaestus'
  const allowedSecret = resolveAnamnesisSecretForUrl(effectiveAnamnesisUrl(env), secret)
  if (allowedSecret) env['AUTH_SECRET'] = allowedSecret
  return { ...mcpServers, anamnesis: { ...entry, env } }
}
