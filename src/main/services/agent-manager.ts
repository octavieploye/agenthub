import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import log from 'electron-log/main'
import type { AgentState, AgentSpawnOptions, AgentLifecycleStatus } from '../../shared/types/agent.types'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'
import { getDb } from '../db/connection'
import { insertAgent, updateAgentStatus, updateAgentPid, getAgentById, getAllAgents } from '../db/queries/agents.queries'
import { getRepoById, getRepoByPath, insertRepo } from '../db/queries/repos.queries'
import { createParser, type ClaudeCliOutputParser } from '../parsers/cli-output-parser'

interface ManagedAgent {
  state: AgentState
  ptyProcess: pty.IPty
  parser: ClaudeCliOutputParser
}

const agents = new Map<string, ManagedAgent>()

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows[0] ?? null
}

function emitToRenderer(channel: string, ...args: unknown[]): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args)
  }
}

export function spawnAgent(options: AgentSpawnOptions): AgentState {
  const db = getDb()

  // Ensure repo exists — auto-create from cwd if repoId is missing or invalid
  let repoId = options.repoId
  const existingRepo = getRepoById(db, repoId)
  if (!existingRepo) {
    // Check if a repo already exists for this path
    const byPath = getRepoByPath(db, options.cwd)
    if (byPath) {
      repoId = byPath.id
    } else {
      const repoName = options.cwd.split('/').pop() ?? 'project'
      log.info('Auto-creating repo for spawn', { repoId, cwd: options.cwd, repoName })
      const newRepo = insertRepo(db, { name: repoName, path: options.cwd })
      repoId = newRepo.id
    }
  }

  const agentState = insertAgent(db, {
    repoId,
    name: options.name,
    cwd: options.cwd,
    model: options.model,
    provider: options.provider,
    taskDescription: options.taskDescription
  })

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...(options.envOverrides ?? {})
  }
  // Remove CLAUDECODE env var so spawned claude CLI doesn't think it's nested
  delete env.CLAUDECODE

  const shell = process.platform === 'win32' ? 'powershell.exe' : 'zsh'
  const args = process.platform === 'win32' ? [] : ['-l']

  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: options.cwd,
    env
  })

  updateAgentPid(db, agentState.id, ptyProcess.pid, null)
  agentState.pid = ptyProcess.pid

  const parser = createParser() as ClaudeCliOutputParser

  ptyProcess.onData((data: string) => {
    emitToRenderer(IPC_EVENTS.AGENTS.OUTPUT, agentState.id, data)

    const parsed = parser.parse(data)
    if (parsed) {
      const managed = agents.get(agentState.id)
      if (managed && managed.state.status !== parsed.status) {
        const newStatus = parsed.status as AgentLifecycleStatus
        managed.state.status = newStatus
        managed.state.confidence = parsed.confidence
        updateAgentStatus(db, agentState.id, newStatus, parsed.confidence)
        emitToRenderer(IPC_EVENTS.AGENTS.STATUS_CHANGE, agentState.id, newStatus, parsed.confidence)
        log.debug('Agent status changed via parser', { id: agentState.id, status: newStatus, confidence: parsed.confidence })
      }
    }
  })

  ptyProcess.onExit(({ exitCode }) => {
    log.info('Agent exited', { id: agentState.id, exitCode })
    updateAgentStatus(db, agentState.id, 'completed', 'confirmed')
    emitToRenderer(IPC_EVENTS.AGENTS.EXIT, agentState.id, exitCode)
    emitToRenderer(IPC_EVENTS.AGENTS.STATUS_CHANGE, agentState.id, 'completed', 'confirmed')
    agents.delete(agentState.id)
  })

  updateAgentStatus(db, agentState.id, 'busy', 'inferred')
  agentState.status = 'busy'
  agentState.confidence = 'inferred'

  agents.set(agentState.id, { state: agentState, ptyProcess, parser })
  emitToRenderer(IPC_EVENTS.AGENTS.STATUS_CHANGE, agentState.id, 'busy', 'inferred')

  // Auto-launch claude CLI with the task after shell initializes
  const task = options.taskDescription?.trim()
  if (task) {
    setTimeout(() => {
      const cmd = `claude "${task.replace(/"/g, '\\"')}"\n`
      ptyProcess.write(cmd)
      log.info('Sent claude command to PTY', { id: agentState.id, task })
    }, 500)
  } else {
    // Just launch claude in interactive mode
    setTimeout(() => {
      ptyProcess.write('claude\n')
      log.info('Sent claude (interactive) to PTY', { id: agentState.id })
    }, 500)
  }

  log.info('Agent spawned', { id: agentState.id, pid: ptyProcess.pid, cwd: options.cwd })
  return agentState
}

export function sendInput(agentId: string, data: string): void {
  const managed = agents.get(agentId)
  if (!managed) throw new Error(`Agent ${agentId} not found`)
  managed.ptyProcess.write(data)
}

export function resizeAgent(agentId: string, cols: number, rows: number): void {
  const managed = agents.get(agentId)
  if (!managed) throw new Error(`Agent ${agentId} not found`)
  managed.ptyProcess.resize(cols, rows)
}

export function killAgent(agentId: string): void {
  const managed = agents.get(agentId)
  if (!managed) throw new Error(`Agent ${agentId} not found`)

  log.info('Killing agent', { id: agentId })
  managed.ptyProcess.kill()

  const db = getDb()
  updateAgentStatus(db, agentId, 'interrupted', 'confirmed')
  emitToRenderer(IPC_EVENTS.AGENTS.STATUS_CHANGE, agentId, 'interrupted', 'confirmed')
  agents.delete(agentId)
}

export function pauseAgent(agentId: string): void {
  const managed = agents.get(agentId)
  if (!managed) throw new Error(`Agent ${agentId} not found`)

  log.info('Pausing agent', { id: agentId })
  process.kill(managed.ptyProcess.pid, 'SIGTSTP')

  const db = getDb()
  updateAgentStatus(db, agentId, 'paused', 'confirmed')
  managed.state.status = 'paused'
  emitToRenderer(IPC_EVENTS.AGENTS.STATUS_CHANGE, agentId, 'paused', 'confirmed')
}

export function resumeAgent(agentId: string): void {
  const managed = agents.get(agentId)
  if (!managed) throw new Error(`Agent ${agentId} not found`)

  log.info('Resuming agent', { id: agentId })
  process.kill(managed.ptyProcess.pid, 'SIGCONT')

  const db = getDb()
  updateAgentStatus(db, agentId, 'busy', 'inferred')
  managed.state.status = 'busy'
  emitToRenderer(IPC_EVENTS.AGENTS.STATUS_CHANGE, agentId, 'busy', 'inferred')
}

export function getAgentState(agentId: string): AgentState | null {
  const managed = agents.get(agentId)
  if (managed) return managed.state
  return getAgentById(getDb(), agentId)
}

export function listAgents(): AgentState[] {
  return getAllAgents(getDb())
}

export function cleanupAllAgents(): void {
  for (const [id, managed] of agents) {
    try {
      managed.ptyProcess.kill()
    } catch {
      log.warn('Failed to kill agent during cleanup', { id })
    }
  }
  agents.clear()
  log.info('All agents cleaned up')
}
