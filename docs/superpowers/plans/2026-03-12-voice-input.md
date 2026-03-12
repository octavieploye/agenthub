# Voice Input Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local speech-to-text voice input to AgentHub using a whisper.cpp sidecar, with push-to-talk and toggle modes, working across all windows and text inputs.

**Architecture:** Renderer captures mic audio via AudioContext + ScriptProcessorNode (16kHz mono PCM), sends ArrayBuffer to main process via IPC. Main process VoiceService manages a whisper.cpp sidecar binary, writes temp WAV, invokes whisper-cli, returns transcript. TranscriptionEngine interface allows future engine swap.

**Tech Stack:** Electron IPC, Web Audio API (AudioContext + ScriptProcessorNode), whisper.cpp (pre-compiled arm64 binary), React hooks, vitest

**Spec:** `docs/superpowers/specs/2026-03-12-voice-input-design.md`

**Spec deviations (intentional):**
- Spec says `AudioWorkletNode`; plan uses `ScriptProcessorNode`. Rationale: AudioWorklet requires a separate bundled JS file and `audioContext.audioWorklet.addModule()` with Electron bundler configuration. ScriptProcessorNode works reliably for short utterance capture (our use case) without bundler changes. Can upgrade later.
- Spec says `stopRecording(): Promise<Float32Array>`; plan returns `Promise<ArrayBuffer>` (Int16 PCM). Rationale: WhisperEngine needs Int16 PCM for WAV encoding, so converting in AudioRecorderService avoids double conversion.
- Spec says `src/renderer/src/components/VoiceInputButton.tsx`; plan uses `src/renderer/src/widgets/voice-input-button/VoiceInputButton.tsx` to match the existing codebase widget convention.
- Model download UI is deferred. MVP shows status message with manual placement instructions. Full download UI is a separate task.
- `voice.shortcut` and `voice.engine` settings from spec are deferred. Shortcut is hardcoded (`Cmd+Shift+V`) and engine is always `whisper` until Claude `/voice` ships. Only `voice.enabled` is persisted for now.
- VoiceService integration test (real sidecar + test WAV) requires the whisper-cli binary present. Marked as manual test — cannot run in CI without the binary.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/shared/types/voice.types.ts` | Voice-related types |
| Create | `src/main/services/transcription-engine.ts` | TranscriptionEngine interface + WhisperEngine |
| Create | `src/main/services/voice-service.ts` | VoiceService (sidecar lifecycle, queue) |
| Create | `src/main/ipc/voice.ipc.ts` | IPC handler registration for VOICE channels |
| Create | `src/renderer/src/services/audio-recorder.ts` | AudioRecorderService (mic capture) |
| Create | `src/renderer/src/hooks/useVoiceInput.ts` | useVoiceInput hook |
| Create | `src/renderer/src/widgets/voice-input-button/VoiceInputButton.tsx` | VoiceInputButton component |
| Modify | `src/shared/constants/ipc-channels.ts` | Add VOICE channel group |
| Modify | `src/preload/index.ts` | Add voice bridge methods |
| Modify | `src/preload/index.d.ts` | Add voice type declarations |
| Modify | `src/main/services/service-orchestrator.ts` | Add VoiceService as #11 |
| Modify | `src/main/ipc/register-all.ts` | Register voice IPC handlers |
| Modify | `src/renderer/src/widgets/settings-panel/SettingsPanel.tsx` | Add Voice Input settings section |
| Modify | `src/renderer/src/widgets/inline-task-input/InlineTaskInput.tsx` | Add VoiceInputButton |
| Modify | `src/renderer/src/widgets/breakout-terminal/BreakoutLayout.tsx` | Add VoiceInputButton |
| Create | `src/main/services/__tests__/voice-service.test.ts` | VoiceService tests |
| Create | `src/renderer/src/widgets/voice-input-button/VoiceInputButton.test.tsx` | VoiceInputButton tests |

**Note:** TodoTab, BugsTab, and Notes inputs are listed in the spec as integration points. These follow the exact same pattern as InlineTaskInput (import + ref + VoiceInputButton). They are covered in Task 14. Read each file first to find the input element and add the button alongside it.

---

## Chunk 1: Shared Types + IPC Channels + Preload

### Task 1: Voice Types

**Files:**
- Create: `src/shared/types/voice.types.ts`

- [ ] **Step 1: Create voice types file**

```ts
export type VoiceStatus = 'ready' | 'busy' | 'unavailable'

export interface VoiceStatusResult {
  status: VoiceStatus
  reason?: 'model-missing' | 'binary-missing' | 'mic-denied'
}

export interface VoiceTranscribeResult {
  transcript?: string
  error?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types/voice.types.ts
git commit -m "feat(voice): add voice shared types"
```

### Task 2: IPC Channels + Preload Bridge

**Files:**
- Modify: `src/shared/constants/ipc-channels.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

- [ ] **Step 1: Add VOICE channel group to IPC_CHANNELS**

Add after `SYSTEM` block in `IPC_CHANNELS`:

```ts
VOICE: {
  TRANSCRIBE: 'voice:transcribe',
  STATUS: 'voice:status',
  CANCEL: 'voice:cancel'
}
```

- [ ] **Step 2: Add voice methods to preload bridge**

In `src/preload/index.ts`, add to `agentHubBridge` after the `system` block:

```ts
voice: {
  transcribe: (audioBuffer: ArrayBuffer) =>
    ipcRenderer.invoke(IPC_CHANNELS.VOICE.TRANSCRIBE, audioBuffer),
  status: () => ipcRenderer.invoke(IPC_CHANNELS.VOICE.STATUS),
  cancel: () => ipcRenderer.invoke(IPC_CHANNELS.VOICE.CANCEL)
}
```

- [ ] **Step 3: Update type declarations in `src/preload/index.d.ts`**

Add `voice` to the AgentHub interface (follow existing pattern). Import `VoiceStatusResult` and `VoiceTranscribeResult` from shared types:

```ts
voice: {
  transcribe: (audioBuffer: ArrayBuffer) => Promise<IpcResponse<VoiceTranscribeResult>>
  status: () => Promise<IpcResponse<VoiceStatusResult>>
  cancel: () => Promise<IpcResponse<void>>
}
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/shared/constants/ipc-channels.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat(voice): add VOICE IPC channels and preload bridge"
```

---

## Chunk 2: Main Process — TranscriptionEngine + VoiceService + IPC

### Task 3: TranscriptionEngine Interface + WhisperEngine

**Files:**
- Create: `src/main/services/transcription-engine.ts`

- [ ] **Step 1: Write TranscriptionEngine interface and WhisperEngine**

```ts
import { spawn, type ChildProcess } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import log from 'electron-log/main'

export interface TranscriptionEngine {
  transcribe(audioBuffer: ArrayBuffer): Promise<string>
  isAvailable(): boolean
  dispose(): void
}

export class WhisperEngine implements TranscriptionEngine {
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private activeProc: ChildProcess | null = null
  private readonly binaryPath: string
  private readonly modelPath: string
  private static readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000

  constructor(binaryPath: string, modelPath: string) {
    this.binaryPath = binaryPath
    this.modelPath = modelPath
  }

  isAvailable(): boolean {
    return existsSync(this.binaryPath) && existsSync(this.modelPath)
  }

  getMissingReason(): 'binary-missing' | 'model-missing' | null {
    if (!existsSync(this.binaryPath)) return 'binary-missing'
    if (!existsSync(this.modelPath)) return 'model-missing'
    return null
  }

  async transcribe(audioBuffer: ArrayBuffer): Promise<string> {
    this.resetIdleTimer()

    const tempPath = join(tmpdir(), `agenthub-voice-${Date.now()}.wav`)
    try {
      const wavBuffer = this.pcmToWav(audioBuffer)
      await writeFile(tempPath, wavBuffer)
      const transcript = await this.runWhisper(tempPath)
      return transcript.trim()
    } finally {
      await unlink(tempPath).catch(() => {})
    }
  }

  private runWhisper(wavPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.binaryPath, [
        '-m', this.modelPath,
        '-f', wavPath,
        '--no-timestamps',
        '-otxt',
        '-of', '-'
      ])
      this.activeProc = proc

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

      proc.on('error', (err) => {
        this.activeProc = null
        reject(err)
      })

      proc.on('close', (code) => {
        this.activeProc = null
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`whisper-cli exited ${code}: ${stderr}`))
        }
      })
    })
  }

  private pcmToWav(pcmBuffer: ArrayBuffer): Buffer {
    const pcm = Buffer.from(pcmBuffer)
    const sampleRate = 16000
    const numChannels = 1
    const bitsPerSample = 16
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
    const blockAlign = numChannels * (bitsPerSample / 8)
    const dataSize = pcm.length
    const header = Buffer.alloc(44)

    header.write('RIFF', 0)
    header.writeUInt32LE(36 + dataSize, 4)
    header.write('WAVE', 8)
    header.write('fmt ', 12)
    header.writeUInt32LE(16, 16)
    header.writeUInt16LE(1, 20)
    header.writeUInt16LE(numChannels, 22)
    header.writeUInt32LE(sampleRate, 24)
    header.writeUInt32LE(byteRate, 28)
    header.writeUInt16LE(blockAlign, 32)
    header.writeUInt16LE(bitsPerSample, 34)
    header.write('data', 36)
    header.writeUInt32LE(dataSize, 40)

    return Buffer.concat([header, pcm])
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => this.dispose(), WhisperEngine.IDLE_TIMEOUT_MS)
  }

  dispose(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
    if (this.activeProc) {
      this.activeProc.kill()
      this.activeProc = null
    }
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/main/services/transcription-engine.ts
git commit -m "feat(voice): add TranscriptionEngine interface and WhisperEngine"
```

### Task 4: VoiceService + Orchestrator Wiring

**Files:**
- Create: `src/main/services/voice-service.ts`
- Modify: `src/main/services/service-orchestrator.ts`

- [ ] **Step 1: Write VoiceService**

```ts
import { join } from 'path'
import { app, systemPreferences } from 'electron'
import { WhisperEngine } from './transcription-engine'
import type { VoiceStatusResult, VoiceTranscribeResult } from '../../shared/types/voice.types'

export interface VoiceServiceDeps {
  logInfo: (message: string, meta?: Record<string, unknown>) => void
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
    const binaryPath = join(process.resourcesPath, 'bin', 'whisper-cli')
    const modelPath = join(app.getPath('userData'), 'models', 'ggml-small.bin')
    this.engine = new WhisperEngine(binaryPath, modelPath)
  }

  getStatus(): VoiceStatusResult {
    // Check mic permission (macOS)
    const micStatus = systemPreferences.getMediaAccessStatus('microphone')
    if (micStatus === 'denied') return { status: 'unavailable', reason: 'mic-denied' }

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
```

- [ ] **Step 2: Wire VoiceService into service-orchestrator.ts**

Add import at top:
```ts
import { VoiceService } from './voice-service'
```

Add module-level variable:
```ts
let voiceService: VoiceService | null = null
```

Add in `initializeServices()` after service #10 (SettingsService):
```ts
// 11. VoiceService — speech-to-text sidecar manager, no deps
voiceService = new VoiceService({
  logInfo: (message: string, meta?: Record<string, unknown>) => {
    log.info(message, meta)
  }
})
```

Add to `stopServices()`:
```ts
voiceService?.dispose()
```

Add getter export:
```ts
export function getVoiceService(): VoiceService | null {
  return voiceService
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/main/services/voice-service.ts src/main/services/service-orchestrator.ts
git commit -m "feat(voice): add VoiceService and wire as #11 in orchestrator"
```

### Task 5: Voice IPC Handlers

**Files:**
- Create: `src/main/ipc/voice.ipc.ts`
- Modify: `src/main/ipc/register-all.ts`

- [ ] **Step 1: Write voice IPC handler registration**

```ts
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
```

- [ ] **Step 2: Add to register-all.ts**

Add import: `import { registerVoiceHandlers } from './voice.ipc'`
Add call before the log line: `registerVoiceHandlers()`

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/voice.ipc.ts src/main/ipc/register-all.ts
git commit -m "feat(voice): add voice IPC handlers and register"
```

### Task 6: VoiceService Tests

**Files:**
- Create: `src/main/services/__tests__/voice-service.test.ts`

- [ ] **Step 1: Write VoiceService tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VoiceService } from '../voice-service'

describe('VoiceService', () => {
  let service: VoiceService

  beforeEach(() => {
    service = new VoiceService({
      logInfo: vi.fn()
    })
  })

  it('returns unavailable when binary is missing', () => {
    const status = service.getStatus()
    expect(status.status).toBe('unavailable')
    expect(status.reason).toBeDefined()
  })

  it('cancel resolves pending requests with error', async () => {
    const promise = service.transcribe(new ArrayBuffer(100))
    service.cancel()
    const result = await promise
    expect(result.error).toBe('Cancelled')
  })

  it('dispose cleans up without throwing', () => {
    expect(() => service.dispose()).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/main/services/__tests__/voice-service.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/main/services/__tests__/voice-service.test.ts
git commit -m "test(voice): add VoiceService unit tests"
```

---

## Chunk 3: Renderer — AudioRecorder + Hook + Component

### Task 7: AudioRecorderService

**Files:**
- Create: `src/renderer/src/services/audio-recorder.ts`

- [ ] **Step 1: Write AudioRecorderService**

Uses ScriptProcessorNode for simplicity (see spec deviations above).

```ts
export class AudioRecorderService {
  private audioContext: AudioContext | null = null
  private stream: MediaStream | null = null
  private samples: Float32Array[] = []
  private recording = false

  async startRecording(): Promise<void> {
    if (this.recording) return

    this.samples = []
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    })

    this.audioContext = new AudioContext({ sampleRate: 16000 })
    const source = this.audioContext.createMediaStreamSource(this.stream)

    const processor = this.audioContext.createScriptProcessor(4096, 1, 1)
    processor.onaudioprocess = (event) => {
      if (!this.recording) return
      const input = event.inputBuffer.getChannelData(0)
      this.samples.push(new Float32Array(input))
    }

    source.connect(processor)
    processor.connect(this.audioContext.destination)
    this.recording = true
  }

  async stopRecording(): Promise<ArrayBuffer> {
    this.recording = false

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }
    if (this.audioContext) {
      await this.audioContext.close()
      this.audioContext = null
    }

    const totalLength = this.samples.reduce((sum, s) => sum + s.length, 0)
    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of this.samples) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    this.samples = []

    // Convert Float32 [-1,1] to Int16 PCM
    const pcm = new Int16Array(merged.length)
    for (let i = 0; i < merged.length; i++) {
      const s = Math.max(-1, Math.min(1, merged[i]))
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }

    return pcm.buffer
  }

  isRecording(): boolean {
    return this.recording
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/services/audio-recorder.ts
git commit -m "feat(voice): add AudioRecorderService for mic capture"
```

### Task 8: useVoiceInput Hook

**Files:**
- Create: `src/renderer/src/hooks/useVoiceInput.ts`

- [ ] **Step 1: Write useVoiceInput hook**

```ts
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { AudioRecorderService } from '../services/audio-recorder'

export function useVoiceInput(inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>) {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const recorderRef = useRef<AudioRecorderService | null>(null)
  const keyDownTimeRef = useRef<number>(0)

  const startListening = useCallback(async () => {
    if (isListening || isProcessing) return
    const recorder = new AudioRecorderService()
    recorderRef.current = recorder
    try {
      await recorder.startRecording()
      setIsListening(true)
    } catch (err) {
      console.error('Failed to start recording:', err)
    }
  }, [isListening, isProcessing])

  const stopListening = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || !isListening) return

    setIsListening(false)
    setIsProcessing(true)

    try {
      const audioBuffer = await recorder.stopRecording()
      const response = await window.agentHub.voice.transcribe(audioBuffer)

      if (response.success && response.data.transcript) {
        const el = inputRef.current
        if (el) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          )?.set || Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          )?.set
          const currentVal = el.value
          const newVal = currentVal
            ? `${currentVal} ${response.data.transcript}`
            : response.data.transcript
          nativeInputValueSetter?.call(el, newVal)
          el.dispatchEvent(new Event('input', { bubbles: true }))
        }
      } else if (response.success && response.data.error) {
        console.error('Transcription error:', response.data.error)
      }
    } catch (err) {
      console.error('Voice transcription failed:', err)
    } finally {
      setIsProcessing(false)
      recorderRef.current = null
    }
  }, [isListening, inputRef])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // Keyboard shortcut: Cmd+Shift+V
  useEffect(() => {
    const HOLD_THRESHOLD_MS = 300

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === 'v' && !e.repeat) {
        e.preventDefault()
        keyDownTimeRef.current = Date.now()
        startListening()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'v' || e.key === 'V') {
        const held = Date.now() - keyDownTimeRef.current
        if (held >= HOLD_THRESHOLD_MS) {
          stopListening()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [startListening, stopListening])

  return { isListening, isProcessing, startListening, stopListening, toggleListening }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/hooks/useVoiceInput.ts
git commit -m "feat(voice): add useVoiceInput hook with keyboard shortcut"
```

### Task 9: VoiceInputButton Component

**Files:**
- Create: `src/renderer/src/widgets/voice-input-button/VoiceInputButton.tsx`

- [ ] **Step 1: Write VoiceInputButton component**

```tsx
import { type RefObject } from 'react'
import { useVoiceInput } from '../../hooks/useVoiceInput'

interface VoiceInputButtonProps {
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  className?: string
}

export function VoiceInputButton({ inputRef, className = '' }: VoiceInputButtonProps) {
  const { isListening, isProcessing, toggleListening } = useVoiceInput(inputRef)

  const title = isProcessing
    ? 'Transcribing...'
    : isListening
      ? 'Listening — click or Cmd+Shift+V to stop'
      : 'Voice input (Cmd+Shift+V)'

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={isProcessing}
      title={title}
      data-testid="voice-input-button"
      className={`btn btn-ghost btn-xs ${className}`}
    >
      {isProcessing ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`w-4 h-4 ${isListening ? 'text-red-500 animate-pulse' : 'opacity-50'}`}
        >
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
          <path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
        </svg>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/widgets/voice-input-button/VoiceInputButton.tsx
git commit -m "feat(voice): add VoiceInputButton component"
```

### Task 10: VoiceInputButton Tests

**Files:**
- Create: `src/renderer/src/widgets/voice-input-button/VoiceInputButton.test.tsx`

- [ ] **Step 1: Write component tests**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VoiceInputButton } from './VoiceInputButton'
import { useRef } from 'react'

vi.mock('../../hooks/useVoiceInput', () => ({
  useVoiceInput: vi.fn(() => ({
    isListening: false,
    isProcessing: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    toggleListening: vi.fn()
  }))
}))

function TestWrapper() {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={ref} data-testid="test-input" />
      <VoiceInputButton inputRef={ref} />
    </>
  )
}

describe('VoiceInputButton', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders mic button', () => {
    render(<TestWrapper />)
    expect(screen.getByTestId('voice-input-button')).toBeDefined()
  })

  it('shows voice input title in idle state', () => {
    render(<TestWrapper />)
    expect(screen.getByTestId('voice-input-button').title).toContain('Voice input')
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/renderer/src/widgets/voice-input-button/VoiceInputButton.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/widgets/voice-input-button/VoiceInputButton.test.tsx
git commit -m "test(voice): add VoiceInputButton component tests"
```

---

## Chunk 4: Integration — Wire into All Input Fields + Settings

### Task 11: Add VoiceInputButton to InlineTaskInput

**Files:**
- Modify: `src/renderer/src/widgets/inline-task-input/InlineTaskInput.tsx`

- [ ] **Step 1: Read the file to understand current structure**

- [ ] **Step 2: Add VoiceInputButton**

- Import `VoiceInputButton` from `'../voice-input-button/VoiceInputButton'`
- Import `useRef` if not already imported
- Create a ref for the input: `const inputRef = useRef<HTMLInputElement>(null)`
- Attach `ref={inputRef}` to the `<input>` element
- Place `<VoiceInputButton inputRef={inputRef} />` next to the send button

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/widgets/inline-task-input/InlineTaskInput.tsx
git commit -m "feat(voice): add voice button to InlineTaskInput"
```

### Task 12: Add VoiceInputButton to BreakoutLayout

**Files:**
- Modify: `src/renderer/src/widgets/breakout-terminal/BreakoutLayout.tsx`

- [ ] **Step 1: Read the file**

- [ ] **Step 2: Add VoiceInputButton (same pattern as Task 11)**

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/widgets/breakout-terminal/BreakoutLayout.tsx
git commit -m "feat(voice): add voice button to BreakoutLayout"
```

### Task 13: Add Voice Settings Section to SettingsPanel

**Files:**
- Modify: `src/renderer/src/widgets/settings-panel/SettingsPanel.tsx`

- [ ] **Step 1: Read the file**

- [ ] **Step 2: Add Voice Input section**

Add after the Notifications section. Query `VOICE.STATUS` on mount to show model availability:

```tsx
// State
const [voiceEnabled, setVoiceEnabled] = useState(false)
const [voiceStatus, setVoiceStatus] = useState<string>('unavailable')
const [voiceReason, setVoiceReason] = useState<string | undefined>()

// On mount, fetch voice status
useEffect(() => {
  window.agentHub.voice.status().then((res) => {
    if (res.success) {
      setVoiceStatus(res.data.status)
      setVoiceReason(res.data.reason)
    }
  })
}, [])

// JSX — Voice Input section
<div className="form-control">
  <h3 className="text-sm font-semibold mb-2 opacity-70">Voice Input</h3>
  <label className="label cursor-pointer justify-start gap-3">
    <input
      type="checkbox"
      className="toggle toggle-sm"
      checked={voiceEnabled}
      onChange={(e) => {
        setVoiceEnabled(e.target.checked)
        handleSettingChange('voice.enabled', String(e.target.checked))
      }}
    />
    <span className="label-text text-xs">Enable voice input (Cmd+Shift+V)</span>
  </label>
  {voiceStatus === 'unavailable' && voiceReason === 'model-missing' && (
    <p className="text-xs text-warning mt-1">
      Whisper model not found. Place ggml-small.bin in app data models/ directory.
    </p>
  )}
  {voiceStatus === 'unavailable' && voiceReason === 'binary-missing' && (
    <p className="text-xs text-error mt-1">
      whisper-cli binary not found in resources/bin/
    </p>
  )}
  {voiceStatus === 'unavailable' && voiceReason === 'mic-denied' && (
    <p className="text-xs text-error mt-1">
      Mic access denied — enable in System Preferences &gt; Privacy &gt; Microphone
    </p>
  )}
</div>
```

- [ ] **Step 3: Initialize voiceEnabled from settings on mount**

Read existing `voice.enabled` setting value using `window.agentHub.settings.getAll()` (already fetched in SettingsPanel).

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/widgets/settings-panel/SettingsPanel.tsx
git commit -m "feat(voice): add Voice Input settings section"
```

### Task 14: Add VoiceInputButton to TodoTab, BugsTab, Notes

**Files:**
- Modify: TodoTab input component (find via `Glob('**/TodoTab*')` or `**/todo-tab*`)
- Modify: BugsTab input component (find via `Glob('**/BugsTab*')` or `**/bugs-tab*`)
- Modify: Notes input component (find via `Glob('**/Notes*')` or `**/notes*`)

- [ ] **Step 1: Find and read each file**

Use Glob to locate the exact paths. Each should have an input/textarea element.

- [ ] **Step 2: Add VoiceInputButton to each (same pattern as Task 11)**

For each file:
- Import VoiceInputButton
- Add/use a ref for the input element
- Place VoiceInputButton next to the input

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add <modified files>
git commit -m "feat(voice): add voice button to TodoTab, BugsTab, Notes"
```

### Task 15: Final Type Check + Test Run

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 3: Fix any issues and commit**

---

## Task Dependencies

```
Task 1 (types) ───► Task 2 (channels+preload) ───► Task 3 (engine)
                                                        │
                                                   Task 4 (VoiceService+orchestrator)
                                                        │
                                                   Task 5 (IPC handlers)
                                                        │
                                                   Task 6 (VoiceService tests)

Task 7 (AudioRecorder) ──► Task 8 (hook) ──► Task 9 (button) ──► Task 10 (button tests)
                                                                       │
                                              Tasks 11-14 (integration, parallelizable)
                                                                       │
                                                                  Task 15 (final check)
```

**Parallelizable groups:**
- Tasks 3-6 (main process) and Tasks 7-10 (renderer) can run in parallel once Task 2 is done
- Tasks 11, 12, 13, 14 are independent and can run in parallel
