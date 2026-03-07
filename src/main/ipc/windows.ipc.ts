import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error } from './ipc-helpers'
import { getWindowManager } from '../services/service-orchestrator'
import { getAgentState } from '../services/agent-manager'

export function registerWindowsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.WINDOWS.CREATE_BREAKOUT, async (_event, agentId: unknown) => {
    try {
      if (typeof agentId !== 'string') return error('VALIDATION_ERROR', 'agentId must be a string')
      const wm = getWindowManager()
      if (!wm) return error('SERVICE_ERROR', 'WindowManager not initialized')
      const agent = getAgentState(agentId)
      if (!agent) return error('NOT_FOUND', `Agent ${agentId} not found`)
      const info = wm.createBreakout(agentId, agent.name, agent.cwd, agent.color)
      return success(info)
    } catch (err) {
      return error('BREAKOUT_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.WINDOWS.CLOSE_BREAKOUT, async (_event, agentId: unknown) => {
    try {
      if (typeof agentId !== 'string') return error('VALIDATION_ERROR', 'agentId must be a string')
      const wm = getWindowManager()
      if (!wm) return error('SERVICE_ERROR', 'WindowManager not initialized')
      wm.closeBreakout(agentId)
      return success(undefined)
    } catch (err) {
      return error('CLOSE_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.WINDOWS.LIST_BREAKOUTS, async () => {
    try {
      const wm = getWindowManager()
      if (!wm) return error('SERVICE_ERROR', 'WindowManager not initialized')
      return success(wm.listBreakouts())
    } catch (err) {
      return error('LIST_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.WINDOWS.FOCUS_BREAKOUT, async (_event, agentId: unknown) => {
    try {
      if (typeof agentId !== 'string') return error('VALIDATION_ERROR', 'agentId must be a string')
      const wm = getWindowManager()
      if (!wm) return error('SERVICE_ERROR', 'WindowManager not initialized')
      wm.focusBreakout(agentId)
      return success(undefined)
    } catch (err) {
      return error('FOCUS_ERROR', err instanceof Error ? err.message : String(err))
    }
  })
}
