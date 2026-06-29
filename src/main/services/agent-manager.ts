import * as pty from 'node-pty'
import { emitToAllRenderers } from '../utils/emit-to-all-renderers'
import log from 'electron-log/main'
import type { AgentState, AgentSpawnOptions, AgentLifecycleStatus } from '../../shared/types/agent.types'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'
import { getDb, isDbShuttingDown } from '../db/connection'
import { insertAgent, updateAgentStatus, updateAgentPid, updateAgentColor as dbUpdateAgentColor, updateAgentModel as dbUpdateAgentModel, updateAgentTaskDescription as dbUpdateAgentTaskDescription, updateAgentName as dbUpdateAgentName, updateAgentVoiceMode as dbUpdateAgentVoiceMode, getAgentById, getAllAgents } from '../db/queries/agents.queries'
import { getRepoById, getRepoByPath, insertRepo, updateRepoLastUsed } from '../db/queries/repos.queries'
import type { EffortLevel } from '../../shared/types/agent.types'
import { createParser, type ClaudeCliOutputParser } from '../parsers/cli-output-parser'
import { insertTerminalOutput } from '../db/queries/history.queries'
import { PtyProxy } from './pty-proxy'
import { executeKillHierarchy } from './kill-hierarchy'
import { getWindowManager, getAnamnesisWriter, getTelegramSocketPath } from './service-orchestrator'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { app } from 'electron'
import { buildSpawnEnv } from './model-dispatcher'
import { triageAgentEvent } from './auto-triage'
import { insertActivityEvent } from '../db/queries/activity.queries'
import { getSBARByAgentId } from '../db/queries/sbar.queries'
import { createAndStoreSBAR, type AgentContext } from './sbar-generator'
import { routeNotification } from './notification-router'
import type { NotificationRouterConfig } from '../../shared/types/notification.types'
import type { TriageInput } from '../../shared/types/triage.types'
import { stripAnsi } from '../utils/strip-ansi'
import { filterTtsResponse } from '../utils/tts-response-filter'
import { HeadlessTerminalBuffer } from '../utils/headless-terminal-buffer'
import { shouldResetTtsBuffer } from '../utils/tts-buffer-reset'
import { TtsTrigger } from '../utils/tts-trigger'
import { getTaskByAgentId, updateTask, linkSBARToTask } from '../db/queries/tasks.queries'
import { insertTaskEvent } from '../db/queries/task-events.queries'
import type { TaskStatus, TaskEventType } from '../../shared/types/task.types'
import { getProjectById } from '../db/queries/projects.queries'
import { writeWorkspaceMemory } from './workspace-memory-writer'
import type { TelegramNotificationPayload } from '../../shared/types/telegram.types'
import { getTelegramPrefs } from '../db/queries/telegram.queries'

const AGENT_TO_TASK_STATUS: Partial<Record<string, TaskStatus>> = {
  busy: 'in_progress',
  completed: 'completed',
  interrupted: 'interrupted'
}
const AGENT_TO_EVENT_TYPE: Partial<Record<string, TaskEventType>> = {
  busy: 'CARD_TRANSITION',
  completed: 'CARD_COMPLETED',
  interrupted: 'CARD_INTERRUPTED'
}

interface ManagedAgent {
  state: AgentState
  ptyProcess: pty.IPty
  parser: ClaudeCliOutputParser
  outputBuffer: string
  flushTimer: ReturnType<typeof setTimeout> | null
  ipcBatchBuffer: string
  ipcBatchTimer: ReturnType<typeof setTimeout> | null
  cleanTextBuffer: string
  /**
   * Tracks the real parser status immediately — never debounced.
   * Used as previousStatus for TtsTrigger so it always sees accurate
   * busy↔locked transitions even when state.status lags by 4s.
   */
  ttsStatus: string
  ttsTrigger: TtsTrigger
  /** True once the user (or task auto-send) has written input to this agent's PTY — gates TTS. */
  hasSentInput: boolean
  /** True only when the user has manually typed a follow-up in the terminal (not auto-send, not system action). */
  hasManualFollowUp: boolean
  /** Last filtered LLM prose captured by TTS — used by TTS only. */
  lastFilteredProse: string
  /** Delayed Telegram status notification — 3s debounce for rapid status changes. */
  telegramSendTimer: ReturnType<typeof setTimeout> | null
  /** Headless xterm terminal for clean text extraction (Telegram, TTS) */
  headlessTerminal: HeadlessTerminalBuffer
}

const agents = new Map<string, ManagedAgent>()

// Tracks when an agent entered awaiting_approval so we can hold the status
// visible for at least 500ms before allowing it to be overwritten.
const approvalEntryTimes = new Map<string, number>()
const approvalHoldTimers = new Map<string, ReturnType<typeof setTimeout>>()
const statusDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
const ptyOwners = new Map<string, number>()

const ptyProxy = new PtyProxy({
  logInfo: (message, meta) => log.info(message, meta),
  logWarning: (message, meta) => log.warn(message, meta)
})

function buildSBARContext(managed: ManagedAgent): AgentContext {
  const lastOutputLines = managed.outputBuffer
    ? managed.outputBuffer.split('\n').slice(-20)
    : []
  return {
    agent: managed.state,
    lastOutputLines
  }
}


// Telegram notifier — injected by service-orchestrator to avoid circular imports
type TelegramNotifier = (payload: TelegramNotificationPayload) => void
let _telegramNotifier: TelegramNotifier | null = null

export function setTelegramNotifier(fn: TelegramNotifier | null): void {
  _telegramNotifier = fn
}

// Telegram agent-list sync — pushes updated agent list to sidecar on every status change
type TelegramAgentSync = () => void
let _telegramAgentSync: TelegramAgentSync | null = null

export function setTelegramAgentSync(fn: TelegramAgentSync | null): void {
  _telegramAgentSync = fn
}

function getNotificationConfig(): NotificationRouterConfig {
  let telegramEnabled = false
  try {
    const db = getDb()
    const user = db.prepare('SELECT 1 FROM telegram_allowlist LIMIT 1').get()
    telegramEnabled = Boolean(user) && _telegramNotifier !== null
  } catch {
    // migration not yet applied or DB not ready
  }
  return {
    desktopEnabled: true,
    soundEnabled: true,
    voiceEnabled: false,
    telegramEnabled,
  }
}

function emitTriageResult(agent: AgentState, previousStatus: AgentLifecycleStatus): void {
  const triageInput: TriageInput = {
    agentId: agent.id,
    agentName: agent.name,
    repoName: agent.cwd.split('/').pop() ?? agent.cwd,
    taskDescription: agent.taskDescription ?? '',
    previousStatus,
    currentStatus: agent.status
  }
  const triageEvent = triageAgentEvent(triageInput)
  const routingResult = routeNotification(triageEvent, getNotificationConfig())
  emitToAllRenderers(IPC_EVENTS.NOTIFICATIONS.TRIAGED, routingResult)

  // One-shot task completion: agent with taskDescription goes busy→locked (returned to prompt)
  // Triage gives locked 'low' priority which doesn't reach telegram layer, so send directly
  // Only fire on first completion (before user sends manual follow-up input)
  const managed = agents.get(agent.id)
  const isOneShotDone = agent.status === 'locked'
    && previousStatus === 'busy'
    && Boolean(agent.taskDescription)
    && managed !== undefined && !managed.hasManualFollowUp

  if ((routingResult.layers.includes('telegram') || isOneShotDone) && _telegramNotifier) {
    const STATUS_TO_PAYLOAD: Partial<Record<string, TelegramNotificationPayload['type']>> = {
      completed: 'completed',
      error: 'failed',
      looping: 'failed',
      awaiting_approval: 'awaiting_approval',
    }
    const payloadType = isOneShotDone ? 'completed' : STATUS_TO_PAYLOAD[agent.status]
    if (payloadType) {
      const db = getDb()
      const prefs = getTelegramPrefs(db)
      const prefKey = `notify_${payloadType}` as keyof typeof prefs
      if (prefs[prefKey]) {
        const task = (agent.taskDescription ?? '').slice(0, 200) || agent.name

        const payload: TelegramNotificationPayload = {
          type: payloadType,
          agentId: agent.id,
          agentName: agent.name,
          repo: agent.cwd.split('/').pop() ?? agent.cwd,
          summary: task,
          question: payloadType === 'needs_input' ? task : undefined,
          proposedAction: payloadType === 'awaiting_approval' ? `Agent needs permission to run a tool.\n\nTask: ${task}` : undefined,
          requestId: agent.id,
          timestamp: new Date().toISOString(),
        }

        // Cancel any pending Telegram send for this agent (debounce rapid status changes)
        const existingTimer = managed?.telegramSendTimer
        if (existingTimer) clearTimeout(existingTimer)

        if (managed) {
          managed.telegramSendTimer = setTimeout(() => {
            if (managed) managed.telegramSendTimer = null
            // Status-only notification — agent sends content via MCP tool
            payload.summary = (agent.taskDescription ?? '').slice(0, 200) || agent.name
            if (_telegramNotifier) _telegramNotifier(payload)
          }, 3000)
        }
      }
    }
  }

  // Keep sidecar agent cache in sync on every status change
  _telegramAgentSync?.()
}

function syncKanbanCard(db: ReturnType<typeof getDb>, agentId: string, newStatus: string): void {
  const taskStatus = AGENT_TO_TASK_STATUS[newStatus]
  const eventType = AGENT_TO_EVENT_TYPE[newStatus]
  if (!taskStatus || !eventType) return
  try {
    const linkedTask = getTaskByAgentId(db, agentId)
    if (!linkedTask) return
    updateTask(db, linkedTask.id, { status: taskStatus })
    insertTaskEvent(db, {
      taskId: linkedTask.id,
      eventType,
      fromStatus: linkedTask.status,
      toStatus: taskStatus,
      agentId,
      payload: { taskTitle: linkedTask.title, repoId: linkedTask.repoId }
    })

    if (eventType === 'CARD_COMPLETED') {
      const managed = agents.get(agentId)
      if (managed) {
        try {
          const sbar = createAndStoreSBAR(db, buildSBARContext(managed))
          linkSBARToTask(db, linkedTask.id, sbar.id)
          log.debug('SBAR generated and linked to task on CARD_COMPLETED', { taskId: linkedTask.id, sbarId: sbar.id })
        } catch (err) {
          log.warn('Failed to generate SBAR on CARD_COMPLETED', { agentId, error: String(err) })
        }
      }
    }

    getAnamnesisWriter()?.onEventInserted()
    emitToAllRenderers(IPC_EVENTS.TASKS.UPDATED, { taskId: linkedTask.id })
    log.debug('Kanban card synced', { taskId: linkedTask.id, agentId, taskStatus })
  } catch (err) {
    log.warn('Failed to sync kanban card', { agentId, newStatus, error: err instanceof Error ? err.message : String(err) })
  }
}

function flushOutputBuffer(agentId: string): void {
  const managed = agents.get(agentId)
  if (!managed || managed.outputBuffer.length === 0) return
  if (isDbShuttingDown()) {
    log.debug('Skipping output flush during shutdown', { agentId })
    managed.outputBuffer = ''
    managed.flushTimer = null
    return
  }
  try {
    insertTerminalOutput(getDb(), agentId, managed.outputBuffer)
  } catch (err) {
    log.warn('Failed to persist terminal output', { agentId, error: err instanceof Error ? err.message : String(err) })
  }
  managed.outputBuffer = ''
  managed.flushTimer = null
}

function writeMcpConfig(agentId: string, agentName: string, repo: string): string | null {
  const sockPath = getTelegramSocketPath()
  if (!sockPath) return null

  const scriptPath = app.isPackaged
    ? join(process.resourcesPath, 'telegram-mcp-server', 'index.js')
    : join(process.cwd(), 'src', 'main', 'telegram-mcp-server', 'index.js')

  const config = {
    mcpServers: {
      'agenthub-telegram': {
        command: 'node',
        args: [scriptPath],
        env: {
          AGENTHUB_TELEGRAM_SOCK: sockPath,
          AGENTHUB_AGENT_ID: agentId,
          AGENTHUB_AGENT_NAME: agentName,
          AGENTHUB_AGENT_REPO: repo,
        }
      }
    }
  }

  const configPath = join(tmpdir(), `agenthub-mcp-${agentId}.json`)
  writeFileSync(configPath, JSON.stringify(config), 'utf-8')
  return configPath
}

function cleanupMcpConfig(agentId: string): void {
  try {
    unlinkSync(join(tmpdir(), `agenthub-mcp-${agentId}.json`))
  } catch {}
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
    effortLevel: options.effortLevel,
    taskDescription: options.taskDescription,
    color: options.color,
    voiceMode: options.voiceMode
  })
  agentState.telegramNotify = options.telegramNotify ?? false

  // Track last-used repo for dropdown ordering
  updateRepoLastUsed(db, repoId)

  // Build provider-specific env vars (Ollama needs ANTHROPIC_BASE_URL, AUTH_TOKEN, empty API_KEY)
  const spawnEnv = buildSpawnEnv(
    agentState.model || '',
    agentState.provider || 'anthropic'
  )
  const { modelFlag: _modelFlag, ...providerEnv } = spawnEnv

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...providerEnv,
    ...(options.envOverrides ?? {})
  }
  // Remove CLAUDECODE env var so spawned claude CLI doesn't think it's nested
  delete env.CLAUDECODE

  const shell = process.platform === 'win32' ? 'powershell.exe' : 'zsh'
  const args = process.platform === 'win32' ? [] : ['-l']

  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: options.cols ?? 120,
    rows: options.rows ?? 30,
    cwd: options.cwd,
    env
  })

  updateAgentPid(db, agentState.id, ptyProcess.pid, null)
  agentState.pid = ptyProcess.pid

  // Inject workspace memory before PTY receives the claude command (500ms window)
  if (options.projectId) {
    const project = getProjectById(db, options.projectId)
    if (project?.path) {
      writeWorkspaceMemory(db, options.projectId, project.path)
    }
  }

  insertActivityEvent(db, {
    eventType: 'agent_spawned',
    entityType: 'agent',
    entityId: agentState.id,
    repoId: agentState.repoId,
    agentId: agentState.id,
    details: { name: agentState.name, model: agentState.model, provider: agentState.provider }
  })

  const parser = createParser() as ClaudeCliOutputParser

  ptyProcess.onData((data: string) => {
    // 16ms IPC batching — aligns with 60fps, reduces IPC overhead for large code blocks
    const managed = agents.get(agentState.id)
    if (managed) {
      managed.ipcBatchBuffer += data
      if (!managed.ipcBatchTimer) {
        managed.ipcBatchTimer = setTimeout(() => {
          const batch = managed.ipcBatchBuffer
          managed.ipcBatchBuffer = ''
          managed.ipcBatchTimer = null
          emitToAllRenderers(IPC_EVENTS.AGENTS.OUTPUT, agentState.id, batch)
        }, 16)
      }

      // Buffer output for batched DB persistence
      managed.outputBuffer += data
      // Feed raw PTY data to headless terminal for clean text extraction
      managed.headlessTerminal.write(data)
      // Accumulate ANSI-stripped text for TTS response capture
      managed.cleanTextBuffer += stripAnsi(data)
      if (!managed.flushTimer) {
        managed.flushTimer = setTimeout(() => {
          flushOutputBuffer(agentState.id)
        }, 2000)
      }
    }

    // BEL character (\x07) — Claude CLI sends this when a response completes.
    // Use cleanTextBuffer for TTS status transitions (immediate, best-effort).
    // Telegram extraction uses the 3s-delayed headless flush path instead —
    // Terminal.write() is async so BEL-time reads are unreliable.
    if (data.includes('\x07') && managed) {
      if (managed.ttsStatus === 'busy') {
        const rawFiltered = filterTtsResponse(managed.cleanTextBuffer.trim())
        const wordCount = rawFiltered.trim().split(/\s+/).filter((w) => w.length > 0).length
        if (wordCount >= 3) {
          log.debug('[TTS] BEL detected — accelerating locked transition', { agentId: agentState.id, filteredLen: rawFiltered.length, wordCount })
          managed.ttsStatus = 'locked'
          managed.ttsTrigger.onStatusChange('busy', 'locked', rawFiltered)
        } else {
          log.debug('[TTS] BEL detected but insufficient prose, ignoring', { agentId: agentState.id, wordCount })
        }
      }
    }

    const parsed = parser.parse(data)
    if (parsed) {
      const mgd = agents.get(agentState.id)
      if (mgd && mgd.state.status !== parsed.status) {
        const previousStatus = mgd.state.status
        const newStatus = parsed.status as AgentLifecycleStatus

        // Feed every raw parser transition to TtsTrigger immediately — before
        // the 4 s status debounce — so it sees all busy/locked cycles and can
        // cancel premature emits correctly. The debounce below is only for DB
        // writes and UI status updates, not for TTS timing.
        //
        // IMPORTANT: use ttsStatus (not state.status) as previousStatus.
        // state.status lags by up to 4 s due to the debounce below, which
        // causes false "already in this state" check failures for agents that
        // respond in under 4 s. ttsStatus is updated immediately here.
        if (mgd.ttsStatus !== newStatus) {
          const ttsPrev = mgd.ttsStatus
          mgd.ttsStatus = newStatus
          const rawFiltered = filterTtsResponse(mgd.cleanTextBuffer.trim())
          if (rawFiltered.trim() && mgd.hasSentInput) {
            mgd.lastFilteredProse = rawFiltered
          }
          log.debug('[TTS] parser transition', {
            agentId: agentState.id,
            prev: ttsPrev,
            next: newStatus,
            bufLen: mgd.cleanTextBuffer.length,
            filteredLen: rawFiltered.length,
            filteredPreview: rawFiltered.slice(0, 120).replace(/\n/g, '↵'),
          })
          mgd.ttsTrigger.onStatusChange(ttsPrev, newStatus, rawFiltered)
        }

        function applyStatusChange(): void {
          const current = agents.get(agentState.id)
          if (!current) return
          if (isDbShuttingDown()) {
            log.debug('Skipping status change during shutdown', { id: agentState.id, newStatus })
            return
          }

          current.state.status = newStatus
          current.state.confidence = parsed!.confidence
          updateAgentStatus(db, agentState.id, newStatus, parsed!.confidence)
          emitToAllRenderers(IPC_EVENTS.AGENTS.STATUS_CHANGE, agentState.id, newStatus, parsed!.confidence)
          insertActivityEvent(db, {
            eventType: 'agent_status_changed',
            entityType: 'agent',
            entityId: agentState.id,
            repoId: agentState.repoId,
            agentId: agentState.id,
            details: { from: previousStatus, to: newStatus, confidence: parsed!.confidence }
          })
          emitTriageResult(current.state, previousStatus)
          syncKanbanCard(db, agentState.id, newStatus)
          log.debug('Agent status changed via parser', { id: agentState.id, status: newStatus, confidence: parsed!.confidence })
        }

        if (newStatus === 'awaiting_approval') {
          approvalEntryTimes.set(agentState.id, Date.now())
          const existing = approvalHoldTimers.get(agentState.id)
          if (existing) {
            clearTimeout(existing)
            approvalHoldTimers.delete(agentState.id)
          }
          applyStatusChange()
          // Emit TTS approval announcement (immediate — no debounce needed)
          emitToAllRenderers(IPC_EVENTS.TTS.APPROVAL_NEEDED, agentState.id)
        } else if (previousStatus === 'awaiting_approval') {
          const entryTime = approvalEntryTimes.get(agentState.id)
          const elapsed = entryTime !== undefined ? Date.now() - entryTime : Infinity
          const remaining = 500 - elapsed
          if (remaining > 0) {
            const timer = setTimeout(() => {
              approvalHoldTimers.delete(agentState.id)
              approvalEntryTimes.delete(agentState.id)
              applyStatusChange()
            }, remaining)
            approvalHoldTimers.set(agentState.id, timer)
          } else {
            approvalEntryTimes.delete(agentState.id)
            applyStatusChange()
          }
        } else {
          const existingDebounce = statusDebounceTimers.get(agentState.id)
          if (existingDebounce) clearTimeout(existingDebounce)
          const debounceTimer = setTimeout(() => {
            statusDebounceTimers.delete(agentState.id)
            const current = agents.get(agentState.id)
            if (current && current.state.status !== newStatus && current.state.status !== 'awaiting_approval') {
              applyStatusChange()
            }
          }, 4000)
          statusDebounceTimers.set(agentState.id, debounceTimer)
        }
      }
    }
  })

  ptyProcess.onExit(({ exitCode }) => {
    // Clean up timers
    const debounce = statusDebounceTimers.get(agentState.id)
    if (debounce) { clearTimeout(debounce); statusDebounceTimers.delete(agentState.id) }
    const approval = approvalHoldTimers.get(agentState.id)
    if (approval) { clearTimeout(approval); approvalHoldTimers.delete(agentState.id) }
    approvalEntryTimes.delete(agentState.id)

    // Flush remaining IPC batch so the last ~16ms of output is not lost
    const managed = agents.get(agentState.id)
    if (managed?.telegramSendTimer) {
      clearTimeout(managed.telegramSendTimer)
      managed.telegramSendTimer = null
    }
    if (managed) {
      if (managed.ipcBatchTimer) {
        clearTimeout(managed.ipcBatchTimer)
        managed.ipcBatchTimer = null
        if (managed.ipcBatchBuffer.length > 0) {
          emitToAllRenderers(IPC_EVENTS.AGENTS.OUTPUT, agentState.id, managed.ipcBatchBuffer)
          managed.ipcBatchBuffer = ''
        }
      }
      if (managed.flushTimer) {
        clearTimeout(managed.flushTimer)
        managed.flushTimer = null
      }
    }

    // Flush any remaining output
    flushOutputBuffer(agentState.id)

    log.info('Agent exited', { id: agentState.id, exitCode })

    // During shutdown the DB is already closed — skip all DB writes
    // to avoid "The database connection is not open" crashes.
    if (isDbShuttingDown()) {
      log.info('Agent exit during shutdown, skipping DB writes', { id: agentState.id, exitCode })
      cleanupMcpConfig(agentState.id)
      managed?.headlessTerminal.dispose()
      agents.delete(agentState.id)
      return
    }

    const previousStatusOnExit = agentState.status
    updateAgentStatus(db, agentState.id, 'completed', 'confirmed')
    agentState.status = 'completed'
    agentState.confidence = 'confirmed'
    emitToAllRenderers(IPC_EVENTS.AGENTS.EXIT, agentState.id, exitCode)
    emitToAllRenderers(IPC_EVENTS.AGENTS.STATUS_CHANGE, agentState.id, 'completed', 'confirmed')
    insertActivityEvent(db, {
      eventType: exitCode === 0 ? 'agent_completed' : 'agent_error',
      entityType: 'agent',
      entityId: agentState.id,
      repoId: agentState.repoId,
      agentId: agentState.id,
      details: { exitCode }
    })
    emitTriageResult(agentState, previousStatusOnExit)
    syncKanbanCard(db, agentState.id, 'completed')

    // Auto-close breakout window for this agent
    const wm = getWindowManager()
    if (wm) {
      wm.closeBreakout(agentState.id)
    }

    cleanupMcpConfig(agentState.id)
    managed?.headlessTerminal.dispose()
    agents.delete(agentState.id)
  })

  const previousStatusOnSpawn = agentState.status
  updateAgentStatus(db, agentState.id, 'busy', 'inferred')
  agentState.status = 'busy'
  agentState.confidence = 'inferred'

  const ttsTrigger = new TtsTrigger({
    debounceMs: 2500,
    // Always start unprimed so the startup banner (first busy→locked) is
    // silently skipped. The trigger primes itself on the first locked→busy
    // transition — which happens when the task is sent or the user types.
    primed: false,
    onBufferReset: () => {
      const current = agents.get(agentState.id)
      if (current) current.cleanTextBuffer = ''
    },
    onEmit: (text: string) => {
      const current = agents.get(agentState.id)
      if (!current) return
      if (!current.hasSentInput) {
        log.debug('[TTS] suppressed RESPONSE_READY — no user input yet', { agentId: agentState.id })
        current.cleanTextBuffer = ''
        return
      }
      current.lastFilteredProse = text
      current.cleanTextBuffer = ''
      log.info('[TTS] emitting RESPONSE_READY', {
        agentId: agentState.id,
        textLen: text.length,
        preview: text.slice(0, 200).replace(/\n/g, '↵'),
      })
      emitToAllRenderers(IPC_EVENTS.TTS.RESPONSE_READY, agentState.id, text)
    }
  })
  agents.set(agentState.id, {
    state: agentState, ptyProcess, parser,
    outputBuffer: '', flushTimer: null,
    ipcBatchBuffer: '', ipcBatchTimer: null,
    cleanTextBuffer: '',
    ttsStatus: agentState.status, ttsTrigger,
    hasSentInput: false,
    hasManualFollowUp: false,
    lastFilteredProse: '',
    telegramSendTimer: null,
    headlessTerminal: new HeadlessTerminalBuffer(options.cols ?? 120, options.rows ?? 30)
  })
  emitToAllRenderers(IPC_EVENTS.AGENTS.SPAWNED, agentState)
  emitToAllRenderers(IPC_EVENTS.AGENTS.STATUS_CHANGE, agentState.id, 'busy', 'inferred')
  emitTriageResult(agentState, previousStatusOnSpawn)

  // Auto-launch claude CLI with the task after shell initializes
  const task = options.taskDescription?.trim()

  // Strip provider prefix from dynamically-fetched Ollama model IDs.
  // model-service.ts stores them as "ollama-cloud:devstral-2:123b-cloud" or "ollama-local:devstral-2"
  // but Claude CLI / ollama launch only accepts the bare Ollama tag, e.g. "devstral-2:123b-cloud".
  // Static catalog entries (e.g. "glm-5:cloud") have no prefix and pass through unchanged.
  const isOllama = agentState.provider === 'ollama-local' || agentState.provider === 'ollama-cloud'
  const rawModel = agentState.model ?? ''
  let modelName = isOllama
    ? rawModel.replace(/^(ollama-cloud:|ollama-local:)/, '')
    : rawModel
  // Ollama cloud models require a :cloud or -cloud tag suffix.
  // If the provider is ollama-cloud but the tag lacks a cloud suffix,
  // append :cloud so `ollama launch claude` routes to the cloud endpoint
  // instead of attempting a multi-GB local model pull.
  if (agentState.provider === 'ollama-cloud' && modelName && !/cloud/i.test(modelName)) {
    log.warn('Cloud model missing cloud suffix, appending :cloud', { modelName })
    modelName = `${modelName}-cloud`
  }
  const safeModelName = modelName ? modelName.replace(/'/g, "'\\''") : ''
  const modelFlag = safeModelName ? ` --model '${safeModelName}'` : ''
  const effortFlag = agentState.effortLevel ? ` --effort ${agentState.effortLevel}` : ''
  const permFlag = options.skipPermissions ? ' --dangerously-skip-permissions' : ''

  const repoName = options.cwd.split('/').pop() ?? options.cwd
  const mcpConfigPath = writeMcpConfig(agentState.id, agentState.name, repoName)
  const mcpFlag = mcpConfigPath ? ` --mcp-config '${mcpConfigPath}'` : ''

  // All Ollama models (local + cloud) MUST use `ollama launch claude` which wires
  // env vars and model routing internally. Claude CLI rejects unknown model names,
  // so the env-var-only approach does NOT work.
  // The Ollama tag must be exact — cloud models need the :cloud suffix (e.g. devstral-2:123b-cloud).
  const ollamaBin = '/Applications/Ollama.app/Contents/Resources/ollama'

  // For Ollama models: launch claude interactively via `ollama launch claude`,
  // then send the task as user input once the session is ready.
  // `-p` flag causes print-mode (non-interactive) which exits after one response.
  if (isOllama) {
    const extraArgs = permFlag.trim()
    const cmd = extraArgs
      ? `clear; ${ollamaBin} launch claude -y${modelFlag} -- ${extraArgs}\n`
      : `clear; ${ollamaBin} launch claude -y${modelFlag}\n`

    setTimeout(() => {
      ptyProcess.write(cmd)
      log.info('Sent command to PTY', { id: agentState.id, cmd: cmd.trim(), model: modelName, rawModel, provider: agentState.provider })

      // Send task as input after claude session initializes
      if (task) {
        setTimeout(() => {
          const mOllama = agents.get(agentState.id)
          if (mOllama) {
            mOllama.cleanTextBuffer = ''
            mOllama.hasSentInput = true
          }
          ptyProcess.write(task + '\n')
          log.info('Sent task to Ollama agent', { id: agentState.id, task })
        }, 3000)
      }
    }, 500)
  } else if (task) {
    setTimeout(() => {
      const mTask = agents.get(agentState.id)
      if (mTask) {
        mTask.cleanTextBuffer = ''
        mTask.hasSentInput = true
      }
      // Append Telegram instruction when telegramNotify is enabled
      const telegramSuffix = agentState.telegramNotify
        ? '. When done, use the send_telegram tool to send me a short summary of what you did (bullet points). If you need approval or have a question, also send_telegram.'
        : ''
      // Escape for single quotes to prevent shell metacharacter injection (backticks, $(), etc.)
      const escapedTask = (task + telegramSuffix).replace(/'/g, "'\\''")
      // Do NOT use -p flag — it requires an API key and fails with OAuth/subscription auth.
      // Instead launch interactive claude and send the task as the first prompt.
      const cmd = `clear; claude${modelFlag}${effortFlag}${permFlag}${mcpFlag} -- '${escapedTask}'\n`
      ptyProcess.write(cmd)
      log.info('Sent command to PTY', { id: agentState.id, cmd: cmd.trim(), model: modelName, rawModel, provider: agentState.provider, effort: agentState.effortLevel, task })
    }, 500)
  } else {
    setTimeout(() => {
      const cmd = `clear; claude${modelFlag}${effortFlag}${permFlag}${mcpFlag}\n`
      ptyProcess.write(cmd)
      log.info('Sent command (interactive) to PTY', { id: agentState.id, cmd: cmd.trim(), model: modelName, rawModel, provider: agentState.provider, effort: agentState.effortLevel })
    }, 500)
  }

  log.info('Agent spawned', { id: agentState.id, pid: ptyProcess.pid, cwd: options.cwd })
  return agentState
}

export function sendInput(agentId: string, data: string, opts?: { isSystemAction?: boolean }): void {
  const managed = agents.get(agentId)
  if (!managed) throw new Error(`Agent ${agentId} not found`)
  if (!opts?.isSystemAction) {
    managed.hasSentInput = true
    managed.hasManualFollowUp = true
  }
  log.debug('[Main sendInput]', { agentId, len: data.length, preview: data.slice(0, 80) })

  // Start a fresh TTS capture window when the user submits a request.
  // Resetting here (before the write) clears any echoed typing from the buffer
  // before Claude's response starts accumulating. Avoids the stale 4000ms
  // debounce wiping the buffer AFTER the response has already arrived.
  if (shouldResetTtsBuffer(data, managed.ttsStatus)) {
    managed.cleanTextBuffer = ''
  }

  // Claude Code CLI enables bracketed paste mode. When sending bulk text
  // ending with \r (Enter), the TUI swallows the \r if it arrives in the
  // same write as the text. Split: send text first, then \r after a tick.
  if (data.length > 1 && data.endsWith('\r')) {
    const text = data.slice(0, -1)
    managed.ptyProcess.write(text)
    setTimeout(() => {
      const m = agents.get(agentId)
      if (m) m.ptyProcess.write('\r')
    }, 50)
  } else {
    managed.ptyProcess.write(data)
  }
}

export function setPtyOwner(agentId: string, webContentsId: number): void {
  ptyOwners.set(agentId, webContentsId)
}

export function clearPtyOwner(agentId: string): void {
  ptyOwners.delete(agentId)
}

export function resizeAgent(agentId: string, cols: number, rows: number, _webContentsId?: number): void {
  const managed = agents.get(agentId)
  if (!managed) throw new Error(`Agent ${agentId} not found`)
  managed.ptyProcess.resize(cols, rows)
  managed.headlessTerminal.resize(cols, rows)
}

export function killAgent(agentId: string): void {
  const managed = agents.get(agentId)
  if (!managed) throw new Error(`Agent ${agentId} not found`)

  // Stop proxy if running
  ptyProxy.stopProxy(agentId)

  // Flush remaining output before kill
  flushOutputBuffer(agentId)

  const pid = managed.ptyProcess.pid
  log.info('Killing agent via kill hierarchy', { id: agentId, pid })

  // Execute graceful kill hierarchy (SIGTSTP → SIGINT → SIGTERM → SIGKILL)
  executeKillHierarchy(agentId, pid, {
    sendSignal: (p: number, signal: string) => {
      try {
        process.kill(p, signal)
      } catch (err) {
        log.warn('Failed to send signal', { pid: p, signal, error: err instanceof Error ? err.message : String(err) })
      }
    },
    updateStatus: (id: string, status: string, confidence: string) => {
      emitToAllRenderers(IPC_EVENTS.AGENTS.STATUS_CHANGE, id, status, confidence)
    },
    isProcessAlive: (p: number): boolean => {
      try {
        process.kill(p, 0)
        return true
      } catch {
        return false
      }
    },
    onWarning: (id: string, message: string) => {
      log.warn('Kill hierarchy warning', { id, message })
    }
  }).then(() => {
    // If the onExit handler hasn't already cleaned up, do it now
    if (agents.has(agentId)) {
      const mgd = agents.get(agentId)!
      if (mgd.telegramSendTimer) {
        clearTimeout(mgd.telegramSendTimer)
        mgd.telegramSendTimer = null
      }
      const previousStatusOnKill = mgd.state.status
      const db = getDb()
      updateAgentStatus(db, agentId, 'interrupted', 'confirmed')
      mgd.state.status = 'interrupted'
      mgd.state.confidence = 'confirmed'
      emitToAllRenderers(IPC_EVENTS.AGENTS.STATUS_CHANGE, agentId, 'interrupted', 'confirmed')
      emitTriageResult(mgd.state, previousStatusOnKill)
      syncKanbanCard(db, agentId, 'interrupted')
      const holdTimer = approvalHoldTimers.get(agentId)
      if (holdTimer) { clearTimeout(holdTimer); approvalHoldTimers.delete(agentId) }
      approvalEntryTimes.delete(agentId)
      ptyOwners.delete(agentId)
      cleanupMcpConfig(agentId)
      mgd.headlessTerminal.dispose()
      agents.delete(agentId)
    }
  }).catch((err) => {
    log.error('Kill hierarchy failed, forcing kill', { id: agentId, error: err instanceof Error ? err.message : String(err) })
    try {
      managed.ptyProcess.kill()
    } catch { /* already dead */ }
    if (agents.has(agentId)) {
      const mgd = agents.get(agentId)!
      if (mgd.telegramSendTimer) {
        clearTimeout(mgd.telegramSendTimer)
        mgd.telegramSendTimer = null
      }
      const previousStatusOnKillCatch = mgd.state.status
      const db = getDb()
      updateAgentStatus(db, agentId, 'interrupted', 'confirmed')
      mgd.state.status = 'interrupted'
      mgd.state.confidence = 'confirmed'
      emitToAllRenderers(IPC_EVENTS.AGENTS.STATUS_CHANGE, agentId, 'interrupted', 'confirmed')
      emitTriageResult(mgd.state, previousStatusOnKillCatch)
      syncKanbanCard(db, agentId, 'interrupted')
      const holdTimer = approvalHoldTimers.get(agentId)
      if (holdTimer) { clearTimeout(holdTimer); approvalHoldTimers.delete(agentId) }
      approvalEntryTimes.delete(agentId)
      ptyOwners.delete(agentId)
      cleanupMcpConfig(agentId)
      mgd.headlessTerminal.dispose()
      agents.delete(agentId)
    }
  })
}

export function pauseAgent(agentId: string): void {
  const managed = agents.get(agentId)
  if (!managed) throw new Error(`Agent ${agentId} not found`)

  log.info('Pausing agent', { id: agentId })
  process.kill(managed.ptyProcess.pid, 'SIGTSTP')

  const previousStatusOnPause = managed.state.status
  const db = getDb()
  updateAgentStatus(db, agentId, 'paused', 'confirmed')
  managed.state.status = 'paused'
  emitToAllRenderers(IPC_EVENTS.AGENTS.STATUS_CHANGE, agentId, 'paused', 'confirmed')
  emitTriageResult(managed.state, previousStatusOnPause)
}

export function resumeAgent(agentId: string): void {
  const managed = agents.get(agentId)
  if (!managed) throw new Error(`Agent ${agentId} not found`)

  log.info('Resuming agent', { id: agentId })
  process.kill(managed.ptyProcess.pid, 'SIGCONT')

  const previousStatusOnResume = managed.state.status
  const db = getDb()
  updateAgentStatus(db, agentId, 'busy', 'inferred')
  managed.state.status = 'busy'
  emitToAllRenderers(IPC_EVENTS.AGENTS.STATUS_CHANGE, agentId, 'busy', 'inferred')
  emitTriageResult(managed.state, previousStatusOnResume)
  syncKanbanCard(db, agentId, 'busy')
}

export function getAgentState(agentId: string): AgentState | null {
  const managed = agents.get(agentId)
  if (managed) return managed.state
  return getAgentById(getDb(), agentId)
}

export function listAgents(): AgentState[] {
  return getAllAgents(getDb())
}

export function respawnAgent(agentId: string): AgentState {
  const db = getDb()
  const oldAgent = getAgentById(db, agentId)
  if (!oldAgent) throw new Error(`Agent ${agentId} not found in DB`)

  // Kill orphan process if still alive
  if (oldAgent.pid) {
    try {
      process.kill(oldAgent.pid, 'SIGTERM')
      log.info('Killed orphaned agent process', { pid: oldAgent.pid })
    } catch {
      // Process already dead, ignore
    }
  }

  // Mark old agent as completed
  updateAgentStatus(db, agentId, 'completed', 'confirmed')

  // Fetch handoff before spawning so we can log it
  const handoff = getSBARByAgentId(db, agentId)

  // Respawn with same config
  const newAgent = spawnAgent({
    repoId: oldAgent.repoId,
    name: oldAgent.name + '-resumed',
    cwd: oldAgent.cwd,
    model: oldAgent.model,
    provider: oldAgent.provider,
    effortLevel: oldAgent.effortLevel,
    taskDescription: oldAgent.taskDescription,
    color: oldAgent.color
  })

  insertActivityEvent(db, {
    eventType: 'agent_respawned',
    entityType: 'agent',
    entityId: newAgent.id,
    repoId: newAgent.repoId,
    agentId: newAgent.id,
    details: { oldAgentId: agentId, hasSbar: !!handoff }
  })

  return newAgent
}

export function updateAgentVoiceMode(agentId: string, mode: import('../../shared/types/voice.types').VoiceMode): void {
  const managed = agents.get(agentId)
  if (managed) {
    managed.state.voiceMode = mode
  }
  dbUpdateAgentVoiceMode(getDb(), agentId, mode)
  log.debug('Agent voice mode updated', { id: agentId, mode })
}

export function updateAgentColor(agentId: string, color: string): void {
  const managed = agents.get(agentId)
  if (managed) {
    managed.state.color = color
  }
  dbUpdateAgentColor(getDb(), agentId, color)
  log.debug('Agent color updated', { id: agentId, color })
}

export function updateAgentTaskDescription(agentId: string, taskDescription: string): void {
  const managed = agents.get(agentId)
  if (managed) {
    managed.state.taskDescription = taskDescription
  }
  dbUpdateAgentTaskDescription(getDb(), agentId, taskDescription)
  log.debug('Agent task description updated', { id: agentId, taskDescription })
}

export function renameAgent(agentId: string, name: string): void {
  const managed = agents.get(agentId)
  if (managed) {
    managed.state.name = name
  }
  dbUpdateAgentName(getDb(), agentId, name)
  log.debug('Agent renamed', { id: agentId, name })
}

export function updateAgentModel(
  agentId: string,
  model: string,
  provider: AgentState['provider'],
  effortLevel: EffortLevel
): void {
  const managed = agents.get(agentId)
  if (managed) {
    managed.state.model = model
    managed.state.provider = provider
    managed.state.effortLevel = effortLevel
    // Send /model command to running agent to switch model live
    // Note: effort level can only be changed via /model picker's arrow keys in the TUI,
    // there is no /effort slash command. Effort is set at spawn via --effort flag.
    managed.ptyProcess.write(`/model ${model}\n`)
  }
  dbUpdateAgentModel(getDb(), agentId, model, provider, effortLevel)
  log.debug('Agent model updated', { id: agentId, model, provider, effortLevel })
}

export function startPtyProxy(agentId: string): { socketPath: string; attachCommand: string } {
  const managed = agents.get(agentId)
  if (!managed) throw new Error(`Agent ${agentId} not found`)
  const socketPath = ptyProxy.startProxy(agentId, managed.ptyProcess)
  const attachCommand = `node -e "const n=require('net'),s=n.connect('${socketPath}');process.stdin.setRawMode(true);process.stdin.resume();process.stdin.pipe(s);s.pipe(process.stdout);s.on('close',()=>process.exit())"`
  return { socketPath, attachCommand }
}

export function stopPtyProxy(agentId: string): void {
  ptyProxy.stopProxy(agentId)
}

export function getPtyProxyPath(agentId: string): string | null {
  return ptyProxy.getSocketPath(agentId)
}

export function cleanupAllAgents(): void {
  ptyProxy.stopAll()
  for (const [id, managed] of agents) {
    try {
      if (managed.flushTimer) clearTimeout(managed.flushTimer)
      if (managed.ipcBatchTimer) clearTimeout(managed.ipcBatchTimer)
      if (managed.telegramSendTimer) clearTimeout(managed.telegramSendTimer)
      flushOutputBuffer(id)
      cleanupMcpConfig(id)
      managed.headlessTerminal.dispose()
      managed.ptyProcess.kill()
    } catch {
      log.warn('Failed to kill agent during cleanup', { id })
    }
  }
  agents.clear()
  ptyOwners.clear()
  for (const timer of approvalHoldTimers.values()) clearTimeout(timer)
  approvalHoldTimers.clear()
  approvalEntryTimes.clear()
  for (const timer of statusDebounceTimers.values()) clearTimeout(timer)
  statusDebounceTimers.clear()
  log.info('All agents cleaned up')
}
