import { app, BrowserWindow, Notification } from 'electron'
import { emitToAllRenderers } from '../utils/emit-to-all-renderers'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
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
import { TelegramSidecarService } from './telegram-sidecar-service'
import { TelegramSocketServer } from './telegram-socket-server'
import { TelegramQueueProcessor } from './telegram-queue-processor'
import { KanbanOrchestratorService, type OrchestratorDeps } from './kanban-orchestrator'
import { DateWatcherService, type DateWatcherDeps } from './date-watcher'
import type { TelegramFromSidecarMsg } from '../../shared/types/telegram.types'
import { getTelegramAllowedUser } from '../db/queries/telegram.queries'
import { listAgents, pauseAgent, killAgent, cleanupAllAgents, setPtyOwner, clearPtyOwner, sendInput, setTelegramNotifier, setTelegramAgentSync, spawnAgent, resumeAgent, respawnAgent, setLastMcpTelegramAt, getAgentOutput } from './agent-manager'
import { installClaudePlugin } from './plugin-installer'
import { setShutdownReason } from '../shutdown-reason'
import { purgeDeadAgents, resetStaleAgentsOnStartup } from '../db/queries/agents.queries'
import { cleanupOldRetryFailures } from '../db/queries/orchestrator.queries'
import { setSnapshotEngine } from '../ipc/snapshots.ipc'
import type { GuardrailConfig } from '../../shared/types/config.types'
import { DEFAULT_GUARDRAILS } from '../../shared/types/config.types'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'

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
let kanbanOrchestrator: KanbanOrchestratorService | null = null
let dateWatcher: DateWatcherService | null = null
let intakeDir = ''

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
      sendInput(msg.requestId, 'y\r', { isSystemAction: true })
      break
    case 'deny':
      sendInput(msg.requestId, 'n\r', { isSystemAction: true })
      break
    case 'spawn_agent': {
      try {
        spawnAgent({
          repoId: '',
          name: msg.name,
          cwd: msg.repo,
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

export function initializeServices(db: Database.Database): void {
  // Install Claude Code plugin — non-blocking, best-effort.
  // Runs before any agent can be spawned (agents require user interaction post-startup).
  installClaudePlugin().catch((err) => log.warn('Claude plugin install failed', { err }))

  // Purge dead agents older than 24h to prevent DB bloat
  purgeDeadAgents(db, 24)
  // Reset any non-terminal agents left over from a crashed or force-quit session
  resetStaleAgentsOnStartup(db)
  // Clean up acknowledged retry failures older than 30 days
  cleanupOldRetryFailures(db)
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
  const brainScanner = initBrainScanner(gitService)

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

  // 10. SettingsService — app-level settings persistence
  settingsService = new SettingsService(db, {
    logInfo: (message: string, meta?: Record<string, unknown>) => {
      log.info(message, meta)
    }
  })

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
  anamnesisWriter.flush().catch((err) => log.warn('Anamnesis startup flush failed (server likely not running)', err))

  // 15a. AnamnesisReader — lifecycle data reader (system mode only)
  if (appMode === 'system') {
    const authSecret = process.env['ANAMNESIS_AUTH_SECRET'] ?? process.env['AUTH_SECRET'] ?? ''
    initAnamnesisReader({ baseUrl: anamnesisUrl, authSecret, caller: 'hephaestus' })
  }

  const forgejoUrl = process.env['FORGEJO_URL'] ?? 'http://localhost:3000'
  const forgejoToken = process.env['FORGEJO_TOKEN'] ?? ''
  forgejoAdapter = createForgejoAdapter(appMode, { baseUrl: forgejoUrl, token: forgejoToken })

  // 16. SprintWatcher — watches sprint-intake dir for new sprint JSON files
  intakeDir = join(app.getPath('userData'), 'sprint-intake')
  sprintWatcher = new SprintWatcher()
  sprintWatcher.start(intakeDir, emitToAllRenderers)

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
      telegramSocketServer.start(sockPath)
    },
  })

  // Queue processor only needs db — construct before setTelegramNotifier so enqueue works immediately
  telegramQueueProcessor = new TelegramQueueProcessor({
    db,
    notify: (payload) => telegramSidecarService?.notify(payload),
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

  // 18. KanbanOrchestratorService — sprint execution engine
  const orchestratorDeps: OrchestratorDeps = {
    spawnAgent,
    getRepoPath: (repoId: string) => {
      const repo = getRepoById(db, repoId)
      return repo?.path ?? null
    },
    gitStageAll: (repoPath: string) => gitService!.stageFiles(repoPath, ['-A']),
    gitCommit: (repoPath: string, message: string) => gitService!.commit(repoPath, message),
    gitPush: (repoPath: string) => gitService!.push(repoPath),
    getAgentOutput,
    onEventInserted: () => getAnamnesisWriter()?.onEventInserted(),
    emitToRenderer: emitToAllRenderers,
    sendTelegramNotification: (summary: string, type: 'completed' | 'failed') => {
      telegramQueueProcessor?.enqueue({
        type,
        agentId: 'orchestrator',
        agentName: 'Kanban Orchestrator',
        repo: '',
        summary: summary.slice(0, 200),
        timestamp: new Date().toISOString(),
      })
    },
  }
  kanbanOrchestrator = new KanbanOrchestratorService(db, orchestratorDeps)

  // Task 4.19: DateWatcherService — polls for date-triggered tasks
  const dateWatcherDeps: DateWatcherDeps = {
    startOrchestratorRun: (input) => kanbanOrchestrator!.start(input),
    sendTelegramNotification: orchestratorDeps.sendTelegramNotification,
    onEventInserted: orchestratorDeps.onEventInserted,
    getOllamaBaseUrl: () => 'http://localhost:11434',
  }
  dateWatcher = new DateWatcherService(db, dateWatcherDeps)

  // Kanban + Projects IPC handlers now registered in register-all.ts

  log.info('All services initialized')
}

export function startServices(): void {
  snapshotEngine?.start()
  claudeMonitor?.start().catch((err) => log.error('ClaudeMonitor start failed', err))
  healthMonitor?.startWatchdog()
  autoPauseService?.startReminderTimer()
  dateWatcher?.start()
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
  dateWatcher?.stop()
  dateWatcher = null
  telegramQueueProcessor?.stop()
  telegramQueueProcessor = null
  telegramSocketServer?.stop()
  telegramSocketServer = null
  telegramSidecarService?.stop()
  kanbanOrchestrator?.stop()
  kanbanOrchestrator = null
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

export function getKanbanOrchestrator(): KanbanOrchestratorService | null {
  return kanbanOrchestrator
}

export function getDateWatcher(): DateWatcherService | null {
  return dateWatcher
}

export function getTelegramSocketPath(): string | null {
  return telegramSocketServer?.getSocketPath() ?? null
}

export function getIntakeDir(): string {
  return intakeDir
}
