import { EventEmitter } from 'events'
import type { TriageEvent } from '../../shared/types/triage.types'

export type OrchestratorEventType =
  | 'agent:completed'
  | 'agent:failed'
  | 'agent:status-changed'

export interface OrchestratorAgentEvent {
  type: OrchestratorEventType
  triageEvent: TriageEvent
}

class OrchestratorBus extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(20)
  }
}

const orchestratorBus = new OrchestratorBus()

export function emitOrchestratorEvent(event: OrchestratorAgentEvent): void {
  orchestratorBus.emit(event.type, event)
}

export function onOrchestratorEvent(
  type: OrchestratorEventType,
  handler: (event: OrchestratorAgentEvent) => void
): void {
  orchestratorBus.on(type, handler)
}

export function offOrchestratorEvent(
  type: OrchestratorEventType,
  handler: (event: OrchestratorAgentEvent) => void
): void {
  orchestratorBus.off(type, handler)
}

export function getOrchestratorBus(): OrchestratorBus {
  return orchestratorBus
}
