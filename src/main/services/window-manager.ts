import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { BreakoutWindowInfo } from '../../shared/types/window.types'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'

interface WindowManagerDeps {
  logInfo: (message: string, meta?: Record<string, unknown>) => void
  emitToAllRenderers?: (channel: string, ...args: unknown[]) => void
}

export class WindowManager {
  private breakouts = new Map<string, { window: BrowserWindow; info: BreakoutWindowInfo }>()
  private suppressCloseEvent = new Set<string>()
  private deps: WindowManagerDeps

  constructor(deps: WindowManagerDeps) {
    this.deps = deps
  }

  createBreakout(
    agentId: string,
    agentName: string,
    repoPath: string,
    agentColor: string
  ): BreakoutWindowInfo {
    // If breakout already exists for this agent, focus it
    const existing = this.breakouts.get(agentId)
    if (existing && !existing.window.isDestroyed()) {
      existing.window.focus()
      return existing.info
    }

    const repoName = repoPath.split('/').pop() ?? 'project'

    const breakoutWindow = new BrowserWindow({
      width: 900,
      height: 600,
      minWidth: 400,
      minHeight: 300,
      title: `${agentName} — ${repoName}`,
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true
      }
    })

    // Load the same renderer but with breakout query params
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const url = new URL(process.env['ELECTRON_RENDERER_URL'])
      url.searchParams.set('breakout', 'true')
      url.searchParams.set('agentId', agentId)
      breakoutWindow.loadURL(url.toString())
    } else {
      breakoutWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        search: `breakout=true&agentId=${agentId}`
      })
    }

    const info: BreakoutWindowInfo = {
      agentId,
      windowId: breakoutWindow.id,
      agentName,
      repoPath,
      agentColor
    }

    this.breakouts.set(agentId, { window: breakoutWindow, info })

    breakoutWindow.on('closed', () => {
      this.breakouts.delete(agentId)
      this.deps.logInfo('Breakout window closed', { agentId })
      // Only emit when user closed the window (not programmatic close)
      if (!this.suppressCloseEvent.delete(agentId)) {
        this.deps.emitToAllRenderers?.(IPC_EVENTS.WINDOWS.BREAKOUT_CLOSED, agentId)
      }
    })

    this.deps.logInfo('Breakout window created', { agentId, windowId: breakoutWindow.id })
    return info
  }

  closeBreakout(agentId: string): void {
    const entry = this.breakouts.get(agentId)
    if (entry && !entry.window.isDestroyed()) {
      this.suppressCloseEvent.add(agentId)
      entry.window.close()
    }
    this.breakouts.delete(agentId)
  }

  focusBreakout(agentId: string): void {
    const entry = this.breakouts.get(agentId)
    if (entry && !entry.window.isDestroyed()) {
      entry.window.focus()
    }
  }

  listBreakouts(): BreakoutWindowInfo[] {
    const result: BreakoutWindowInfo[] = []
    for (const [agentId, entry] of this.breakouts) {
      if (entry.window.isDestroyed()) {
        this.breakouts.delete(agentId)
      } else {
        result.push(entry.info)
      }
    }
    return result
  }

  closeAll(): void {
    for (const [agentId, entry] of this.breakouts) {
      if (!entry.window.isDestroyed()) {
        this.suppressCloseEvent.add(agentId)
        entry.window.close()
      }
    }
    this.breakouts.clear()
  }
}
