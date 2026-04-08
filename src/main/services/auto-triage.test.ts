import { describe, it, expect } from 'vitest'
import { triageAgentEvent, TRIAGE_LEVEL_ORDER } from './auto-triage'
import type { TriageInput, TriageEvent, TriageLevel } from '@shared/types/triage.types'
import type { AgentLifecycleStatus } from '@shared/types/agent.types'

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<TriageInput> = {}): TriageInput {
  return {
    agentId: 'agent-001',
    agentName: 'TestAgent',
    repoName: 'test-repo',
    taskDescription: 'Fix the login bug',
    previousStatus: 'idle',
    currentStatus: 'busy',
    ...overrides
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Auto-Triage Engine', () => {
  // ─── Triage Level Assignment ────────────────────────────────────────────

  describe('triageAgentEvent triage level assignment', () => {
    it('assigns critical for looping status', () => {
      const input = makeInput({ currentStatus: 'looping' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.triageLevel).toBe('critical')
    })

    it('assigns critical for paused status (guardrail)', () => {
      const input = makeInput({ currentStatus: 'paused' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.triageLevel).toBe('critical')
    })

    it('assigns high for locked status', () => {
      const input = makeInput({ currentStatus: 'locked' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.triageLevel).toBe('high')
    })

    it('assigns high for interrupted status', () => {
      const input = makeInput({ currentStatus: 'interrupted' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.triageLevel).toBe('high')
    })

    it('assigns medium for completed status', () => {
      const input = makeInput({ currentStatus: 'completed' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.triageLevel).toBe('medium')
    })

    it('assigns low for spawning status', () => {
      const input = makeInput({ currentStatus: 'spawning' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.triageLevel).toBe('low')
    })

    it('assigns low for busy status', () => {
      const input = makeInput({ currentStatus: 'busy' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.triageLevel).toBe('low')
    })

    it('assigns low for idle status', () => {
      const input = makeInput({ currentStatus: 'idle' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.triageLevel).toBe('low')
    })

    it('assigns low for tray_running status', () => {
      const input = makeInput({ currentStatus: 'tray_running' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.triageLevel).toBe('low')
    })
  })

  // ─── Reason Strings ────────────────────────────────────────────────────

  describe('triageAgentEvent reason strings', () => {
    it('returns "Agent stuck in loop" for looping', () => {
      const input = makeInput({ currentStatus: 'looping' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.reason).toBe('Agent stuck in loop')
    })

    it('returns "Agent paused by guardrail" for paused', () => {
      const input = makeInput({ currentStatus: 'paused' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.reason).toBe('Agent paused by guardrail')
    })

    it('returns "Agent needs user input" for locked', () => {
      const input = makeInput({ currentStatus: 'locked' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.reason).toBe('Agent needs user input')
    })

    it('returns "Agent interrupted" for interrupted', () => {
      const input = makeInput({ currentStatus: 'interrupted' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.reason).toBe('Agent interrupted')
    })

    it('returns "Agent completed task" for completed', () => {
      const input = makeInput({ currentStatus: 'completed' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.reason).toBe('Agent completed task')
    })

    it('returns "Agent spawning" for spawning', () => {
      const input = makeInput({ currentStatus: 'spawning' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.reason).toBe('Agent spawning')
    })

    it('returns "Agent working" for busy', () => {
      const input = makeInput({ currentStatus: 'busy' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.reason).toBe('Agent working')
    })

    it('returns "Agent idle" for idle', () => {
      const input = makeInput({ currentStatus: 'idle' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.reason).toBe('Agent idle')
    })

    it('returns "Agent running in tray" for tray_running', () => {
      const input = makeInput({ currentStatus: 'tray_running' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.reason).toBe('Agent running in tray')
    })
  })

  // ─── TriageEvent Output Structure ───────────────────────────────────────

  describe('TriageEvent output structure', () => {
    it('includes all input fields in the output event', () => {
      const input = makeInput({
        agentId: 'agent-xyz',
        agentName: 'BuildBot',
        repoName: 'my-repo',
        taskDescription: 'Deploy staging',
        previousStatus: 'busy',
        currentStatus: 'completed'
      })
      const result: TriageEvent = triageAgentEvent(input)

      expect(result.agentId).toBe('agent-xyz')
      expect(result.agentName).toBe('BuildBot')
      expect(result.repoName).toBe('my-repo')
      expect(result.taskDescription).toBe('Deploy staging')
      expect(result.previousStatus).toBe('busy')
      expect(result.currentStatus).toBe('completed')
    })

    it('includes a timestamp', () => {
      const input = makeInput({ currentStatus: 'idle' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.timestamp).toBeDefined()
    })

    it('timestamp is a positive number', () => {
      const input = makeInput({ currentStatus: 'idle' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(typeof result.timestamp).toBe('number')
      expect(result.timestamp).toBeGreaterThan(0)
    })

    it('includes triageLevel in the output', () => {
      const input = makeInput({ currentStatus: 'locked' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.triageLevel).toBeDefined()
      expect(['low', 'medium', 'high', 'critical']).toContain(result.triageLevel)
    })

    it('includes reason in the output', () => {
      const input = makeInput({ currentStatus: 'locked' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.reason).toBeDefined()
      expect(typeof result.reason).toBe('string')
      expect(result.reason.length).toBeGreaterThan(0)
    })
  })

  // ─── requiresSoundAlert Flag ───────────────────────────────────────────

  describe('requiresSoundAlert flag', () => {
    it('is true for awaiting_approval', () => {
      const input = makeInput({ currentStatus: 'awaiting_approval' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.requiresSoundAlert).toBe(true)
    })

    it('is false for locked (toast/desktop only, no sound)', () => {
      const input = makeInput({ currentStatus: 'locked' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.requiresSoundAlert).toBe(false)
    })

    it('is false for busy', () => {
      const input = makeInput({ currentStatus: 'busy' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.requiresSoundAlert).toBe(false)
    })

    it('is false for completed', () => {
      const input = makeInput({ currentStatus: 'completed' })
      const result: TriageEvent = triageAgentEvent(input)
      expect(result.requiresSoundAlert).toBe(false)
    })
  })

  // ─── Triage Level Ordering ─────────────────────────────────────────────

  describe('triage level ordering', () => {
    it('critical > high > medium > low ordering is consistent', () => {
      const order: Record<TriageLevel, number> = TRIAGE_LEVEL_ORDER
      expect(order.critical).toBeGreaterThan(order.high)
      expect(order.high).toBeGreaterThan(order.medium)
      expect(order.medium).toBeGreaterThan(order.low)
    })

    it('TRIAGE_LEVEL_ORDER contains exactly 4 levels', () => {
      const keys = Object.keys(TRIAGE_LEVEL_ORDER)
      expect(keys).toHaveLength(4)
      expect(keys).toContain('low')
      expect(keys).toContain('medium')
      expect(keys).toContain('high')
      expect(keys).toContain('critical')
    })
  })

  // ─── All AgentLifecycleStatus Values Handled ────────────────────────────

  describe('all AgentLifecycleStatus values are handled', () => {
    const allStatuses: AgentLifecycleStatus[] = [
      'spawning',
      'busy',
      'idle',
      'locked',
      'completed',
      'looping',
      'paused',
      'interrupted',
      'tray_running'
    ]

    it('every AgentLifecycleStatus value produces a valid TriageLevel', () => {
      const validLevels: TriageLevel[] = ['low', 'medium', 'high', 'critical']

      for (const status of allStatuses) {
        const input = makeInput({ currentStatus: status })
        const result: TriageEvent = triageAgentEvent(input)
        expect(
          validLevels.includes(result.triageLevel),
          `Status "${status}" produced invalid triage level: "${result.triageLevel}"`
        ).toBe(true)
      }
    })

    it('every AgentLifecycleStatus value produces a non-empty reason', () => {
      for (const status of allStatuses) {
        const input = makeInput({ currentStatus: status })
        const result: TriageEvent = triageAgentEvent(input)
        expect(
          result.reason.length > 0,
          `Status "${status}" produced empty reason`
        ).toBe(true)
      }
    })
  })
})
