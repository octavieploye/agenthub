import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error } from './ipc-helpers'
import { getVoiceService } from '../services/service-orchestrator'

export function registerVoiceHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.VOICE.STATUS, async () => {
    try {
      const svc = getVoiceService()
      if (!svc) return error('SERVICE_ERROR', 'VoiceService not initialized')
      return success(svc.getStatus())
    } catch (err) {
      return error('VOICE_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.VOICE.TRANSCRIBE, async (_event, audioBuffer: ArrayBuffer) => {
    try {
      const svc = getVoiceService()
      if (!svc) return error('SERVICE_ERROR', 'VoiceService not initialized')
      const result = await svc.transcribe(audioBuffer)
      return success(result)
    } catch (err) {
      return error('VOICE_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.VOICE.CANCEL, async () => {
    try {
      const svc = getVoiceService()
      if (!svc) return error('SERVICE_ERROR', 'VoiceService not initialized')
      svc.cancel()
      return success(undefined)
    } catch (err) {
      return error('VOICE_ERROR', err instanceof Error ? err.message : String(err))
    }
  })
}
