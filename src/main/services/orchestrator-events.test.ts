import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  emitOrchestratorEvent,
  onOrchestratorEvent,
  offOrchestratorEvent,
  getOrchestratorBus,
  type OrchestratorAgentEvent
} from './orchestrator-events'
import type { TriageEvent } from '../../shared/types/triage.types'

const makeTriage = (overrides: Partial<TriageEvent> = {}): TriageEvent => ({
  agentId: 'agent-1',
  agentName: 'test-agent',
  repoName: 'test-repo',
  taskDescription: 'fix bug',
  previousStatus: 'busy',
  currentStatus: 'completed',
  triageLevel: 'medium',
  timestamp: Date.now(),
  reason: 'Agent completed task',
  requiresUserAction: false,
  requiresSoundAlert: false,
  isTaskCompleted: true,
  ...overrides
})

afterEach(() => {
  getOrchestratorBus().removeAllListeners()
})

describe('orchestrator-events', () => {
  it('emitOrchestratorEvent fires handler registered with onOrchestratorEvent', () => {
    const handler = vi.fn()
    onOrchestratorEvent('agent:completed', handler)

    const event: OrchestratorAgentEvent = {
      type: 'agent:completed',
      triageEvent: makeTriage()
    }
    emitOrchestratorEvent(event)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('offOrchestratorEvent removes handler', () => {
    const handler = vi.fn()
    onOrchestratorEvent('agent:failed', handler)
    offOrchestratorEvent('agent:failed', handler)

    emitOrchestratorEvent({
      type: 'agent:failed',
      triageEvent: makeTriage({ currentStatus: 'error' })
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('different event types are independent', () => {
    const completedHandler = vi.fn()
    const failedHandler = vi.fn()
    onOrchestratorEvent('agent:completed', completedHandler)
    onOrchestratorEvent('agent:failed', failedHandler)

    emitOrchestratorEvent({
      type: 'agent:completed',
      triageEvent: makeTriage()
    })

    expect(completedHandler).toHaveBeenCalledOnce()
    expect(failedHandler).not.toHaveBeenCalled()
  })

  it('getOrchestratorBus returns singleton', () => {
    const bus1 = getOrchestratorBus()
    const bus2 = getOrchestratorBus()
    expect(bus1).toBe(bus2)
  })

  it('status-changed event fires correctly', () => {
    const handler = vi.fn()
    onOrchestratorEvent('agent:status-changed', handler)

    emitOrchestratorEvent({
      type: 'agent:status-changed',
      triageEvent: makeTriage({ previousStatus: 'busy', currentStatus: 'locked' })
    })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler.mock.calls[0][0].triageEvent.currentStatus).toBe('locked')
  })
})
