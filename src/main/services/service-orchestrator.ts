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
import { listAgents, pauseAgent, killAgent, cleanupAllAgents } from './agent-manager'
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

export function initializeServices(db: Database.Database): void {
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
    emitToRenderer,
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
  trayManager?.destroy()
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
