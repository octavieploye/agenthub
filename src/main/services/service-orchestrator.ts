import { app, BrowserWindow, Notification } from 'electron'
import { emitToAllRenderers } from '../utils/emit-to-all-renderers'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { SnapshotEngine } from './snapshot-engine'
import type { WorkspaceStateProvider } from './snapshot-engine'
import { ClaudeMonitor } from './claude-monitor'
import { HealthMonitor } from './health-monitor'
import { GuardrailsManager } from './guardrails-manager'
import { AutoPauseService } from './auto-pause'
import { TrayManager } from './tray-manager'
import { GitService } from './git-service'
import { FsService } from './fs-service'
import { initBrainScanner } from './brain-scanner'
import { getAllRepos, getRepoById } from '../db/queries/repos.queries'
import { SkillsService } from './skills-service'
import { WindowManager } from './window-manager'
import { SettingsService } from './settings-service'
import { VoiceService } from './voice-service'
import { PiperService } from './piper-service'
import { DockerService } from './docker-service'
import { ContainerManager } from './container-manager'
import type { IAnamnesisAdapter } from './adapters/anamnesis-adapter'
import type { IForgejoAdapter } from './adapters/forgejo-adapter'
import { resolveAppMode, createAnamnesisAdapter, createForgejoAdapter } from './adapters/adapter-factory'
import { initAnamnesisReader } from './anamnesis-reader'
import { SprintWatcher } from './sprint-watcher'
import { TokenBudgetTracker } from './token-budget'
import { TelegramSidecarService } from './telegram-sidecar-service'
import { TelegramSocketServer } from './telegram-socket-server'
import { TelegramQueueProcessor } from './telegram-queue-processor'
import { OrchestratorScheduler, type SchedulerDeps } from './orchestrator-scheduler'
import { OrchestratorBrain, type BrainConfig } from './orchestrator-brain'
import { OrchestratorValidator } from './orchestrator-validator'
import { McpBridgeHandler, type BridgeDeps } from './mcp-bridge-handler'
import { QuotaScrapeScheduler } from './quota-scrape-scheduler'
import type { TelegramFromSidecarMsg, TelegramSocketStatus } from '../../shared/types/telegram.types'
import { getTelegramAllowedUser } from '../db/queries/telegram.queries'
import { listAgents, pauseAgent, killAgent, cleanupAllAgents, setPtyOwner, clearPtyOwner, sendInput, setTelegramNotifier, setTelegramAgentSync, spawnAgent, resumeAgent, respawnAgent, setLastMcpTelegramAt, getAgentOutput, isAgentAlive, getAgentLastOutputTime, setMcpServerInfo } from './agent-manager'
import { installClaudePlugin } from './plugin-installer'
import { setShutdownReason } from '../shutdown-reason'
import { purgeDeadAgents, resetStaleAgentsOnStartup } from '../db/queries/agents.queries'
import { createSession, detectPreviousSessionState } from '../db/queries/sessions.queries'
import { cleanupOldRetryFailures, getRun, getTaskLogsByRun } from '../db/queries/orchestrator.queries'
import { parseJsonlContent, extractUsageEntries } from '../parsers/jsonl-parser'
import { setSnapshotEngine } from '../ipc/snapshots.ipc'
import type { GuardrailConfig } from '../../shared/types/config.types'
import { DEFAULT_GUARDRAILS } from '../../shared/types/config.types'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'
import { loadAnamnesisSecret } from './secret-store'
import { registerWindowManager, registerAnamnesisWriter, registerTelegramSocketPathFn, registerCurrentSessionId } from './service-registry'

let snapshotEngine: SnapshotEngine | null = null
let claudeMonitor: ClaudeMonitor | null = null
let healthMonitor: HealthMonitor | null = null
let guardrailsManager: GuardrailsManager | null = null
let autoPauseService: AutoPauseService | null = null
let trayManager: TrayManager | null = null
let gitService: GitService | null = null
let fsService: FsService | null = null
let skillsService: SkillsService | null = null
let windowManager: WindowManager | null = null
let settingsService: SettingsService | null = null
let voiceService: VoiceService | null = null
let piperService: PiperService | null = null
let dockerService: DockerService | null = null
let containerManager: ContainerManager | null = null
let anamnesisWriter: IAnamnesisAdapter | null = null
let forgejoAdapter: IForgejoAdapter | null = null
let sprintWatcher: SprintWatcher | null = null
let telegramSidecarService: TelegramSidecarService | null = null
let telegramSocketServer: TelegramSocketServer | null = null
let telegramQueueProcessor: TelegramQueueProcessor | null = null
let orchestratorScheduler: OrchestratorScheduler | null = null
let mcpBridgeHandler: McpBridgeHandler | null = null
let quotaScrapeScheduler: QuotaScrapeScheduler | null = null
let intakeDir = ''
let currentSessionId: string | null = null

export function getCurrentSessionId(): string | null {
  return currentSessionId
}

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows[0] ?? null
}

function handleTelegramCommand(db: Database.Database, msg: TelegramFromSidecarMsg): void {
  if (msg.type !== 'command') return
  switch (msg.command) {
    case 'get_status': {
      const agents = listAgents().map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        repo: a.cwd.split('/').pop() ?? a.cwd,
      }))
      telegramSidecarService?.sendAgentList(agents)
      break
    }
    case 'get_repos': {
      const repos = getAllRepos(db).map(r => ({
        name: r.name ?? r.path.split('/').pop() ?? r.path,
        path: r.path,
      }))
      telegramSidecarService?.sendRepoList(repos)
      break
    }
    case 'send_task':
      sendInput(msg.agentId, msg.message + '\r')
      break
    case 'pause':
      pauseAgent(msg.agentId)
      break
    case 'stop':
      killAgent(msg.agentId)
      break
    case 'approve':
      if (msg.requestId.startsWith('task:')) {
        const parts = msg.requestId.split(':')
        try {
          orchestratorScheduler?.approveTaskDispatch(parts[2], parts[1], true)
          telegramSidecarService?.sendApprovalResult(msg.requestId, 'approved')
        } catch (err) {
          log.warn('handleTelegramCommand: approveTaskDispatch failed', { requestId: msg.requestId, err: String(err) })
        }
      } else {
        sendInput(msg.requestId, 'y\r', { isSystemAction: true })
      }
      break
    case 'deny':
      if (msg.requestId.startsWith('task:')) {
        const parts = msg.requestId.split(':')
        try {
          orchestratorScheduler?.approveTaskDispatch(parts[2], parts[1], false)
          telegramSidecarService?.sendApprovalResult(msg.requestId, 'denied')
        } catch (err) {
          log.warn('handleTelegramCommand: approveTaskDispatch failed', { requestId: msg.requestId, err: String(err) })
        }
      } else {
        sendInput(msg.requestId, 'n\r', { isSystemAction: true })
      }
      break
    case 'spawn_agent': {
      const allRepos = getAllRepos(db)
      const repo = allRepos.find((r) => r.path === msg.repo)
      if (!repo) {
        log.warn('Telegram spawn_agent: unregistered repo rejected', { repo: msg.repo })
        break
      }
      try {
        spawnAgent({
          repoId: repo.id,
          name: msg.name,
          cwd: repo.path,
          taskDescription: msg.task,
        })
      } catch (err) {
        log.error('Telegram spawn_agent failed', { err })
      }
      break
    }
    case 'resume':
      try {
        resumeAgent(msg.agentId)
      } catch (err) {
        log.error('Telegram resume failed', { agentId: msg.agentId, err })
      }
      break
    case 'respawn':
      try {
        respawnAgent(msg.agentId)
      } catch (err) {
        log.error('Telegram respawn failed', { agentId: msg.agentId, err })
      }
      break
  }
}

/**
 * Counts tokens consumed during a specific orchestrator run by scanning
 * Claude CLI's JSONL session files in the run's project directory and
 * summing entries whose timestamp falls within the run's time window.
 *
 * JSONL files live at ~/.claude/projects/{sanitised-repo-path}/*.jsonl
 * where the sanitised path replaces '/' with '-'.
 */
function computeRunTokenUsage(db: Database.Database, runId: string): number {
  const run = getRun(db, runId)
  if (!run?.startedAt) return 0

  // Resolve the repo path so we can find the correct JSONL project subdirectory
  const repo = getRepoById(db, run.repoId)
  if (!repo?.path) return 0

  const sanitised = repo.path.replace(/\//g, '-')
  const projectDir = join(homedir(), '.claude', 'projects', sanitised)
  if (!existsSync(projectDir)) return 0

  const startMs = new Date(run.startedAt).getTime()
  const endMs = run.completedAt ? new Date(run.completedAt).getTime() : Date.now()
  let total = 0

  try {
    for (const name of readdirSync(projectDir)) {
      if (!name.endsWith('.jsonl')) continue
      try {
        const content = readFileSync(join(projectDir, name), 'utf-8')
        for (const entry of extractUsageEntries(parseJsonlContent(content))) {
          const t = entry.timestamp ? new Date(entry.timestamp).getTime() : NaN
          if (isNaN(t) || t < startMs || t > endMs) continue
          const u = entry.message.usage
          // Count only output_tokens — input_tokens grow with conversation history
          // (bash tool results like npm install stdout inflate input_tokens per turn)
          if (u) total += u.output_tokens
        }
      } catch {
        // Skip unreadable file — non-fatal
      }
    }
  } catch {
    return 0
  }

  return total
}

export function initializeServices(db: Database.Database): void {
  // Install Claude Code plugin — non-blocking, best-effort.
  // Runs before any agent can be spawned (agents require user interaction post-startup).
  installClaudePlugin().catch((err) => log.warn('Claude plugin install failed', { err }))

  // Reset stale agents FIRST so they become 'interrupted' before the purge runs.
  // Without this ordering, agents stuck in 'busy'/'idle' escape the 24h purge window.
  resetStaleAgentsOnStartup(db)
  // Now purge dead agents (completed/interrupted) older than 24h
  purgeDeadAgents(db, 24)
  // Clean up acknowledged retry failures older than 30 days
  cleanupOldRetryFailures(db)

  // Session tracking — detect previous session state and start a new one
  const prevSession = detectPreviousSessionState(db)
  if (prevSession) {
    log.info('Previous session detected', { id: prevSession.id, closeReason: prevSession.closeReason })
  }
  currentSessionId = createSession(db)
  registerCurrentSessionId(currentSessionId)
  registerTelegramSocketPathFn(() => telegramSocketServer?.getSocketPath() ?? null)
  // 1. GuardrailsManager — standalone, no deps
  guardrailsManager = new GuardrailsManager({
    readFile: (path: string) => {
      try {
        return readFileSync(path, 'utf-8')
      } catch {
        return null
      }
    },
    writeFile: (path: string, content: string) => {
      writeFileSync(path, content, 'utf-8')
    },
    logInfo: (message: string, meta?: Record<string, unknown>) => {
      log.info(message, meta)
    }
  })

  // 2. AutoPauseService — depends on agent-manager + notification
  autoPauseService = new AutoPauseService({
    pauseAgent: (agentId: string) => {
      try {
        pauseAgent(agentId)
      } catch (err) {
        log.warn('AutoPause: failed to pause agent', { agentId, err })
      }
    },
    sendNotification: (title: string, body: string) => {
      if (Notification.isSupported()) {
        new Notification({ title, body }).show()
      }
    },
    emitToRenderer: emitToAllRenderers,
    logWarning: (message: string, meta?: Record<string, unknown>) => {
      log.warn(message, meta)
    }
  })

  // 3. HealthMonitor — depends on GuardrailsManager + AutoPauseService
  healthMonitor = new HealthMonitor({
    getGuardrails: (_agentId: string): GuardrailConfig => {
      // TODO: map agentId to repoPath once agent→repo mapping is richer
      return guardrailsManager?.getGuardrails('.') ?? { ...DEFAULT_GUARDRAILS }
    },
    onAnomaly: (anomaly) => {
      autoPauseService?.handleAnomaly(anomaly)
    },
    logWarning: (message: string, meta?: Record<string, unknown>) => {
      log.warn(message, meta)
    }
  })

  // 4. SnapshotEngine — depends on DB + workspace state provider
  const stateProvider: WorkspaceStateProvider = {
    getAgents: () => listAgents(),
    getActiveAgentId: () => null, // main process doesn't track UI selection
    getViewMode: () => 'raid',
    getSoundEnabled: () => true,
    getFocusedAgentId: () => null,
    getStatusFilter: () => null,
    getAppVersion: () => app.getVersion()
  }

  snapshotEngine = new SnapshotEngine(db, stateProvider)
  setSnapshotEngine(snapshotEngine)

  // 5. ClaudeMonitor — standalone
  claudeMonitor = new ClaudeMonitor()

  // 6. TrayManager — depends on app/window callbacks
  trayManager = new TrayManager({
    onOpenApp: () => {
      const win = getMainWindow()
      if (win) {
        win.show()
        win.focus()
      }
    },
    onKillAll: () => {
      setShutdownReason('tray-kill-all')
      cleanupAllAgents()
      app.quit()
    },
    onKillAgent: (agentId: string) => {
      try {
        killAgent(agentId)
      } catch (err) {
        log.error('TrayManager: failed to kill agent', { agentId, err })
      }
    },
    getActiveAgents: () => {
      return listAgents()
        .filter((a) => !['completed', 'interrupted'].includes(a.status))
        .map((a) => ({ id: a.id, name: a.name }))
    }
  })

  // 7. GitService — standalone, uses child_process
  gitService = new GitService({
    logInfo: (message: string, meta?: Record<string, unknown>) => {
      log.info(message, meta)
    },
    logWarning: (message: string, meta?: Record<string, unknown>) => {
      log.warn(message, meta)
    }
  })

  // 7a. BrainScannerService — depends on GitService for timeline merging
  initBrainScanner(gitService)

  // Brain scanner auto-discovers on query — no watcher needed

  // 7b. FsService — filesystem browsing scoped to repo paths
  fsService = new FsService({
    logInfo: (message: string, meta?: Record<string, unknown>) => {
      log.info(message, meta)
    },
    logWarning: (message: string, meta?: Record<string, unknown>) => {
      log.warn(message, meta)
    },
    getAllRepoPaths: () => {
      try {
        return getAllRepos(db).map((r) => r.path)
      } catch {
        return []
      }
    }
  })

  // 8. SkillsService — standalone, scans for skill files
  skillsService = new SkillsService({
    logInfo: (message: string, meta?: Record<string, unknown>) => {
      log.info(message, meta)
    },
    logWarning: (message: string, meta?: Record<string, unknown>) => {
      log.warn(message, meta)
    },
    agenthubPath: app.isPackaged
      ? join(app.getAppPath(), '..')
      : process.cwd()
  })

  // 9. WindowManager — creates/tracks breakout terminal windows
  windowManager = new WindowManager({
    logInfo: (message: string, meta?: Record<string, unknown>) => {
      log.info(message, meta)
    },
    emitToAllRenderers,
    onBreakoutOpened: (agentId, webContentsId) => setPtyOwner(agentId, webContentsId),
    onBreakoutClosed: (agentId) => clearPtyOwner(agentId)
  })
  registerWindowManager(windowManager)

  // 10. SettingsService — app-level settings persistence
  settingsService = new SettingsService(db, {
    logInfo: (message: string, meta?: Record<string, unknown>) => {
      log.info(message, meta)
    }
  })

  // 10b. QuotaScrapeScheduler — periodic quota scraping (1st + 15th of month)
  quotaScrapeScheduler = new QuotaScrapeScheduler(
    settingsService,
    async () => {
      log.info('[quota-scheduler] Scrape callback triggered — scrapers not yet wired')
    }
  )

  // 11. VoiceService — speech-to-text sidecar manager, no deps
  voiceService = new VoiceService({
    logInfo: (message: string, meta?: Record<string, unknown>) => {
      log.info(message, meta)
    },
    binaryPath: app.isPackaged
      ? require('path').join(process.resourcesPath, 'bin', 'whisper-cli')
      : require('path').join(process.cwd(), 'resources', 'bin', 'whisper-cli'),
    modelPath: require('path').join(app.getPath('userData'), 'models', 'ggml-small.bin'),
    getMicStatus: () => {
      const { systemPreferences } = require('electron')
      return systemPreferences.getMediaAccessStatus('microphone')
    }
  })

  // 12. PiperService — Piper TTS sidecar, no deps
  piperService = new PiperService({
    logInfo: (message: string, meta?: Record<string, unknown>) => {
      log.info(message, meta)
    },
    binaryPath: app.isPackaged
      ? require('path').join(process.resourcesPath, 'bin', 'piper')
      : require('path').join(process.cwd(), 'resources', 'bin', 'piper'),
    voicesDir: app.isPackaged
      ? require('path').join(process.resourcesPath, 'voices')
      : require('path').join(process.cwd(), 'resources', 'voices'),
  })
  // TTS handlers now registered in register-all.ts

  // 13. DockerService — Docker availability detection and image management
  dockerService = new DockerService({
    logInfo: (message: string, meta?: Record<string, unknown>) => {
      log.info(message, meta)
    },
    logWarning: (message: string, meta?: Record<string, unknown>) => {
      log.warn(message, meta)
    }
  })

  // 13. ContainerManager — per-repo Docker container lifecycle + TTL cleanup
  containerManager = new ContainerManager({
    logInfo: (message: string, meta?: Record<string, unknown>) => {
      log.info(message, meta)
    },
    logWarning: (message: string, meta?: Record<string, unknown>) => {
      log.warn(message, meta)
    }
  })
  containerManager.init(db).catch((err) => {
    log.error('ContainerManager init failed', err)
    containerManager = null
  })

  // 15. Anamnesis + Forgejo adapters — null in standalone, real in system mode
  const appMode = resolveAppMode()
  const anamnesisUrl = process.env['ANAMNESIS_URL'] ?? 'http://localhost:9300'
  anamnesisWriter = createAnamnesisAdapter(appMode, db, { anamnesisUrl })
  registerAnamnesisWriter(anamnesisWriter)
  anamnesisWriter.flush().catch((err) => log.warn('Anamnesis startup flush failed (server likely not running)', err))

  // 15a. AnamnesisReader — lifecycle data reader (system mode only)
  // NOTE: This reader is INTERNAL to the main process. It is NOT exposed to agents
  // via MCP tools. Agents access Anamnesis through the separate anamnesis MCP server
  // (registered in .claude/settings.json). This reader serves orchestrator-level queries
  // such as sprint_inventory pre-flight checks (M4) and lifecycle dashboard data.
  if (appMode === 'system') {
    const authSecret = loadAnamnesisSecret()
    initAnamnesisReader({ baseUrl: anamnesisUrl, authSecret, caller: 'hephaestus' })
  }

  const forgejoUrl = process.env['FORGEJO_URL'] ?? 'http://localhost:3000'
  const forgejoToken = process.env['FORGEJO_TOKEN'] ?? ''
  forgejoAdapter = createForgejoAdapter(appMode, { baseUrl: forgejoUrl, token: forgejoToken })

  // 16. SprintWatcher — watches sprint-intake dir + repo docs/sprints/json/ for new sprint JSON files
  intakeDir = join(app.getPath('userData'), 'sprint-intake')
  const sprintDirs: string[] = [intakeDir]
  if (!app.isPackaged) {
    const repoSprintsDir = join(process.cwd(), 'docs', 'sprints', 'json')
    if (existsSync(repoSprintsDir)) sprintDirs.push(repoSprintsDir)
  }
  sprintWatcher = new SprintWatcher()
  // Wire sprint-card enricher if skillsService is available
  if (skillsService) {
    const budgetTracker = new TokenBudgetTracker(db)
    sprintWatcher.setEnricher(SprintWatcher.createEnricher(skillsService, budgetTracker))
  }
  sprintWatcher.start(sprintDirs, emitToAllRenderers, db)

  // 17. TelegramSidecarService — Telegram bot child process
  const scriptPath = app.isPackaged
    ? require('path').join(process.resourcesPath, 'telegram-sidecar', 'index.js')
    : require('path').join(process.cwd(), 'src', 'main', 'telegram-sidecar', 'index.js')

  telegramSidecarService = new TelegramSidecarService({
    scriptPath,
    nodePath: process.execPath,
    db,
    logInfo: (msg, meta) => log.info(msg, meta),
    logError: (msg, meta) => log.error(msg, meta),
    onBlockedSender: (userId) => {
      emitToAllRenderers(IPC_EVENTS.TELEGRAM.BLOCKED_SENDER, { telegramUserId: userId })
    },
    onFirstContact: (_userId, _chatId) => {
      emitToAllRenderers(IPC_EVENTS.TELEGRAM.FIRST_CONTACT_LINKED, {})
    },
    onCommand: (msg) => {
      if (msg.type !== 'command') return
      handleTelegramCommand(db, msg)
    },
    onReady: () => {
      // Push current agent list as soon as sidecar is ready
      const agents = listAgents().map(a => ({
        id: a.id, name: a.name, status: a.status,
        repo: a.cwd.split('/').pop() ?? a.cwd,
      }))
      telegramSidecarService?.sendAgentList(agents)

      if (!telegramSocketServer) {
        telegramSocketServer = new TelegramSocketServer({
          notify: (payload) => telegramSidecarService?.notify(payload),
          queueFallback: (payload) => telegramQueueProcessor?.enqueue(payload),
          onMcpMessage: (agentId) => setLastMcpTelegramAt(agentId),
          logInfo: (msg, meta) => log.info(msg, meta),
          logError: (msg, meta) => log.error(msg, meta),
        })
      }
      const sockPath = join(app.getPath('userData'), 'telegram.sock')
      void telegramSocketServer.start(sockPath).catch((err) => {
        log.error('Telegram socket unavailable after sidecar startup', {
          error: String(err),
          ...telegramSocketServer?.getStatus(),
        })
      })
    },
  })

  // Queue processor only needs db — construct before setTelegramNotifier so enqueue works immediately
  telegramQueueProcessor = new TelegramQueueProcessor({
    db,
    notify: (payload) => {
      if (!telegramSidecarService?.isRunning()) {
        throw new Error('Telegram sidecar not running')
      }
      telegramSidecarService.notify(payload)
    },
    logInfo: (msg, meta) => log.info(msg, meta),
    logError: (msg, meta) => log.error(msg, meta),
  })
  telegramQueueProcessor.start()

  // Inject telegram notifier into agent-manager (avoids circular import)
  setTelegramNotifier((payload) => {
    telegramQueueProcessor?.enqueue(payload)
  })

  // Keep sidecar agent cache in sync on every agent status change
  setTelegramAgentSync(() => {
    if (!telegramSidecarService?.isRunning()) return
    const agents = listAgents().map(a => ({
      id: a.id, name: a.name, status: a.status,
      repo: a.cwd.split('/').pop() ?? a.cwd,
    }))
    telegramSidecarService.sendAgentList(agents)
  })

  // Auto-start if token is saved (user connected before)
  const existingTelegramUser = getTelegramAllowedUser(db)
  if (existingTelegramUser) {
    telegramSidecarService.start().then(() => {
      telegramSidecarService!.sendUser(existingTelegramUser.telegram_user_id, existingTelegramUser.chat_id)
    }).catch((err) => {
      log.warn('Telegram sidecar auto-start failed (token may not be stored)', err)
    })
  }

  // 18. OrchestratorScheduler — new modular sprint execution engine
  const sendTelegramNotification = (summary: string, type: 'completed' | 'failed'): void => {
    const msgKey = `orchestrator:${summary.slice(0, 40).replace(/\s+/g, '-').replace(/[^a-z0-9:-]/gi, '').toLowerCase()}`
    telegramQueueProcessor?.enqueue({
      type,
      agentId: msgKey,
      agentName: 'Orchestrator',
      repo: '',
      summary: summary.slice(0, 200),
      timestamp: new Date().toISOString(),
    })
  }

  // Brain config — uses local Ollama by default; cloud endpoint can be overridden via env
  const brainConfig: BrainConfig = {
    provider: 'ollama-local',
    model: process.env['ORCHESTRATOR_BRAIN_MODEL'] ?? 'qwen3:8b',
    endpoint: (process.env['OLLAMA_URL'] ?? 'http://localhost:11434') + '/api/chat',
    timeoutMs: 30_000,
  }

  const brain = new OrchestratorBrain(brainConfig)
  const validator = new OrchestratorValidator()

  const schedulerDeps: SchedulerDeps = {
    db,
    brain: {
      decide: async (context) => {
        // Bridge: translate scheduler BrainContext → OrchestratorBrain BrainContext
        const brainContext = {
          readyTasks: context.candidateTasks.map(t => ({
            id: t.id,
            description: t.description ?? t.title,
            category: t.category ?? 'general',
            priority: t.priority,
            repo: t.repoId,
            skill: t.skills?.[0] ?? null,
            blockedBy: t.blockedBy ?? [],
          })),
          activeAgentCount: context.activeLogs.length,
          recentOutcomes: getTaskLogsByRun(db, context.run.id)
            .filter(l => l.status === 'done' || l.status === 'failed')
            .map(l => ({
              taskId: l.taskId,
              status: (l.status === 'done' ? 'completed' : 'failed') as 'completed' | 'failed',
              skill: null,
            })),
        }
        const brainDecision = await brain.decide(brainContext)
        if (!brainDecision) return null
        // Bridge: translate OrchestratorBrain BrainDecision → scheduler BrainDecision
        const task = context.candidateTasks.find(t => t.id === brainDecision.taskId)
        if (!task) return null
        const repoId = task.repoId
        const repo = getRepoById(db, repoId)
        if (!repo?.path) {
          log.warn('Orchestrator brain bridge: repo not found or has no path', { taskId: brainDecision.taskId, repoId })
          return null
        }
        return {
          taskId: brainDecision.taskId,
          spawnOptions: {
            repoId,
            name: `orchestrator-${brainDecision.taskId.slice(0, 8)}`,
            cwd: repo.path,
            model: brainDecision.model,
            taskDescription: task.description ?? task.title,
            projectId: task.projectId ?? undefined,
          },
          reason: brainDecision.reason,
        }
      },
    },
    validator: {
      validate: (decision, run) => {
        // Bridge: translate scheduler validate signature → OrchestratorValidator.validate signature
        const activeLogs = [] as unknown[]  // scheduler handles budget tracking itself
        const validatorContext = {
          db,
          // Rate limiter and budget are already gated in scheduler.tick() before reaching
          // the validator — these stubs avoid double-consumption of the same window.
          rateLimiter: { tryAcquire: () => true } as Parameters<typeof validator.validate>[1]['rateLimiter'],
          maxAgents: schedulerDeps.maxAgents,
          currentAgentCount: activeLogs.length,
          runId: run.id,
          agenthubPath: app.isPackaged ? join(app.getAppPath(), '..') : process.cwd(),
        }
        const outcome = validator.validate(
          { taskId: decision.taskId, skill: '', model: decision.spawnOptions.model ?? '', reason: decision.reason },
          validatorContext
        )
        if (!outcome.valid) {
          return { valid: false, failures: outcome.failures }
        }
        return { valid: true, failures: [] }
      },
    },
    dispatch: {
      execute: (spawnOptions, taskId, runId) => {
        // Spawn only — the scheduler inserts task log + emits TASK_PHASE_CHANGE itself.
        try {
          const agentState = spawnAgent(spawnOptions)
          return agentState.id
        } catch (err) {
          log.error('Orchestrator dispatch spawn failed', { taskId, runId, err })
          return null
        }
      },
    },
    emitToRenderer: emitToAllRenderers,
    maxAgents: 50,
  }

  orchestratorScheduler = new OrchestratorScheduler(schedulerDeps)

  // Startup recovery: fix orphaned tasks and stale runs from previous crashes
  const recovery = orchestratorScheduler.recoverOrphanedState()
  if (recovery.staleRuns > 0 || recovery.orphanedTasks > 0) {
    sendTelegramNotification(
      `Orchestrator recovery: ${recovery.staleRuns} stale runs failed, ${recovery.orphanedTasks} orphaned tasks reset to backlog`,
      'failed'
    )
  }

  // 19. McpBridgeHandler — AgentHub Kanban MCP Unix-socket bridge
  const bridgeDeps: BridgeDeps = {
    db,
    scheduler: {
      start: (input) => orchestratorScheduler!.start(input as Parameters<OrchestratorScheduler['start']>[0]),
      startSingleTask: (input) => orchestratorScheduler!.startSingleTask(input as Parameters<OrchestratorScheduler['startSingleTask']>[0]),
      approveTaskDispatch: (runId, taskId, approved) => orchestratorScheduler!.approveTaskDispatch(runId, taskId, approved),
    },
  }
  mcpBridgeHandler = new McpBridgeHandler(bridgeDeps)
  mcpBridgeHandler.start()
  // Publish socket path + token to agent-manager so agents can reach the MCP bridge
  setMcpServerInfo(mcpBridgeHandler.socketPath, mcpBridgeHandler.token)
  log.info('MCP bridge handler started', { socketPath: mcpBridgeHandler.socketPath })

  log.info('All services initialized')
}

export function startServices(): void {
  snapshotEngine?.start()
  claudeMonitor?.start().catch((err) => log.error('ClaudeMonitor start failed', err))
  healthMonitor?.startWatchdog()
  autoPauseService?.startReminderTimer()
  quotaScrapeScheduler?.start()
  log.info('All periodic services started')
}

export function stopServices(): void {
  snapshotEngine?.stop()
  claudeMonitor?.stop()
  healthMonitor?.stopWatchdog()
  autoPauseService?.stopReminderTimer()
  windowManager?.closeAll()
  trayManager?.destroy()
  voiceService?.dispose()
  piperService = null
  containerManager?.stopAll().catch((err) => log.error('ContainerManager stopAll failed', err))
  sprintWatcher?.stop()
  quotaScrapeScheduler?.stop()
  quotaScrapeScheduler = null
  telegramQueueProcessor?.stop()
  telegramQueueProcessor = null
  telegramSocketServer?.stop()
  telegramSocketServer = null
  telegramSidecarService?.stop()
  orchestratorScheduler?.stop()
  orchestratorScheduler = null
  mcpBridgeHandler?.stop()
  mcpBridgeHandler = null
  setMcpServerInfo('', '')
  setTelegramNotifier(null)
  setTelegramAgentSync(null)
  log.info('All services stopped')
}

export function getClaudeMonitor(): ClaudeMonitor | null {
  return claudeMonitor
}

export function getTrayManager(): TrayManager | null {
  return trayManager
}

export function getHealthMonitor(): HealthMonitor | null {
  return healthMonitor
}

export function getGuardrailsManager(): GuardrailsManager | null {
  return guardrailsManager
}

export function getGitService(): GitService | null {
  return gitService
}

export function getFsService(): FsService | null {
  return fsService
}

export function getSkillsService(): SkillsService | null {
  return skillsService
}

export function getWindowManager(): WindowManager | null {
  return windowManager
}

export function getSettingsService(): SettingsService | null {
  return settingsService
}

export function getVoiceService(): VoiceService | null {
  return voiceService
}

export function getPiperService(): PiperService | null {
  return piperService
}

export function getDockerService(): DockerService | null {
  return dockerService
}

export function getContainerManager(): ContainerManager | null {
  return containerManager
}

export function getAnamnesisWriter(): IAnamnesisAdapter | null {
  return anamnesisWriter
}

export function getForgejoAdapter(): IForgejoAdapter | null {
  return forgejoAdapter
}

export function getSprintWatcher(): SprintWatcher | null {
  return sprintWatcher
}

export function getTelegramSidecarService(): TelegramSidecarService | null {
  return telegramSidecarService
}

export function getTelegramQueueProcessor(): TelegramQueueProcessor | null {
  return telegramQueueProcessor
}

export function getScheduler(): OrchestratorScheduler | null {
  return orchestratorScheduler
}

export function getMcpBridgeHandler(): McpBridgeHandler | null {
  return mcpBridgeHandler
}

export function getTelegramSocketPath(): string | null {
  return telegramSocketServer?.getSocketPath() ?? null
}

export function getTelegramSocketStatus(): TelegramSocketStatus {
  return telegramSocketServer?.getStatus() ?? {
    socketPath: null,
    state: 'stopped',
    errorCode: null,
  }
}

export function getIntakeDir(): string {
  return intakeDir
}
