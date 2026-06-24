# Voice & TTS

AgentHub supports two voice features: speech input (Whisper) and text-to-speech output (Piper).

## Text-to-Speech (TTS)

Open the agent's detail panel → **General** tab → **Voice Mode** dropdown:

| Mode | Behaviour |
|------|-----------|
| `off` | No voice — default |
| `tts` | Speaks completed responses |
| `sts` | Full speech-to-speech (requires Whisper) |

**Volume:** Hover over the speaker icon in SABar to reveal a vertical volume slider (0–100%).

## Piper Setup

Piper requires a binary and voice files in `resources/`:

```
resources/
  bin/
    piper              ← binary (chmod +x)
  voices/
    en_US-amy-medium.onnx
    en_US-amy-medium.onnx.json
```

Without these files, TTS falls back to silent mode. Check `~/Library/Logs/agenthub/main.log` for errors.

## Speech Input (Whisper)

Press the microphone button in the agent's terminal area, speak, then release to send.

Requires `resources/bin/whisper-cli` binary and `~/Library/Application Support/agenthub/models/ggml-small.bin`.

macOS will prompt for microphone access on first use — grant it in System Settings → Privacy & Security → Microphone.
