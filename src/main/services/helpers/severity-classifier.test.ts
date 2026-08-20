import { describe, it, expect } from 'vitest'
import { classifyIssueSeverity } from './severity-classifier'

describe('classifyIssueSeverity', () => {
  it('classifies SQL injection as critical', () => {
    expect(classifyIssueSeverity('Possible SQL injection in query builder', 'security')).toBe('critical')
  })

  it('classifies XSS as critical', () => {
    expect(classifyIssueSeverity('Reflected XSS in search input', 'security')).toBe('critical')
  })

  it('classifies sovereignty violation as critical', () => {
    expect(classifyIssueSeverity('Data routed through US cloud — sovereignty violation', 'compliance')).toBe('critical')
  })

  it('classifies breaking change as high', () => {
    expect(classifyIssueSeverity('Breaking change in API v2 response shape', 'api')).toBe('high')
  })

  it('classifies auth bypass as high', () => {
    expect(classifyIssueSeverity('Auth bypass via expired token reuse', 'security')).toBe('high')
  })

  it('classifies race condition as high', () => {
    expect(classifyIssueSeverity('Race condition in concurrent agent dispatch', 'concurrency')).toBe('high')
  })

  it('classifies missing test as medium', () => {
    expect(classifyIssueSeverity('Missing test for error handler branch', 'testing')).toBe('medium')
  })

  it('classifies tech debt as medium', () => {
    expect(classifyIssueSeverity('Accumulated tech debt in legacy parser', 'maintenance')).toBe('medium')
  })

  it('classifies naming issue as low', () => {
    expect(classifyIssueSeverity('Variable naming inconsistent with conventions', 'style')).toBe('low')
  })

  it('classifies code style as low', () => {
    expect(classifyIssueSeverity('Code style violation in handler module', 'lint')).toBe('low')
  })

  it('defaults to medium for unrecognized patterns', () => {
    expect(classifyIssueSeverity('Something completely unrelated', 'unknown')).toBe('medium')
  })

  it('matches case-insensitively', () => {
    expect(classifyIssueSeverity('VULNERABILITY found in parser', 'security')).toBe('critical')
    expect(classifyIssueSeverity('Possible CSRF attack vector', 'security')).toBe('critical')
    expect(classifyIssueSeverity('BREAKING CHANGE in schema', 'api')).toBe('high')
    expect(classifyIssueSeverity('TECH DEBT cleanup needed', 'maintenance')).toBe('medium')
    expect(classifyIssueSeverity('CODE STYLE issue', 'lint')).toBe('low')
  })

  it('matches on category field as well', () => {
    expect(classifyIssueSeverity('Found a problem', 'data loss')).toBe('critical')
    expect(classifyIssueSeverity('Detected issue', 'race condition')).toBe('high')
    expect(classifyIssueSeverity('Needs attention', 'refactor')).toBe('medium')
    expect(classifyIssueSeverity('Minor issue', 'documentation')).toBe('low')
  })
})
