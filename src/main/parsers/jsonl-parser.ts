import log from 'electron-log/main'
import type { SessionEntry } from '@shared/types/usage.types'

export function parseJsonlLine(line: string): SessionEntry | null {
  if (!line.trim()) return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(line)
  } catch {
    log.debug('Skipping malformed JSONL line')
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null

  const type = parsed.type
  if (type !== 'user' && type !== 'assistant') return null

  const message = parsed.message
  if (!message || typeof message !== 'object') return null

  const msg = message as Record<string, unknown>
  const usage = msg.usage as Record<string, number> | undefined

  const entry: SessionEntry = {
    type: type as 'user' | 'assistant',
    timestamp: (parsed.timestamp as string) ?? '',
    sessionId: (parsed.sessionId as string) ?? '',
    message: {
      role: (msg.role as string) ?? '',
      model: msg.model as string | undefined,
      usage: usage
        ? {
            input_tokens: usage.input_tokens ?? 0,
            output_tokens: usage.output_tokens ?? 0,
            cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
            cache_read_input_tokens: usage.cache_read_input_tokens ?? 0
          }
        : undefined
    }
  }

  return entry
}

export function parseJsonlContent(content: string): SessionEntry[] {
  if (!content.trim()) return []

  const lines = content.split('\n')
  const entries: SessionEntry[] = []

  for (const line of lines) {
    const entry = parseJsonlLine(line)
    if (entry) entries.push(entry)
  }

  return entries
}

export function extractUsageEntries(entries: SessionEntry[]): SessionEntry[] {
  return entries.filter(
    (entry) => entry.type === 'assistant' && entry.message.usage !== undefined
  )
}
