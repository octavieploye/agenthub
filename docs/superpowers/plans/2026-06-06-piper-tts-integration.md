# Piper TTS Integration Plan — Replace Web Speech API

**Status:** TODO — parked for future sprint
**Date:** 2026-06-06

## Problem

macOS Web Speech API causes:
- Language stuck in French (getVoices() race condition, falls back to system default)
- Gibberish reading (raw PTY output with ANSI codes, spinner words, tool XML)
- Looping (speechSynthesis queue + status flicker = repeated utterances)

## Solution

Replace Web Speech API with Piper neural TTS sidecar — same pattern as existing whisper.cpp STT sidecar.

## Architecture

```
Renderer                        Main Process                   Piper Binary
--------------------------------------------------------------------
useAgentTts hook
  or speakTriageEvent
       |
       | ipcRenderer.invoke(TTS.SPEAK, { text, voiceId, rate, volume })
       v
    tts.ipc.ts
    PiperService.speak()
       |
       +-- pipe text to stdin
       |
       +-- spawn(piper, ['--model', model, '--output_raw'])
       |                                         |
       |                                   PCM audio stdout
       |                                         |
       +-- Buffer PCM -> WAV
       +-- Return WAV buffer to renderer
       v
    Renderer plays via Howler.js (already in project)
```

## Bundled Voices (15 default)

### English (5)
- en_US-amy-medium (~20MB)
- en_US-joe-medium
- en_US-kusal-medium
- en_GB-alan-medium
- en_GB-jenny_dioco-medium

### French (5)
- fr_FR-siwis-medium (~18MB)
- fr_FR-upmc-medium
- fr_FR-gilles-medium
- fr_FR-tom-medium
- fr_FR-mls-medium

### Spanish (5)
- es_ES-sharvard-medium
- es_ES-davefx-medium
- es_MX-ald-medium
- es_MX-claude-medium
- es_AR-tux-medium

Voice model files (.onnx + .onnx.json) stored in `resources/voices/` and bundled via electron-builder asarUnpack.

## On-Demand Voice Downloads

- New "Voice Library" tab in Settings panel (or section within Voice tab)
- Lists all available Piper voices from a bundled manifest (JSON catalog)
- Shows: name, language, gender, size, sample button, download/delete button
- Downloaded voices stored in `app.getPath('userData')/voices/`
- Download progress shown inline per voice

## IPC Channels

```
TTS.SPEAK       = 'tts:speak'       // text + voiceId + rate + volume -> WAV buffer
TTS.STOP        = 'tts:stop'        // cancel in-progress speech
TTS.STATUS      = 'tts:status'      // ready/busy/unavailable
TTS.LIST_VOICES = 'tts:list-voices' // returns installed voice catalog
TTS.DOWNLOAD    = 'tts:download'    // download a voice model
TTS.DELETE      = 'tts:delete'      // delete a downloaded voice
```

## Text Source for Response Reading (future)

Use xterm terminal buffer extraction (`term.buffer.active.getLine(i).translateToString(true)`) instead of raw PTY accumulator. This gives clean rendered text with no ANSI, no spinners.

## Files to Create

| File | Purpose |
|------|---------|
| `src/main/services/piper-service.ts` | Sidecar spawn, text->WAV pipeline, voice management |
| `src/main/ipc/tts.ipc.ts` | IPC handlers for speak/stop/status/voices/download |
| `src/renderer/src/services/tts-player.ts` | Receives WAV, plays via Howler.js |
| `src/renderer/src/widgets/settings-panel/tabs/VoiceLibraryTab.tsx` | Voice download/manage UI |
| `scripts/setup-piper.sh` | Download/compile piper binary |
| `resources/voices/` | Bundled voice models |

## Files to Modify

| File | Change |
|------|--------|
| `src/renderer/src/services/voice-speaker.ts` | Replace Web Speech API calls with IPC to PiperService |
| `src/renderer/src/hooks/useAgentTts.ts` | Use terminal buffer extraction instead of PTY accumulator |
| `src/renderer/src/widgets/settings-panel/tabs/VoiceTab.tsx` | Replace getVoices() with IPC voice list |
| `src/renderer/src/widgets/settings-panel/tabs/NotificationsTab.tsx` | Replace test button Speech API call |
| `src/renderer/src/App.tsx` | Remove voiceDeps Web Speech API usage, use IPC |
| `src/renderer/src/services/voice-tts.ts` | Update VoiceTtsDeps to use IPC speak |
| `src/renderer/src/stores/view-store.ts` | Replace ttsVoiceURI with piperVoiceId |
| `src/shared/constants/ipc-channels.ts` | Add TTS channel group |
| `src/preload/index.ts` | Add tts bridge |
| `electron-builder.yml` | Add voices/ to asarUnpack |

## Files to Remove

- None — existing voice-speaker.ts gets refactored, not deleted

## Sprint Breakdown (estimate)

| Sprint | Scope |
|--------|-------|
| P1 | Piper binary setup + PiperService + IPC (backend) |
| P2 | tts-player.ts + voice-speaker.ts refactor (frontend) |
| P3 | VoiceTab + VoiceLibraryTab UI update |
| P4 | useAgentTts terminal buffer extraction |
| P5 | Bundle 15 voices + on-demand download |
| P6 | Remove all Web Speech API remnants + regression test |
