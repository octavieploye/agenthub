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
