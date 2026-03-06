import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type { AgentState } from '../../shared/types/agent.types'
import type { RecoveryInfo, SBARHandoff } from '../../shared/types/recovery.types'
import { getLatestSnapshot } from '../db/queries/snapshots.queries'
import { getSBARByAgentId } from '../db/queries/sbar.queries'
import { getAllAgents, updateAgentStatus } from '../db/queries/agents.queries'

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function buildRecoveryInfo(db: Database.Database): RecoveryInfo {
  const lastSnapshot = getLatestSnapshot(db)
  const allAgents = getAllAgents(db)

  const activeStatuses = ['spawning', 'busy', 'idle', 'locked', 'looping', 'paused', 'tray_running']
  const previouslyActiveAgents = allAgents.filter((a) =>
    activeStatuses.includes(a.status)
  )

  if (previouslyActiveAgents.length === 0) {
    log.info('No agents to recover')
    return {
      hadInterruption: false,
      lastSnapshot,
      recoveredAgents: [],
      interruptedAgents: []
    }
  }

  const recoveredAgents: AgentState[] = []
  const interruptedAgents: Array<AgentState & { handoff?: SBARHandoff }> = []

  for (const agent of previouslyActiveAgents) {
    if (agent.pid && isProcessAlive(agent.pid)) {
      recoveredAgents.push(agent)
      log.info('Agent process still alive', { id: agent.id, pid: agent.pid })
    } else {
      updateAgentStatus(db, agent.id, 'interrupted', 'confirmed')
      const handoff = getSBARByAgentId(db, agent.id)
      interruptedAgents.push({
        ...agent,
        status: 'interrupted',
        confidence: 'confirmed',
        handoff: handoff || undefined
      })
      log.info('Agent process not found', { id: agent.id, pid: agent.pid })
    }
  }

  const hadInterruption = interruptedAgents.length > 0 || recoveredAgents.length > 0

  log.info('Recovery info built', {
    recovered: recoveredAgents.length,
    interrupted: interruptedAgents.length,
    hadInterruption
  })

  return {
    hadInterruption,
    lastSnapshot,
    recoveredAgents,
    interruptedAgents
  }
}

export function acknowledgeRecovery(_db: Database.Database): void {
  log.info('Recovery acknowledged by user')
}
