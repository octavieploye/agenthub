# Voice & TTS

AgentHub supports two voice features: speech input (Whisper) and text-to-speech output (Piper).

## Text-to-Speech (TTS) — Piper

Piper is the local TTS engine. When enabled for an agent, AgentHub reads completed responses aloud.

### Enable TTS for an Agent

Open the agent's detail panel → **General** tab → **Voice Mode** dropdown:

| Mode | Behaviour |
|------|-----------|
| `off` | No voice — default |
| `tts` | Speaks completed responses |
| `sts` | Full speech-to-speech (requires Whisper setup) |

### Piper Setup

Piper requires a binary and voice files in `resources/`:

```
resources/
  bin/
    piper              ← Piper binary (chmod +x)
  voices/
    en_US-amy-medium.onnx
    en_US-amy-medium.onnx.json
```

Without these files, TTS falls back to silent mode. Check `~/Library/Logs/agenthub/main.log` for TTS errors.

### Volume Control

In the SABar toolbar, hover over the speaker icon to reveal a vertical volume slider. The slider controls TTS volume (0–100%).

## Speech Input (Whisper)

Whisper transcribes your voice to text and sends it to the active agent.

### Microphone Permission

macOS will prompt for microphone access on first use. Grant it in System Settings → Privacy & Security → Microphone.

### Using Voice Input

- Press the microphone button in the agent's terminal area
- Speak — transcription appears as input
- Release to send

### Whisper Setup

Requires `resources/bin/whisper-cli` binary and `~/Library/Application Support/agenthub/models/ggml-small.bin` model file.

## TTS Volume Shortcut

The volume slider in SABar is only for TTS output, not system volume. Use it to avoid disturbing others while keeping notifications audible.
