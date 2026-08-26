import * as pty from 'node-pty'
import { emitToAllRenderers } from '../utils/emit-to-all-renderers'
import log from 'electron-log/main'
import type { AgentState, AgentSpawnOptions, AgentLifecycleStatus } from '../../shared/types/agent.types'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'
import { getDb, isDbShuttingDown } from '../db/connection'
import { insertAgent, updateAgentStatus, updateAgentPid, updateAgentColor as dbUpdateAgentColor, updateAgentModel as dbUpdateAgentModel, updateAgentTaskDescription as dbUpdateAgentTaskDescription, updateAgentName as dbUpdateAgentName, updateAgentVoiceMode as dbUpdateAgentVoiceMode, updateAgentTelegramNotify as dbUpdateAgentTelegramNotify, getAgentById, getAllAgents } from '../db/queries/agents.queries'
import { getRepoById, getRepoByPath, insertRepo, updateRepoLastUsed } from '../db/queries/repos.queries'
import type { EffortLevel } from '../../shared/types/agent.types'
import { createParser, type ClaudeCliOutputParser } from '../parsers/cli-output-parser'
import { insertTerminalOutput } from '../db/queries/history.queries'
import { PtyProxy } from './pty-proxy'
import { executeKillHierarchy } from './kill-hierarchy'
import { getWindowManager, getAnamnesisWriter, getTelegramSocketPath } from './service-orchestrator'
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir, homedir } from 'os'
import { createHash } from 'crypto'
import { app, webContents } from 'electron'
import { buildSpawnEnv } from './model-dispatcher'
import { triageAgentEvent } from './auto-triage'
import { insertActivityEvent } from '../db/queries/activity.queries'
import { getSBARByAgentId } from '../db/queries/sbar.queries'
import { createAndStoreSBAR, type AgentContext } from './sbar-generator'
import { routeNotification } from './notification-router'
import { emitOrchestratorEvent, type OrchestratorEventType } from './orchestrator-events'
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
  /** Flush interval (ms) used by the IPC batch timer — adaptive under high throughput. */
  ipcBatchInterval: number
  /** IPC messages counted in the current 1-second rate window. */
  ipcRateCount: number
  /** Consecutive 1-second windows where ipcRateCount exceeded 100 msg/s. */
  ipcHighRateSeconds: number
  /** setInterval handle for the per-agent adaptive IPC rate monitor. */
  ipcRateInterval: ReturnType<typeof setInterval> | null
  cleanTextBuffer: string
  /** Read-only output buffer for orchestrator — never reset by TTS. */
  orchestratorBuffer: string
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
  /** Timer for silent lock detection — fires 15s after agent enters locked without calling send_telegram. */
  silentLockTimer: ReturnType<typeof setTimeout> | null
  /** Timestamp of last MCP send_telegram call for this agent. */
  lastMcpTelegramAt: number
  /** Headless xterm terminal for clean text extraction (Telegram, TTS) */
  headlessTerminal: HeadlessTerminalBuffer
  /** True if telegramNotify was enabled at spawn time (agent has prompt suffix). */
  telegramNotifyAtSpawn: boolean
  /** True once a completion notification has been sent for the current exchange (mid-session toggle path). Reset on next user submit. */
  hasNotifiedCompletion: boolean
}

const agents = new Map<string, ManagedAgent>()

// Tracks when an agent entered awaiting_approval so we can hold the status
// visible for at least 500ms before allowing it to be overwritten.
const approvalEntryTimes = new Map<string, number>()
const approvalHoldTimers = new Map<string, ReturnType<typeof setTimeout>>()
const statusDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
const ptyOwners = new Map<string, number>()

// S1: path → repoId cache — avoids repeated DB lookups on hot spawn paths
const repoPathCache = new Map<string, string>()

// S2: skills index existence — checked once per process lifetime
let skillsIndexExists: boolean | null = null
// S27: guard policy existence — checked once per process lifetime
let guardExists: boolean | null = null

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

export function setLastMcpTelegramAt(agentId: string): void {
  const managed = agents.get(agentId)
  if (managed) managed.lastMcpTelegramAt = Date.now()
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
    voiceEnabled: true,
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

  // Telegram notifications are per-agent: only agents with telegramNotify send to Telegram.
  // Agents spawned with telegramNotify report completion via the send_telegram MCP tool.
  // Agents toggled on mid-session don't have the prompt suffix, so use one-shot detection.
  const managed = agents.get(agent.id)
  const agentHasTelegram = managed?.state.telegramNotify === true

  // One-shot completion for agents toggled on mid-session (no prompt suffix).
  // These agents can't self-notify via MCP tool, so the system must detect
  // busy→locked transitions and send the notification. hasManualFollowUp is
  // intentionally NOT checked here — the user sending input is expected
  // (they're giving the agent work), not a signal to suppress notifications.
  const isOneShotDone = agentHasTelegram
    && managed !== undefined && !managed.telegramNotifyAtSpawn
    && !managed.hasNotifiedCompletion
    && agent.status === 'locked'
    && previousStatus === 'busy'

  if (agentHasTelegram && _telegramNotifier) {
    const STATUS_TO_PAYLOAD: Partial<Record<string, TelegramNotificationPayload['type']>> = {
      error: 'failed',
      awaiting_approval: 'awaiting_approval',
    }
    let payloadType: string | undefined = isOneShotDone ? 'completed' : STATUS_TO_PAYLOAD[agent.status]
    // Skip circular Telegram notification: don't ask "approve send_telegram?" via Telegram
    if (payloadType === 'awaiting_approval') {
      const buf = managed.cleanTextBuffer || ''
      if (buf.includes('send_telegram')) {
        log.debug('Skipping Telegram approval notification for send_telegram tool (circular)', { id: agent.id })
        payloadType = undefined
      }
    }
    if (payloadType) {
      const db = getDb()
      const prefs = getTelegramPrefs(db)
      const prefKey = `notify_${payloadType}` as keyof typeof prefs
      if (prefs[prefKey]) {
        // S25: redact credentials and system-prompt keywords before Telegram dispatch
        const rawOutput = managed?.cleanTextBuffer
          ? managed.cleanTextBuffer.slice(-200).trim()
          : ''
        const recentOutput = rawOutput
          .replace(/\b(KEY|TOKEN|SECRET|PASSWORD|ANTHROPIC|FORGEJO|AUTH)[=:]\S+/gi, '[REDACTED]')
          .replace(/(CLAUDE\.md|SYSTEM PROMPT|You are the|Session Policy)/gi, '[REDACTED]')
        const task = recentOutput || (agent.taskDescription ?? '').slice(0, 200) || agent.name

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

        if (_telegramNotifier) {
          _telegramNotifier(payload)
          // Prevent duplicate completion pings for mid-session agents (reset on next user submit)
          if (isOneShotDone && managed) {
            managed.hasNotifiedCompletion = true
          }
        }
      }
    }
  }

  // Keep sidecar agent cache in sync on every status change
  _telegramAgentSync?.()

  // Emit orchestrator bus event for kanban orchestrator to subscribe
  const orchEventType: OrchestratorEventType | null =
    triageEvent.isTaskCompleted ? 'agent:completed'
    : triageEvent.currentStatus === 'error' ? 'agent:failed'
    : 'agent:status-changed'
  emitOrchestratorEvent({ type: orchEventType, triageEvent })
}

function startSilentLockTimer(agentId: string): void {
  const managed = agents.get(agentId)
  if (!managed) return

  // Clear existing timer
  if (managed.silentLockTimer) {
    clearTimeout(managed.silentLockTimer)
    managed.silentLockTimer = null
  }

  // Only for agents with telegram enabled
  if (!managed.state.telegramNotify) return

  managed.silentLockTimer = setTimeout(() => {
    managed.silentLockTimer = null
    const m = agents.get(agentId)
    if (!m) return

    // Check: still locked, no MCP send_telegram in last 15s, telegram enabled
    if (m.state.status !== 'locked') return
    if (m.lastMcpTelegramAt > Date.now() - 15_000) return
    if (!m.state.telegramNotify) return

    const recentOutput = m.cleanTextBuffer
      ? m.cleanTextBuffer.slice(-500).trim()
      : ''
    if (!recentOutput) return

    const payload: TelegramNotificationPayload = {
      type: 'silent_lock',
      agentId: m.state.id,
      agentName: m.state.name,
      repo: m.state.cwd.split('/').pop() ?? m.state.cwd,
      summary: recentOutput.slice(0, 200),
      message: recentOutput,
      timestamp: new Date().toISOString(),
    }

    if (_telegramNotifier) _telegramNotifier(payload)
  }, 15_000)
}

function cancelSilentLockTimer(agentId: string): void {
  const managed = agents.get(agentId)
  if (managed?.silentLockTimer) {
    clearTimeout(managed.silentLockTimer)
    managed.silentLockTimer = null
  }
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

  // Sc1: CWD guard — must be the first check before any DB writes or PTY spawn
  if (!existsSync(options.cwd)) {
    throw new Error(`CWD does not exist: ${options.cwd}`)
  }

  // Sc3: compute CLAUDE.md hash before any DB writes
  const claudeMdPath = join(homedir(), '.claude', 'CLAUDE.md')
  const claudeMdHash = existsSync(claudeMdPath)
    ? createHash('sha256').update(readFileSync(claudeMdPath, 'utf8')).digest('hex')
    : null

  // S1: Ensure repo exists — check path cache first to avoid redundant DB lookups
  let repoId = options.repoId
  const cachedRepoId = repoPathCache.get(options.cwd)
  if (cachedRepoId) {
    repoId = cachedRepoId
  } else {
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
    repoPathCache.set(options.cwd, repoId)
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
    voiceMode: options.voiceMode,
    telegramNotify: options.telegramNotify ?? false,
    claudeMdHash
  })

  // Build provider-specific env vars (Ollama needs ANTHROPIC_BASE_URL, AUTH_TOKEN, empty API_KEY)
  const spawnEnv = buildSpawnEnv(
    agentState.model || '',
    agentState.provider || 'anthropic'
  )
  const { modelFlag: _modelFlag, ...providerEnv } = spawnEnv

  // Resolve the agenthub root — instruction source for all engines.
  // Agents spawned with a different CWD still need agenthub's rules, skills, and guardrails.
  const agenthubRoot = app.isPackaged
    ? join(process.resourcesPath, '..')
    : app.getAppPath()

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...providerEnv,
    ...(options.envOverrides ?? {}),
    AGENTHUB_BUILDER: '1',   // signals plugin hook: this is a builder session
    AGENTHUB_HOME: agenthubRoot,  // agents can read this to know where instructions live
    // Point zsh dotfile lookup to an empty dir so oh-my-zsh and user .zshrc
    // don't pollute the terminal before Claude CLI appears.
    // /etc/zprofile still runs, keeping macOS PATH (path_helper) intact.
    ZDOTDIR: tmpdir()
  }
  // Remove CLAUDECODE env var so spawned claude CLI doesn't think it's nested
  delete env.CLAUDECODE
  // S28: strip credentials that should never be visible to agent PTY
  delete env.AUTH_SECRET
  delete env.FORGEJO_TOKEN
  delete env.FORGEJO_URL
  // S45: strip Ollama Cloud key — not needed by agent PTY (only used by model-service.ts internally)
  delete env.OLLAMA_CLOUD_KEY
  delete env.OLLAMA_API_KEY

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

  const parser = createParser() as ClaudeCliOutputParser

  ptyProcess.onData((data: string) => {
    // Adaptive IPC batching — base 16ms (60fps), throttles to 64ms under sustained high throughput
    const managed = agents.get(agentState.id)
    if (managed) {
      managed.ipcBatchBuffer += data
      managed.ipcRateCount++
      if (!managed.ipcBatchTimer) {
        managed.ipcBatchTimer = setTimeout(() => {
          const batch = managed.ipcBatchBuffer
          managed.ipcBatchBuffer = ''
          managed.ipcBatchTimer = null
          // S3 Change 3: ptyOwner-first routing — send OUTPUT only to the owning window
          const ownerId = ptyOwners.get(agentState.id)
          if (ownerId !== undefined) {
            webContents.fromId(ownerId)?.send(IPC_EVENTS.AGENTS.OUTPUT, agentState.id, batch)
          } else {
            emitToAllRenderers(IPC_EVENTS.AGENTS.OUTPUT, agentState.id, batch)
          }
        }, managed.ipcBatchInterval)
      }

      // Buffer output for batched DB persistence
      managed.outputBuffer += data
      // Feed raw PTY data to headless terminal for clean text extraction
      managed.headlessTerminal.write(data)
      // Accumulate ANSI-stripped text for TTS response capture
      managed.cleanTextBuffer += stripAnsi(data)
      managed.orchestratorBuffer += stripAnsi(data)
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
        let previousStatus = mgd.state.status
        let newStatus = parsed.status as AgentLifecycleStatus

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
          // Silent lock detection: start timer when agent enters locked
          if (newStatus === 'locked') {
            startSilentLockTimer(agentState.id)
          } else {
            cancelSilentLockTimer(agentState.id)
          }
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
            if (!current || current.state.status === 'awaiting_approval') return

            // Reconcile with raw parser state — after rapid transitions the
            // debounced newStatus may be stale (e.g. 'busy' while agent is
            // already sitting at the ❯ prompt, ttsStatus = 'locked').
            const latestRaw = current.ttsStatus as AgentLifecycleStatus
            if (latestRaw !== newStatus) {
              previousStatus = current.state.status
              newStatus = latestRaw
            }

            if (current.state.status !== newStatus) {
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
    cancelSilentLockTimer(agentState.id)
    if (managed) {
      // S3: stop rate monitor
      if (managed.ipcRateInterval) {
        clearInterval(managed.ipcRateInterval)
        managed.ipcRateInterval = null
      }
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

    // S16: PATH_MISMATCH detection — scan clean text buffer for shell "command not found" errors
    if (exitCode !== 0 && managed && /command not found/i.test(managed.cleanTextBuffer)) {
      emitToAllRenderers(IPC_EVENTS.AGENTS.ERROR_DETAIL, { agentId: agentState.id, errorType: 'PATH_MISMATCH' })
      log.warn('Agent exit: PATH_MISMATCH detected', { id: agentState.id, exitCode })
    }

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
      // Guard: suppress gibberish / terminal fragments — require at least 3 real words
      const wordCount = text.trim().split(/\s+/).filter((w) => w.length > 0).length
      if (wordCount < 3) {
        log.debug('[TTS] suppressed RESPONSE_READY — insufficient prose', { agentId: agentState.id, wordCount })
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
    ipcBatchInterval: 16,
    ipcRateCount: 0,
    ipcHighRateSeconds: 0,
    ipcRateInterval: null,
    cleanTextBuffer: '',
    orchestratorBuffer: '',
    ttsStatus: agentState.status, ttsTrigger,
    hasSentInput: false,
    hasManualFollowUp: false,
    hasNotifiedCompletion: false,
    lastFilteredProse: '',
    silentLockTimer: null,
    lastMcpTelegramAt: 0,
    headlessTerminal: new HeadlessTerminalBuffer(options.cols ?? 120, options.rows ?? 30),
    telegramNotifyAtSpawn: agentState.telegramNotify
  })

  // S3: per-agent adaptive IPC rate monitor — throttle to 64ms flush when sustained >100 msg/s
  const spawnedManaged = agents.get(agentState.id)
  if (spawnedManaged) {
    spawnedManaged.ipcRateInterval = setInterval(() => {
      const m = agents.get(agentState.id)
      if (!m) return
      if (m.ipcRateCount > 100) {
        m.ipcHighRateSeconds++
      } else {
        m.ipcHighRateSeconds = 0
      }
      m.ipcRateCount = 0
      if (m.ipcHighRateSeconds >= 3) {
        m.ipcBatchInterval = 64
      } else if (m.ipcHighRateSeconds === 0 && m.ipcBatchInterval === 64) {
        m.ipcBatchInterval = 16
      }
    }, 1000)
  }

  emitToAllRenderers(IPC_EVENTS.AGENTS.SPAWNED, agentState)
  emitToAllRenderers(IPC_EVENTS.AGENTS.STATUS_CHANGE, agentState.id, 'busy', 'inferred')
  emitTriageResult(agentState, previousStatusOnSpawn)

  // S1: defer non-critical DB writes so the renderer receives SPAWNED immediately
  setImmediate(() => {
    updateRepoLastUsed(db, repoId)
    insertActivityEvent(db, {
      eventType: 'agent_spawned',
      entityType: 'agent',
      entityId: agentState.id,
      repoId: agentState.repoId,
      agentId: agentState.id,
      details: { name: agentState.name, model: agentState.model, provider: agentState.provider }
    })
  })

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
    modelName = `${modelName}:cloud`
  }
  const safeModelName = modelName ? modelName.replace(/'/g, "'\\''") : ''
  const modelFlag = safeModelName ? ` --model '${safeModelName}'` : ''
  const effortFlag = agentState.effortLevel ? ` --effort ${agentState.effortLevel}` : ''
  const permFlag = options.skipPermissions ? ' --dangerously-skip-permissions' : ''
  // Auto-allow send_telegram MCP tool when telegramNotify is enabled so agent can
  // report without being blocked by an approval prompt the user can't reach remotely.
  const telegramToolFlag = agentState.telegramNotify ? " --allowedTools 'mcp__agenthub-telegram__send_telegram'" : ''

  const repoName = options.cwd.split('/').pop() ?? options.cwd
  const mcpConfigPath = writeMcpConfig(agentState.id, agentState.name, repoName)
  const mcpFlag = mcpConfigPath ? ` --mcp-config '${mcpConfigPath}'` : ''

  // Inject agenthub plugin and skills index into every spawned agent session.
  // --plugin-dir loads the plugin (hooks + skills + commands) for this session only.
  // --append-system-prompt-file appends the skills index to the system prompt.
  // Both paths are resolved dynamically so they work in dev and packaged builds.
  const pluginDir = app.isPackaged
    ? join(process.resourcesPath, 'plugin')
    : join(app.getAppPath(), 'plugin')
  const pluginFlag = ` --plugin-dir '${pluginDir}'`
  const skillsIndexPath = join(pluginDir, 'skills', 'index.md')
  // S2: cache result — skills index path is static for the process lifetime
  if (skillsIndexExists === null) {
    skillsIndexExists = existsSync(skillsIndexPath)
  }
  const appendSkillsFlag = skillsIndexExists
    ? ` --append-system-prompt-file '${skillsIndexPath}'`
    : ''
  // S27: inject guard policy — loaded after skills index so it takes precedence
  const guardPath = join(pluginDir, 'guard.md')
  if (guardExists === null) {
    guardExists = existsSync(guardPath)
  }
  // S32: verify guard.md has not been emptied or tampered — must contain the refusal phrase
  if (guardExists) {
    const guardContent = readFileSync(guardPath, 'utf-8')
    if (!guardContent.includes('I cannot assist with that request')) {
      log.error('S32: guard.md integrity check failed — file may have been tampered with', { guardPath })
      throw new Error('Security violation: plugin/guard.md has been modified or emptied. Restore it before spawning agents.')
    }
  }
  const appendGuardFlag = guardExists
    ? ` --append-system-prompt-file '${guardPath}'`
    : ''
  // S2: emit SKILL_INJECT_SKIPPED when index is absent but a skill was requested
  if (appendSkillsFlag === '' && options.taskDescription && options.taskDescription.trim().length > 0) {
    emitToAllRenderers(IPC_EVENTS.AGENTS.SKILL_INJECT_SKIPPED, agentState.id)
  }

  // S46: When CWD differs from agenthub, Claude CLI won't auto-discover agenthub's
  // project CLAUDE.md (it walks up from CWD). Inject it explicitly so agents always
  // get the full instruction layer (team rules, behavioral guardrails, coding standards,
  // destructive command ban, etc.) regardless of which repo they work in.
  const cwdNormalized = options.cwd.replace(/\/+$/, '')
  const agenthubNormalized = agenthubRoot.replace(/\/+$/, '')
  const isWorkingInAgenthub = cwdNormalized === agenthubNormalized
  const agenthubClaudeMdPath = join(agenthubRoot, '.claude', 'CLAUDE.md')
  const appendAgenthubRulesFlag = !isWorkingInAgenthub && existsSync(agenthubClaudeMdPath)
    ? ` --append-system-prompt-file '${agenthubClaudeMdPath}'`
    : ''

  // S47: When CWD differs from agenthub, inject cross-repo context so agents know
  // where to find skills, team configs, and workflow manifests (they live in agenthub).
  const crossRepoContextPath = join(pluginDir, 'cross-repo-context.md')
  const appendCrossRepoFlag = !isWorkingInAgenthub && existsSync(crossRepoContextPath)
    ? ` --append-system-prompt-file '${crossRepoContextPath}'`
    : ''

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
        ? '\n\nTelegram is ON — communicate via send_telegram only. Do NOT write status updates or summaries to the terminal. Keep terminal output to essential work artifacts only (code, diffs, errors). When done, send_telegram a short bullet-point summary. If you need approval or have a question, also send_telegram.'
        : ''
      // Escape for single quotes to prevent shell metacharacter injection (backticks, $(), etc.)
      const escapedTask = (task + telegramSuffix).replace(/'/g, "'\\''")
      // Do NOT use -p flag — it requires an API key and fails with OAuth/subscription auth.
      // Instead launch interactive claude and send the task as the first prompt.
      const cmd = `clear; claude${modelFlag}${effortFlag}${permFlag}${telegramToolFlag}${mcpFlag}${pluginFlag}${appendSkillsFlag}${appendGuardFlag}${appendAgenthubRulesFlag}${appendCrossRepoFlag} -- '${escapedTask}'\n`
      ptyProcess.write(cmd)
      // S24: log metadata only — never log full cmd string (reveals plugin paths + task content)
      log.info('Sent command to PTY', { id: agentState.id, model: modelName, provider: agentState.provider, effort: agentState.effortLevel, hasPlugin: !!pluginFlag, hasSkills: !!appendSkillsFlag, hasGuard: !!appendGuardFlag, hasAgenthubRules: !!appendAgenthubRulesFlag, hasCrossRepo: !!appendCrossRepoFlag, hasMcp: !!mcpFlag, hasTelegram: !!telegramToolFlag, taskLength: task?.length ?? 0 })
    }, 500)
  } else {
    setTimeout(() => {
      const cmd = `clear; claude${modelFlag}${effortFlag}${permFlag}${telegramToolFlag}${mcpFlag}${pluginFlag}${appendSkillsFlag}${appendGuardFlag}${appendAgenthubRulesFlag}${appendCrossRepoFlag}\n`
      ptyProcess.write(cmd)
      // S24: log metadata only
      log.info('Sent command (interactive) to PTY', { id: agentState.id, model: modelName, provider: agentState.provider, effort: agentState.effortLevel, hasPlugin: !!pluginFlag, hasGuard: !!appendGuardFlag, hasAgenthubRules: !!appendAgenthubRulesFlag, hasCrossRepo: !!appendCrossRepoFlag })
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
    if (data.includes('\r')) {
      managed.hasNotifiedCompletion = false
    }
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
      if (m) {
        m.ptyProcess.write('\r')
        // Delayed reset: clear any prompt echo that accumulated after the PTY write
        // but before the agent transitions to busy. Without this, the echo leaks
        // into the TTS buffer because the busy transition (which normally resets the
        // buffer) hasn't been detected yet.
        setTimeout(() => {
          const m2 = agents.get(agentId)
          if (m2) m2.cleanTextBuffer = ''
        }, 100)
      }
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
      cancelSilentLockTimer(agentId)
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
      cancelSilentLockTimer(agentId)
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

/** Return the agent's accumulated output for orchestrator (ANSI-stripped, never reset by TTS). */
export function getAgentOutput(agentId: string): string | null {
  const managed = agents.get(agentId)
  return managed?.orchestratorBuffer ?? null
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

export function updateAgentTelegramNotify(agentId: string, enabled: boolean): void {
  const managed = agents.get(agentId)
  if (managed) {
    managed.state.telegramNotify = enabled
  }
  log.info('Agent telegramNotify toggled', { id: agentId, enabled })
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

// S1: exported so db.ipc.ts can invalidate the cache on repo deletion
export function clearRepoPathCache(): void {
  repoPathCache.clear()
}

export function cleanupAllAgents(): void {
  ptyProxy.stopAll()
  for (const [id, managed] of agents) {
    try {
      if (managed.flushTimer) clearTimeout(managed.flushTimer)
      if (managed.ipcBatchTimer) clearTimeout(managed.ipcBatchTimer)
      if (managed.ipcRateInterval) clearInterval(managed.ipcRateInterval)
      if (managed.silentLockTimer) clearTimeout(managed.silentLockTimer)
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
