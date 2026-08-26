import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { readCodexSessionUsage } from './codex-session-reader'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'codex-sessions-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('readCodexSessionUsage', () => {
  it('counts session_meta entries as sessions from JSONL files', () => {
    const sessionDir = join(tempDir, '2026', '08')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'session-a.jsonl'),
      [
        '{"timestamp":"2026-08-26T10:00:00Z","type":"session_meta","payload":{}}',
        '{"timestamp":"2026-08-26T10:00:01Z","type":"response_item","payload":{}}',
        '{"timestamp":"2026-08-26T10:00:02Z","type":"response_item","payload":{}}',
      ].join('\n')
    )

    writeFileSync(
      join(sessionDir, 'session-b.jsonl'),
      [
        '{"timestamp":"2026-08-26T14:00:00Z","type":"session_meta","payload":{}}',
        '{"timestamp":"2026-08-26T14:00:01Z","type":"event_msg","payload":{}}',
      ].join('\n')
    )

    const result = readCodexSessionUsage(tempDir)
    expect(result.totalSessions).toBe(2)
    expect(result.lastSessionAt).toBe('2026-08-26T14:00:00Z')
  })

  it('returns zero when sessions directory does not exist', () => {
    const result = readCodexSessionUsage(join(tempDir, 'nonexistent'))
    expect(result.totalSessions).toBe(0)
    expect(result.lastSessionAt).toBeNull()
  })

  it('skips malformed JSON lines gracefully', () => {
    const sessionDir = join(tempDir, '2026', '08')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'broken.jsonl'),
      [
        '{"timestamp":"2026-08-26T10:00:00Z","type":"session_meta","payload":{}}',
        'this is not valid json',
        '{"timestamp":"2026-08-26T10:00:02Z","type":"response_item","payload":{}}',
      ].join('\n')
    )

    const result = readCodexSessionUsage(tempDir)
    expect(result.totalSessions).toBe(1)
  })

  it('handles empty JSONL files', () => {
    const sessionDir = join(tempDir, '2026', '08')
    mkdirSync(sessionDir, { recursive: true })
    writeFileSync(join(sessionDir, 'empty.jsonl'), '')

    const result = readCodexSessionUsage(tempDir)
    expect(result.totalSessions).toBe(0)
    expect(result.lastSessionAt).toBeNull()
  })

  it('ignores non-jsonl files', () => {
    const sessionDir = join(tempDir, '2026', '08')
    mkdirSync(sessionDir, { recursive: true })
    writeFileSync(join(sessionDir, 'notes.txt'), 'some notes')
    writeFileSync(
      join(sessionDir, 'session.jsonl'),
      '{"timestamp":"2026-08-26T10:00:00Z","type":"session_meta","payload":{}}\n'
    )

    const result = readCodexSessionUsage(tempDir)
    expect(result.totalSessions).toBe(1)
  })
})
