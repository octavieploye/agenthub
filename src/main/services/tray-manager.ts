import { Tray, Menu, nativeImage } from 'electron'
import log from 'electron-log/main'

export type TrayStatus = 'healthy' | 'attention' | 'paused'

export interface TrayManagerConfig {
  onOpenApp: () => void
  onKillAll: () => void
  onKillAgent?: (agentId: string) => void
  getActiveAgents?: () => Array<{ id: string; name: string }>
}

export class TrayManager {
  private tray: Tray | null = null
  private config: TrayManagerConfig
  private agentCount = 0

  constructor(config: TrayManagerConfig) {
    this.config = config
  }

  create(): void {
    if (this.tray) return

    const icon = nativeImage.createEmpty()
    this.tray = new Tray(icon)
    this.tray.setToolTip('AgentHub')

    this.updateMenu()
    log.info('System tray created')
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
      log.info('System tray destroyed')
    }
  }

  isActive(): boolean {
    return this.tray !== null && !this.tray.isDestroyed()
  }

  updateAgentCount(count: number): void {
    this.agentCount = count
    if (this.tray && !this.tray.isDestroyed()) {
      this.tray.setToolTip(`AgentHub - ${count} agent${count !== 1 ? 's' : ''} running`)
      this.updateMenu()
    }
  }

  updateStatus(_status: TrayStatus): void {
    if (this.tray && !this.tray.isDestroyed()) {
      this.updateMenu()
    }
  }

  private updateMenu(): void {
    if (!this.tray || this.tray.isDestroyed()) return

    const agents = this.config.getActiveAgents?.() ?? []

    const agentItems: Electron.MenuItemConstructorOptions[] = agents.map((agent) => ({
      label: `Kill: ${agent.name}`,
      click: () => this.config.onKillAgent?.(agent.id)
    }))

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: `AgentHub (${this.agentCount} active)`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Open AgentHub',
        click: () => this.config.onOpenApp()
      },
      { type: 'separator' },
      ...agentItems,
      ...(agentItems.length > 0 ? [{ type: 'separator' as const }] : []),
      {
        label: 'Kill All & Quit',
        click: () => this.config.onKillAll()
      }
    ]

    const contextMenu = Menu.buildFromTemplate(template)
    this.tray.setContextMenu(contextMenu)
  }
}
