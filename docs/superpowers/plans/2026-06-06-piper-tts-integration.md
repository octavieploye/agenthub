# Piper TTS Integration Plan — Replace Web Speech API

**Status:** TODO — parked for future sprint
**Date:** 2026-06-06

## Problem

Any TTS engine (macOS, Piper, Coqui, etc.) will read gibberish if fed raw PTY terminal output. The problem is not the voice engine — it's the text extraction layer upstream. Raw PTY mixes:
- ANSI escape codes / cursor movements
- Claude CLI spinner words ("Sprouting", "Thundering" — real English words)
- Tool call output (file reads, edits, bash commands)
- Approval prompts and prompt markers
- The actual natural language response

All interleaved, all streaming. This is a **terminal output parsing problem**, not a TTS problem.

macOS Web Speech API adds its own issues on top:
- Language stuck in French (getVoices() race condition, falls back to system locale)
- Looping (speechSynthesis queue + status flicker = repeated utterances)

## Solution — Two Layers

### Layer 1: Response Extraction (engine-agnostic)

Use Claude CLI `--output-format stream-json` as a **parallel structured data channel** alongside the raw PTY visual display. This emits newline-delimited JSON events with typed separation:

- `text_delta` — actual assistant response text (what TTS should read)
- `input_json_delta` — tool call arguments (skip)
- `content_block_start/stop` — boundaries between text and tool use
- `message_start/stop` — full turn boundaries

The key insight: **don't read from the terminal for TTS**. Tap into Claude's structured output stream as a separate data channel. The terminal stays visual-only.

### Layer 2: Voice Engine (Piper)

Replace Web Speech API with Piper neural TTS sidecar — same pattern as existing whisper.cpp STT sidecar.

## Architecture

```
Claude CLI spawn (agent-manager.ts)
    |
    ├── Raw PTY → xterm.js (visual display, unchanged)
    |
    └── --output-format stream-json → ResponseCollector (NEW)
              |
              ├── text_delta events → accumulate response text per agent
              ├── content_block_stop → paragraph boundary
              ├── message_stop → response complete, text finalized
              |
              └── Clean text → PiperService → WAV → Howler.js playback
                                   |
                                   ├── pipe text to stdin (--json-input)
                                   ├── spawn(piper, ['--model', model, '--output_raw'])
                                   ├── PCM audio stdout → Buffer → WAV
                                   └── Return WAV buffer to renderer via IPC
```

### ResponseCollector Design

```typescript
// New service: src/main/services/response-collector.ts
//
// Attaches to the Claude CLI spawn alongside the PTY.
// Parses stream-json events and accumulates only text_delta content.
//
// spawn('claude', [...args, '--output-format', 'stream-json'])
//   → stdout line-by-line → JSON.parse each line
//   → filter event.type === 'content_block_delta'
//     && event.delta.type === 'text_delta'
//   → accumulate event.delta.text into per-agent buffer
//   → on message_stop → emit 'response-ready' with full clean text
//
// The PTY spawn continues separately for terminal display.
// ResponseCollector is a read-only listener — does not affect agent behavior.
```

### stream-json Event Types (reference)

```jsonl
{"type":"message_start","message":{"id":"msg_...","role":"assistant"}}
{"type":"content_block_start","index":0,"content_block":{"type":"text"}}
{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Here is "}}
{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"my response."}}
{"type":"content_block_stop","index":0}
{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","name":"Read"}}
{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{..."}}
{"type":"content_block_stop","index":1}
{"type":"message_delta","delta":{"stop_reason":"end_turn"}}
{"type":"message_stop"}
```

Only `text_delta` events with `content_block.type === "text"` are collected for TTS.
Tool use blocks (`content_block.type === "tool_use"`) are ignored entirely.

### Dual Spawn Strategy

agent-manager.ts currently spawns Claude as a single PTY process. Two options:

**Option A — Dual process:** Spawn two Claude processes per agent — one PTY for display, one with `--output-format stream-json` for structured text. Wasteful (double API cost).

**Option B — PTY + parser (recommended):** Keep single PTY spawn. Add `--output-format stream-json` flag. The PTY output goes to xterm as before. A parallel parser reads the same stdout and extracts structured events. If Claude CLI doesn't support both simultaneously, use the `--verbose` flag which may include structured markers in the PTY stream, or intercept at the IPC batch level.

**Option C — Post-hoc buffer read (fallback):** If stream-json can't coexist with PTY mode, fall back to xterm buffer extraction on `busy→locked` transition. Less clean but functional.

Investigation needed: does `claude --output-format stream-json` work with PTY spawn, or only with pipe mode?

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

## Piper JSON Input Mode

Piper supports `--json-input` flag for selective text control:
```jsonl
{ "text": "Agent has completed a response." }
{ "text": "Here is the last paragraph of the actual response." }
```
Each JSON object is spoken separately. Multi-speaker models support `speaker_id` per line.

## Files to Create

| File | Purpose |
|------|---------|
| `src/main/services/response-collector.ts` | Parses stream-json events, accumulates text_delta only |
| `src/main/services/piper-service.ts` | Sidecar spawn, text->WAV pipeline, voice management |
| `src/main/ipc/tts.ipc.ts` | IPC handlers for speak/stop/status/voices/download |
| `src/renderer/src/services/tts-player.ts` | Receives WAV, plays via Howler.js |
| `src/renderer/src/widgets/settings-panel/tabs/VoiceLibraryTab.tsx` | Voice download/manage UI |
| `scripts/setup-piper.sh` | Download/compile piper binary |
| `resources/voices/` | Bundled voice models |

## Files to Modify

| File | Change |
|------|--------|
| `src/main/services/agent-manager.ts` | Add ResponseCollector alongside PTY spawn, investigate stream-json + PTY coexistence |
| `src/renderer/src/services/voice-speaker.ts` | Replace Web Speech API calls with IPC to PiperService |
| `src/renderer/src/hooks/useAgentTts.ts` | Listen for 'response-ready' events instead of PTY accumulator |
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
| P0 | **Investigation:** test `claude --output-format stream-json` with PTY spawn mode. Determine if dual-channel is possible or if fallback needed. |
| P1 | **ResponseCollector:** parse stream-json, accumulate text_delta, emit response-ready events |
| P2 | **Piper backend:** binary setup + PiperService + IPC channels |
| P3 | **Piper frontend:** tts-player.ts + voice-speaker.ts refactor (replace Web Speech API) |
| P4 | **useAgentTts refactor:** listen for response-ready events, send clean text to Piper |
| P5 | **UI:** VoiceTab + VoiceLibraryTab update, voice picker, download manager |
| P6 | **Voices:** Bundle 15 default voices + on-demand download infrastructure |
| P7 | **Cleanup:** Remove all Web Speech API remnants + regression test |

## Research Sources

- [Claude Code stream-json output format](https://backgroundclaude.com/blog/stream-json)
- [format-claude-stream — CLI filter for structured output](https://github.com/Khan/format-claude-stream)
- [Parsing stream-json with jq](https://www.ytyng.com/en/blog/claude-stream-json-jq)
- [stream-json event type reference issue](https://github.com/anthropics/claude-code/issues/24596)
- [Wrapping Claude CLI for agentic applications](https://avasdream.com/blog/claude-cli-agentic-wrapper)
- [Piper TTS GitHub](https://github.com/rhasspy/piper)
- [piper-electron — Electron GUI](https://github.com/davealaw/piper-electron)
- [piper-tts-web — Browser ONNX for AnythingLLM](https://github.com/Mintplex-Labs/piper-tts-web)
- [FinalTerm shell integration proposal](https://per.bothner.com/blog/2019/shell-integration-proposal/)
- [xterm.js shell integration](https://github.com/xtermjs/xterm.js/issues/576)
- [xterm.js IBuffer API](https://xtermjs.org/docs/api/terminal/interfaces/ibuffer/)
