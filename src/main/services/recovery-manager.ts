import * as fs from 'fs'
import * as path from 'path'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type { AgentState } from '../../shared/types/agent.types'
import type { RecoveryInfo, SBARHandoff } from '../../shared/types/recovery.types'
import { getLatestSnapshot } from '../db/queries/snapshots.queries'
import { getSBARByAgentId } from '../db/queries/sbar.queries'
import { getAllAgents, updateAgentStatus } from '../db/queries/agents.queries'
import { SOCKET_DIR } from './pty-proxy'

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function buildRecoveryInfo(db: Database.Database): RecoveryInfo {
  // Clean up stale socket files from previous crashes before recovery
  cleanupStaleSockets(db)

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

/**
 * Remove stale Unix socket files from previous crashes.
 * Cross-references socket filenames with agent PIDs in the DB.
 */
export function cleanupStaleSockets(db: Database.Database): void {
  try {
    if (!fs.existsSync(SOCKET_DIR)) return

    const files = fs.readdirSync(SOCKET_DIR)
    const socketFiles = files.filter((f) => f.startsWith('pty-') && f.endsWith('.sock'))

    if (socketFiles.length === 0) return

    const allAgents = getAllAgents(db)
    // Build a map of short ID (first 8 chars) → agent for cross-referencing
    const agentByShortId = new Map<string, AgentState>()
    for (const agent of allAgents) {
      agentByShortId.set(agent.id.slice(0, 8), agent)
    }

    let cleaned = 0
    for (const file of socketFiles) {
      // Extract short ID from pty-{shortId}.sock
      const match = file.match(/^pty-(.+)\.sock$/)
      if (!match) continue

      const shortId = match[1]
      const agent = agentByShortId.get(shortId)
      const socketPath = path.join(SOCKET_DIR, file)

      // Delete if: agent doesn't exist in DB, or its PID is dead
      if (!agent || !agent.pid || !isProcessAlive(agent.pid)) {
        try {
          fs.unlinkSync(socketPath)
          cleaned++
          log.info('Removed stale socket', { file, reason: agent ? 'dead PID' : 'unknown agent' })
        } catch (err) {
          log.warn('Failed to remove stale socket', { file, error: (err as Error).message })
        }
      }
    }

    if (cleaned > 0) {
      log.info('Stale socket cleanup complete', { cleaned, total: socketFiles.length })
    }
  } catch (err) {
    log.warn('Stale socket cleanup failed', { error: (err as Error).message })
  }
}

export function acknowledgeRecovery(_db: Database.Database): void {
  log.info('Recovery acknowledged by user')
}
