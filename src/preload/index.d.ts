import { ElectronAPI } from '@electron-toolkit/preload'
import type { AgentHubBridge } from '../shared/types/ipc.types'

declare global {
  interface Window {
    electron: ElectronAPI
    agentHub: AgentHubBridge
  }
}
