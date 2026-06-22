import { ipcMain } from 'electron'
import { z } from 'zod/v4'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getPiperService } from '../services/service-orchestrator'

export interface TtsSpeakOptions {
  text: string
  voiceId: string
  rate: number
  volume: number
}

const ttsSpeakSchema = z.object({
  text: z.string().min(1).max(10000),
  voiceId: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'voiceId must be alphanumeric with hyphens/underscores only'),
  rate: z.number().min(0.1).max(5.0),
  volume: z.number().min(0).max(1)
})

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

  ipcMain.handle(IPC_CHANNELS.TTS.SPEAK, async (_event, opts: unknown) => {
    try {
      const parsed = validateInput(ttsSpeakSchema, opts)
      if (!parsed.valid) return parsed.response
      const svc = getPiperService()
      if (!svc) return error('SERVICE_ERROR', 'PiperService not initialized')
      const wav = await svc.speak(parsed.data.text, parsed.data.voiceId, parsed.data.rate)
      return success(wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength))
    } catch (err) {
      return error('TTS_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.TTS.STOP, async () => {
    return success(undefined)
  })
}
