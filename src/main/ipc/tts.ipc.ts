import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error } from './ipc-helpers'
import { getPiperService } from '../services/service-orchestrator'

export interface TtsSpeakOptions {
  text: string
  voiceId: string
  rate: number
  volume: number
}

export function registerTtsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TTS.STATUS, async () => {
    try {
      const svc = getPiperService()
      if (!svc) return error('SERVICE_ERROR', 'PiperService not initialized')
      return success({ status: 'ready' })
    } catch (err) {
      return error('TTS_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.TTS.LIST_VOICES, async () => {
    try {
      const svc = getPiperService()
      if (!svc) return error('SERVICE_ERROR', 'PiperService not initialized')
      return success(svc.listVoices())
    } catch (err) {
      return error('TTS_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.TTS.SPEAK, async (_event, opts: TtsSpeakOptions) => {
    try {
      const svc = getPiperService()
      if (!svc) return error('SERVICE_ERROR', 'PiperService not initialized')
      const wav = await svc.speak(opts.text, opts.voiceId, opts.rate)
      return success(wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength))
    } catch (err) {
      return error('TTS_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.TTS.STOP, async () => {
    return success(undefined)
  })
}
