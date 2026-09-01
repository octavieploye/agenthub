import { describe, it, expect } from 'vitest'
import { buildCodexCommand } from './codex-command-builder'

describe('buildCodexCommand', () => {
  it('constructs interactive command without task', () => {
    const cmd = buildCodexCommand({})
    expect(cmd).toBe('clear; codex\n')
  })

  it('constructs command with task', () => {
    const cmd = buildCodexCommand({ task: 'Fix the login bug' })
    expect(cmd).toContain('codex')
    expect(cmd).toContain('Fix the login bug')
    expect(cmd).toMatch(/^clear; codex -- '.*'\n$/)
  })

  it('adds --dangerously-bypass-approvals-and-sandbox when skipPermissions is true', () => {
    const cmd = buildCodexCommand({ skipPermissions: true })
    expect(cmd).toContain('--dangerously-bypass-approvals-and-sandbox')
  })

  it('does not add --dangerously-bypass-approvals-and-sandbox when skipPermissions is false', () => {
    const cmd = buildCodexCommand({ skipPermissions: false })
    expect(cmd).not.toContain('--dangerously-bypass-approvals-and-sandbox')
  })

  it('does not add --dangerously-bypass-approvals-and-sandbox by default', () => {
    const cmd = buildCodexCommand({ task: 'Do something' })
    expect(cmd).not.toContain('--dangerously-bypass-approvals-and-sandbox')
  })

  it('does NOT include --plugin-dir (Claude-specific)', () => {
    const cmd = buildCodexCommand({ task: 'Test', skipPermissions: true })
    expect(cmd).not.toContain('--plugin-dir')
  })

  it('does NOT include --model flag', () => {
    const cmd = buildCodexCommand({ task: 'Test' })
    expect(cmd).not.toContain('--model')
  })

  it('does NOT include --append-system-prompt-file', () => {
    const cmd = buildCodexCommand({ task: 'Test' })
    expect(cmd).not.toContain('--append-system-prompt-file')
  })

  it('escapes single quotes in task', () => {
    const cmd = buildCodexCommand({ task: "Fix the user's profile" })
    expect(cmd).not.toContain("user's")
    expect(cmd).toContain("user'\\''s")
  })

  it('combines --dangerously-bypass-approvals-and-sandbox with task', () => {
    const cmd = buildCodexCommand({ task: 'Fix bug', skipPermissions: true })
    expect(cmd).toContain('--dangerously-bypass-approvals-and-sandbox')
    expect(cmd).toContain('Fix bug')
  })

  it('adds Telegram suffix when telegramNotify is true', () => {
    const cmd = buildCodexCommand({ task: 'Fix bug', telegramNotify: true })
    expect(cmd).toContain('Telegram is ON')
  })

  it('does not add Telegram suffix when telegramNotify is false', () => {
    const cmd = buildCodexCommand({ task: 'Fix bug', telegramNotify: false })
    expect(cmd).not.toContain('Telegram is ON')
  })
})
