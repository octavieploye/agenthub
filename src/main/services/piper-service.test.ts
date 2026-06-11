import { describe, it, expect, beforeAll } from 'vitest'
import path from 'path'
import { PiperService } from './piper-service'

const BINARY = path.join(process.cwd(), 'resources', 'bin', 'piper')
const VOICES_DIR = path.join(process.cwd(), 'resources', 'voices')
const VOICE_ID = 'en_US-amy-medium'

describe('PiperService', () => {
  let svc: PiperService

  beforeAll(() => {
    svc = new PiperService({ binaryPath: BINARY, voicesDir: VOICES_DIR, logInfo: () => {} })
  })

  it('listVoices returns installed voices including en_US-amy-medium', () => {
    const voices = svc.listVoices()
    expect(voices.length).toBeGreaterThan(0)
    const amy = voices.find((v) => v.id === 'en_US-amy-medium')
    expect(amy).toBeDefined()
    expect(amy!.lang).toBe('en_US')
  })

  it('speak returns a valid WAV buffer for short text', async () => {
    const wav = await svc.speak('Hello.', VOICE_ID, 1.0)
    expect(wav.length).toBeGreaterThan(44)
    expect(wav.slice(0, 4).toString('ascii')).toBe('RIFF')
    expect(wav.slice(8, 12).toString('ascii')).toBe('WAVE')
  }, 15000)

  it('speak rejects if voiceId does not exist', async () => {
    await expect(svc.speak('Hello.', 'does-not-exist', 1.0)).rejects.toThrow()
  })
})
