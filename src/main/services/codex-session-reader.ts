import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

export interface CodexSessionUsage {
  totalSessions: number
  lastSessionAt: string | null
}

/**
 * Reads Codex CLI session JSONL files from the sessions directory.
 * Counts session_meta entries (one per session) and tracks the latest timestamp.
 * Directory structure: <root>/YYYY/MM/*.jsonl
 */
export function readCodexSessionUsage(sessionsRoot: string): CodexSessionUsage {
  if (!existsSync(sessionsRoot)) {
    return { totalSessions: 0, lastSessionAt: null }
  }

  let totalSessions = 0
  let lastSessionAt: string | null = null

  const jsonlFiles = collectJsonlFiles(sessionsRoot)

  for (const filePath of jsonlFiles) {
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }

    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line)
        if (entry.type === 'session_meta') {
          totalSessions++
          if (entry.timestamp && (!lastSessionAt || entry.timestamp > lastSessionAt)) {
            lastSessionAt = entry.timestamp
          }
        }
      } catch {
        // Skip malformed lines
      }
    }
  }

  return { totalSessions, lastSessionAt }
}

function collectJsonlFiles(dir: string): string[] {
  const files: string[] = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...collectJsonlFiles(fullPath))
      } else if (entry.name.endsWith('.jsonl')) {
        files.push(fullPath)
      }
    }
  } catch {
    // Directory unreadable — skip
  }
  return files
}
