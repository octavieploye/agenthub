import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import type { RendererErrorPayload } from '../../shared/types/log.types'

export function registerLogHandlers(): void {
  ipcMain.on(IPC_CHANNELS.LOG.RENDERER_ERROR, (_event, payload: RendererErrorPayload) => {
    switch (payload.type) {
      case 'ipcFlood':
        log.warn('Renderer IPC flood detected', {
          rate: payload.rate,
          timestamp: payload.timestamp
        })
        break
      case 'webglContextLoss':
        log.error('WebGL context lost in renderer', {
          agentId: payload.agentId,
          timestamp: payload.timestamp
        })
        break
      default:
        log.error('Renderer error', {
          type: payload.type,
          message: payload.message,
          stack: payload.stack,
          timestamp: payload.timestamp
        })
    }
  })

  log.info('Log IPC handlers registered')
}
