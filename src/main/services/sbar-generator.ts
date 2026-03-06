import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type { AgentState } from '../../shared/types/agent.types'
import type { SBARHandoff, CreateSBARInput } from '../../shared/types/recovery.types'
import { insertSBAR } from '../db/queries/sbar.queries'

export interface AgentContext {
  agent: AgentState
  filesModified?: string[]
  errorsEncountered?: string[]
  lastOutputLines?: string[]
  elapsedMinutes?: number
}

export function generateSBAR(context: AgentContext): CreateSBARInput {
  const { agent, filesModified, errorsEncountered, lastOutputLines, elapsedMinutes } = context

  const situation = buildSituation(agent)
  const background = buildBackground(agent, filesModified, elapsedMinutes)
  const assessment = buildAssessment(agent, errorsEncountered, lastOutputLines)
  const recommendation = buildRecommendation(agent, errorsEncountered)

  return {
    agentId: agent.id,
    agentName: agent.name,
    repoId: agent.repoId,
    situation,
    background,
    assessment,
    recommendation
  }
}

export function createAndStoreSBAR(
  db: Database.Database,
  context: AgentContext
): SBARHandoff {
  const input = generateSBAR(context)
  const sbar = insertSBAR(db, input)
  log.info('SBAR handoff generated and stored', { agentId: context.agent.id, sbarId: sbar.id })
  return sbar
}

function buildSituation(agent: AgentState): string {
  const statusDescription = getStatusDescription(agent.status)
  return `Agent "${agent.name}" was ${statusDescription} while working on: ${agent.taskDescription || 'unspecified task'}`
}

function buildBackground(
  agent: AgentState,
  filesModified?: string[],
  elapsedMinutes?: number
): string {
  const parts: string[] = []
  parts.push(`Repository: ${agent.repoId}`)
  parts.push(`Working directory: ${agent.cwd}`)
  parts.push(`Model: ${agent.model} (${agent.provider})`)
  parts.push(`Progress: ${agent.progress}%`)

  if (elapsedMinutes !== undefined) {
    parts.push(`Elapsed time: ${elapsedMinutes} minutes`)
  }

  if (filesModified && filesModified.length > 0) {
    parts.push(`Files modified (${filesModified.length}): ${filesModified.join(', ')}`)
  }

  return parts.join('. ')
}

function buildAssessment(
  agent: AgentState,
  errorsEncountered?: string[],
  lastOutputLines?: string[]
): string {
  const parts: string[] = []
  parts.push(`Last known status: ${agent.status} (${agent.confidence} confidence)`)

  if (errorsEncountered && errorsEncountered.length > 0) {
    parts.push(`Errors encountered (${errorsEncountered.length}): ${errorsEncountered.slice(-3).join('; ')}`)
  }

  if (lastOutputLines && lastOutputLines.length > 0) {
    const summary = lastOutputLines.slice(-3).join(' | ')
    parts.push(`Last output: ${summary}`)
  }

  return parts.join('. ')
}

function buildRecommendation(
  agent: AgentState,
  errorsEncountered?: string[]
): string {
  if (agent.status === 'completed') {
    return 'Task completed successfully. Review output and run tests if applicable.'
  }

  if (agent.status === 'looping') {
    return 'Agent was looping. Restart with a more specific prompt or break the task into smaller steps.'
  }

  if (errorsEncountered && errorsEncountered.length > 2) {
    return 'Multiple errors encountered. Review error logs before resuming. Consider a different approach or model.'
  }

  if (agent.status === 'locked') {
    return 'Agent was waiting for user input. Resume and provide the requested information.'
  }

  if (agent.progress > 70) {
    return `Task was ${agent.progress}% complete. Resume to finish the remaining work.`
  }

  return `Resume agent with the same task to continue from where it stopped.`
}

function getStatusDescription(status: AgentState['status']): string {
  const descriptions: Record<string, string> = {
    spawning: 'starting up',
    busy: 'actively working',
    idle: 'idle between actions',
    locked: 'waiting for user input',
    completed: 'finished',
    looping: 'stuck in a loop',
    paused: 'paused',
    interrupted: 'interrupted',
    tray_running: 'running in background'
  }
  return descriptions[status] ?? 'in an unknown state'
}
