import { describe, it, expect } from 'vitest'
import { ClaudeCliOutputParser, createParser } from '../parsers/cli-output-parser'
import { CodexCliOutputParser } from '../parsers/codex-output-parser'

describe('rate-limit cascade — parser layer', () => {
  it('Claude parser detects rate_limited with confirmed confidence', () => {
    const parser = new ClaudeCliOutputParser()
    const result = parser.parse("You've hit your limit · resets 7:40pm (Europe/Paris)")
    expect(result).toEqual({ status: 'rate_limited', confidence: 'confirmed' })
  })

  it('Codex parser detects rate_limited with confirmed confidence', () => {
    const parser = new CodexCliOutputParser()
    const result = parser.parse('Usage limit exceeded. Pro plan limit reached.')
    expect(result).toEqual({ status: 'rate_limited', confidence: 'confirmed' })
  })

  it('rate_limited takes priority over busy indicators', () => {
    const parser = new ClaudeCliOutputParser()
    const result = parser.parse('⠋ rate limit exceeded, please slow down')
    expect(result?.status).toBe('rate_limited')
  })

  it('rate_limited does not trigger on normal error text', () => {
    const parser = new ClaudeCliOutputParser()
    const result = parser.parse('Error: connection refused')
    expect(result).toBeNull()
  })

  it('createParser returns correct parser type per provider', () => {
    const claude = createParser('anthropic')
    expect(claude.getParserName()).toBe('claude-cli-v1')
    const codex = createParser('openai-codex')
    expect(codex.getParserName()).toBe('codex-cli-v1')
  })

  it('both parsers detect "too many requests" identically', () => {
    const claude = new ClaudeCliOutputParser()
    const codex = new CodexCliOutputParser()
    const claudeResult = claude.parse('Error: too many requests')
    const codexResult = codex.parse('Error: too many requests')
    expect(claudeResult?.status).toBe('rate_limited')
    expect(codexResult?.status).toBe('rate_limited')
  })
})
