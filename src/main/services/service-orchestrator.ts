import { app, BrowserWindow, Notification } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
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
import { getAllRepos } from '../db/queries/repos.queries'
import { SkillsService } from './skills-service'
import { WindowManager } from './window-manager'
import { SettingsService } from './settings-service'
import { VoiceService } from './voice-service'
import { PiperService } from './piper-service'
import { registerTtsHandlers } from '../ipc/tts.ipc'
import { DockerService } from './docker-service'
import { ContainerManager } from './container-manager'
import { AnamnesisWriter } from './anamnesis-writer'
import { registerKanbanHandlers } from '../ipc/kanban.ipc'
import { registerProjectHandlers } from '../ipc/projects.ipc'
import { listAgents, pauseAgent, killAgent, cleanupAllAgents } from './agent-manager'
import { setShutdownReason } from '../shutdown-reason'
import { purgeDeadAgents, resetStaleAgentsOnStartup } from '../db/queries/agents.queries'
import { setSnapshotEngine } from '../ipc/snapshots.ipc'
import type { GuardrailConfig } from '../../shared/types/config.types'
import { DEFAULT_GUARDRAILS } from '../../shared/types/config.types'

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
let anamnesisWriter: AnamnesisWriter | null = null

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows[0] ?? null
}

function emitToAllRenderers(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }
}

export function initializeServices(db: Database.Database): void {
  // Purge dead agents older than 24h to prevent DB bloat
  purgeDeadAgents(db, 24)
  // Reset any non-terminal agents left over from a crashed or force-quit session
  resetStaleAgentsOnStartup(db)
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
    }
  })

  // 9. WindowManager — creates/tracks breakout terminal windows
  windowManager = new WindowManager({
    logInfo: (message: string, meta?: Record<string, unknown>) => {
      log.info(message, meta)
    },
    emitToAllRenderers
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
  registerTtsHandlers()

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
  containerManager.init(db).catch((err) => log.error('ContainerManager init failed', err))

  // 15. AnamnesisWriter — Kanban → Anamnesis event pipeline
  const anamnesisUrl = process.env['ANAMNESIS_URL'] ?? 'http://localhost:9300'
  anamnesisWriter = new AnamnesisWriter(db, { anamnesisUrl })
  anamnesisWriter.flush().catch((err) => log.warn('Anamnesis startup flush failed (server likely not running)', err))

  // 16. Kanban IPC handlers
  registerKanbanHandlers(db, windowManager!)

  // 17. Projects IPC handlers
  registerProjectHandlers(db)

  log.info('All services initialized')
}

export function startServices(): void {
  snapshotEngine?.start()
  claudeMonitor?.start().catch((err) => log.error('ClaudeMonitor start failed', err))
  healthMonitor?.startWatchdog()
  autoPauseService?.startReminderTimer()
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
  containerManager?.stopAll().catch((err) => log.error('ContainerManager stopAll failed', err))
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

export function getAnamnesisWriter(): AnamnesisWriter | null {
  return anamnesisWriter
}
