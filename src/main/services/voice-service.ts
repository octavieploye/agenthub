import { join } from 'path'
import { WhisperEngine } from './transcription-engine'
import type { VoiceStatusResult, VoiceTranscribeResult } from '../../shared/types/voice.types'

export interface VoiceServiceDeps {
  logInfo: (message: string, meta?: Record<string, unknown>) => void
  binaryPath: string
  modelPath: string
  getMicStatus?: () => string
}

export class VoiceService {
  private engine: WhisperEngine
  private queue: Array<{
    audioBuffer: ArrayBuffer
    resolve: (result: VoiceTranscribeResult) => void
  }> = []
  private processing = false
  private readonly deps: VoiceServiceDeps

  constructor(deps: VoiceServiceDeps) {
    this.deps = deps
    this.engine = new WhisperEngine(deps.binaryPath, deps.modelPath)
  }

  getStatus(): VoiceStatusResult {
    if (this.deps.getMicStatus) {
      const micStatus = this.deps.getMicStatus()
      if (micStatus === 'denied') return { status: 'unavailable', reason: 'mic-denied' }
    }

    if (this.processing) return { status: 'busy' }
    const missing = this.engine.getMissingReason()
    if (missing) return { status: 'unavailable', reason: missing }
    return { status: 'ready' }
  }

  async transcribe(audioBuffer: ArrayBuffer): Promise<VoiceTranscribeResult> {
    return new Promise((resolve) => {
      this.queue.push({ audioBuffer, resolve })
      this.processQueue()
    })
  }

  cancel(): void {
    this.engine.dispose()
    const pending = this.queue.splice(0)
    for (const item of pending) {
      item.resolve({ error: 'Cancelled' })
    }
    this.processing = false
  }

  dispose(): void {
    this.cancel()
    this.engine.dispose()
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return
    const item = this.queue.shift()
    if (!item) return

    this.processing = true
    try {
      const transcript = await this.engine.transcribe(item.audioBuffer)
      item.resolve({ transcript })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.deps.logInfo('Voice transcription failed', { error: message })
      item.resolve({ error: message })
    } finally {
      this.processing = false
      if (this.queue.length > 0) this.processQueue()
    }
  }
}
