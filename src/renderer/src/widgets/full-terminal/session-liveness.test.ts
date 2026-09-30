import { describe, it, expect, beforeEach } from 'vitest'
import {
  markSessionEnded,
  clearSessionEnded,
  isSessionEnded,
  resetSessionLiveness
} from './session-liveness'

describe('session-liveness', () => {
  beforeEach(() => {
    resetSessionLiveness()
  })

  it('reports a never-seen agent as live', () => {
    expect(isSessionEnded('agent-1')).toBe(false)
  })

  it('reports an agent as ended after its PTY exits', () => {
    markSessionEnded('agent-1')
    expect(isSessionEnded('agent-1')).toBe(true)
  })

  it('scopes ended state to the agent that exited', () => {
    markSessionEnded('agent-1')
    expect(isSessionEnded('agent-2')).toBe(false)
  })

  it('reports an agent as live again after respawn clears it', () => {
    markSessionEnded('agent-1')
    clearSessionEnded('agent-1')
    expect(isSessionEnded('agent-1')).toBe(false)
  })

  it('is idempotent — marking twice keeps the agent ended', () => {
    markSessionEnded('agent-1')
    markSessionEnded('agent-1')
    expect(isSessionEnded('agent-1')).toBe(true)
  })

  it('tolerates clearing an agent that was never marked', () => {
    expect(() => clearSessionEnded('never-seen')).not.toThrow()
    expect(isSessionEnded('never-seen')).toBe(false)
  })
})
