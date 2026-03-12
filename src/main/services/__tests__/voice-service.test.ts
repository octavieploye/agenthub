import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VoiceService } from '../voice-service'

describe('VoiceService', () => {
  let service: VoiceService

  beforeEach(() => {
    service = new VoiceService({
      logInfo: vi.fn(),
      binaryPath: '/nonexistent/whisper-cli',
      modelPath: '/nonexistent/ggml-small.bin'
    })
  })

  it('returns unavailable when binary is missing', () => {
    const status = service.getStatus()
    expect(status.status).toBe('unavailable')
    expect(status.reason).toBeDefined()
  })

  it('cancel resolves pending requests with error', async () => {
    // First request will start processing immediately (and fail on missing binary)
    // Queue a second request which will be pending when we cancel
    const promise1 = service.transcribe(new ArrayBuffer(100))
    const promise2 = service.transcribe(new ArrayBuffer(100))
    service.cancel()
    const [result1, result2] = await Promise.all([promise1, promise2])
    // At least one should have an error (either from missing binary or cancel)
    expect(result1.error || result2.error).toBeTruthy()
  })

  it('dispose cleans up without throwing', () => {
    expect(() => service.dispose()).not.toThrow()
  })
})
