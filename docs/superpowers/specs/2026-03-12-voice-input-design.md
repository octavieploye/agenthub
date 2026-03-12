# Voice Input Design — AgentHub

## Summary

Local speech-to-text voice input for AgentHub using a `whisper.cpp` sidecar binary. Users speak commands that get transcribed and inserted into any text input field for review before sending. Designed for easy future swap to Claude `/voice` when it ships.

## Requirements

- **Voice input only** — speech-to-text, no voice output changes
- **Local only** — all processing on-device, no network calls
- **Whisper Small model** (~500MB) for high accuracy
- **Push-to-talk** (hold `Cmd+Shift+V`) and **toggle mode** (quick press)
- **Text goes to input field** for review before send
- **Works everywhere** — main window, breakout terminals, TodoTab, BugsTab, Notes, any text input
- **Future-proof** — engine interface allows swapping to Claude `/voice`

## Architecture

```
Renderer (Main + Breakout windows)
  ├── AudioRecorderService    — mic capture via getUserMedia (local Chromium API)
  ├── useVoiceInput(inputRef) — hook for any text input
  └── VoiceInputButton        — mic icon UI component
        │
        │ IPC (ArrayBuffer, structured clone)
        ▼
Main Process
  └── VoiceService (#11 in orchestrator)
        │
        │ stdin/stdout + temp WAV file
        ▼
      whisper.cpp sidecar (Metal-accelerated, macOS arm64)
```

## Components

### 1. AudioRecorderService

**File:** `src/renderer/src/services/audio-recorder.ts`

- `startRecording()` — requests mic, captures at 16kHz mono PCM
- `stopRecording(): Promise<Float32Array>` — stops, returns PCM samples
- Uses `AudioContext` + `AudioWorkletNode` to capture raw 16kHz mono PCM directly (not `MediaRecorder`, which produces encoded blobs)
- Full utterance capture (no streaming) — commands are short

**Mic permission flow:**
- On app start, check `systemPreferences.getMediaAccessStatus('microphone')`
- If `not-determined`: permission is requested on first `getUserMedia` call (macOS prompts automatically)
- If `denied`: show inline warning in VoiceInputButton tooltip: "Mic access denied — enable in System Preferences > Privacy > Microphone"
- If `granted`: ready to record

### 2. VoiceService (Main Process)

**File:** `src/main/services/voice-service.ts`

Follows existing service orchestrator pattern (getter/init/start/stop). Service #11. No dependencies on other services — init order does not matter.

**Sidecar lifecycle:**
- Spawned lazily on first transcription request
- Kept alive for subsequent requests (avoids ~2-3s model reload)
- Killed on `stopServices()` or after 5-minute idle timeout
- Auto-respawn on crash at next request

**Transcription flow:**
1. Receive PCM `ArrayBuffer` via IPC
2. Write temp WAV file to `os.tmpdir()`
3. Invoke: `whisper-cli -m model.bin -f temp.wav --no-timestamps -otxt -of -` (output to stdout via `-of -`)
4. Capture stdout for transcript text
5. Clean up temp WAV file
6. Return transcript string via IPC reply

**Concurrency:** Requests are queued — if a second window sends `VOICE.TRANSCRIBE` while one is in progress, it waits. Only one transcription runs at a time (single sidecar).

**Error handling:**
- Sidecar missing/corrupt: `VOICE.STATUS` returns `unavailable`, UI shows "Whisper not found" in button tooltip
- Transcription fails: IPC reply includes `{ error: string }`, UI returns to idle state and shows brief toast
- Sidecar crash mid-transcription: detect via child process `exit` event, return error to pending request, respawn on next request
- Temp file write fails: return error immediately, no sidecar invocation

**IPC channels** (added to `ipc-channels.ts`):
- `VOICE.TRANSCRIBE` — send audio `ArrayBuffer`, receive `{ transcript: string } | { error: string }`
- `VOICE.STATUS` — query whisper availability, returns `'ready' | 'busy' | 'unavailable'`
- `VOICE.CANCEL` — kills in-progress sidecar invocation, returns UI to idle, discards result

**Model distribution:** The ~500MB `ggml-small.bin` model is NOT bundled with the app. On first use:
1. `VOICE.STATUS` returns `unavailable` with reason `model-missing`
2. Settings panel shows a "Download Whisper Model" button with size info
3. Download fetches from Hugging Face (`ggml-small.bin`) to `userData/models/`
4. Progress shown in Settings panel
5. Once downloaded, model persists across app updates

**Bundled assets:**
- `resources/bin/whisper-cli` — compiled binary (macOS arm64, ~2MB)
- Model stored in `app.getPath('userData')/models/ggml-small.bin` (downloaded on demand)

### 3. TranscriptionEngine Interface

**File:** `src/main/services/transcription-engine.ts`

```ts
interface TranscriptionEngine {
  transcribe(audioBuffer: ArrayBuffer): Promise<string>
  isAvailable(): boolean
  dispose(): void
}
```

- `WhisperEngine` — implements via sidecar (current)
- `ClaudeVoiceEngine` — future implementation when Claude `/voice` ships
- `voice.engine` setting controls active engine (`'whisper' | 'claude'`)

### 4. VoiceInputButton Component

**File:** `src/renderer/src/components/VoiceInputButton.tsx`

Mic icon button mounted next to any text input that accepts user commands.

**States:**
- Idle — mic icon, muted color
- Listening — mic icon pulsing/red
- Processing — spinner, awaiting transcript

**Activation:**
- Hold `Cmd+Shift+V` >=300ms = push-to-talk (release stops recording)
- Quick press `Cmd+Shift+V` <300ms = toggle (press again to stop)
- Error state — if voice unavailable (model missing, mic denied), button shows tooltip with reason

**Transcript delivery:**
- Appended to the input field's current value (terminal inputs don't support cursor-position insertion)
- User reviews and presses Enter to send

### 5. useVoiceInput Hook

**File:** `src/renderer/src/hooks/useVoiceInput.ts`

```ts
function useVoiceInput(inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement>): {
  isListening: boolean
  isProcessing: boolean
  startListening: () => void
  stopListening: () => void
  toggleListening: () => void
}
```

- Manages AudioRecorderService lifecycle
- Sends audio to main via `VOICE.TRANSCRIBE` IPC
- Appends transcript to `inputRef` value
- Keyboard shortcut handler (`Cmd+Shift+V`) registered per-window via `useEffect`

### 6. Settings

Persisted via existing SettingsService:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `voice.enabled` | boolean | false | Enable voice input |
| `voice.shortcut` | string | `Cmd+Shift+V` | Activation shortcut |
| `voice.engine` | string | `whisper` | Active engine (future: `claude`) |

Added to Settings panel as its own **Voice Input** section (separate from Notifications). Includes model download button when model is not yet downloaded.

## Cross-Window Support

- Each renderer window has its own `AudioRecorderService` instance
- `useVoiceInput` hook and `VoiceInputButton` are shared renderer code — work identically in `BreakoutLayout`
- All windows share the single main-process `VoiceService` (one sidecar)
- Shortcut registered per-window via `useEffect`, not global Electron shortcut

## Integration Points

**Input fields that get voice support:**
- Terminal input (main window + breakout)
- InlineTaskInput
- TodoTab input
- BugsTab input
- Notes input
- Any future text input using `useVoiceInput` hook

## Existing Code Impact

- `speech-recognition.ts` (untracked) — can be retired; replaced by this design
- `ipc-channels.ts` — add `VOICE` channel group
- `service-orchestrator.ts` — add VoiceService as #11
- `SettingsPanel` — add voice settings toggle
- No changes to existing voice TTS or sound alert services

## Testing Strategy

| Component | Type | Approach |
|-----------|------|----------|
| AudioRecorderService | Unit | vitest + jsdom, stub `getUserMedia` (browser boundary) |
| VoiceService | Integration | Spawn real sidecar with test WAV, verify transcript |
| VoiceInputButton | Component | @testing-library/react, verify states + shortcut detection |
| useVoiceInput | Hook | renderHook, verify IPC calls + state transitions |
| IPC round-trip | Integration | Renderer sends audio, main returns transcript |

## Dependencies

- `whisper.cpp` — compiled binary, bundled in `resources/bin/` (~2MB)
- `ggml-small.bin` — model file, downloaded on demand to `app.getPath('userData')/models/` (~500MB)
- No new npm dependencies required

## Future Enhancements (not in scope)

- Model size selection (tiny/base/small) via Settings download UI
- Claude `/voice` engine integration
- Streaming transcription for longer dictation
- Multi-language support
