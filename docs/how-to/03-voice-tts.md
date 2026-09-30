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

## Which Field Voice Types Into

Voice input writes into one field at a time. With several agents open, AgentHub picks
the target in this order:

1. The field you clicked into — whatever has your cursor wins.
2. The prompt field of the agent you currently have selected.
3. If there is only one usable field on screen, that one.

If none of those apply, `Cmd+E` does nothing rather than guess. This keeps a dictated
prompt from landing in another agent's field.

A greyed-out field is never a target. If `Cmd+E` seems to do nothing, check whether the
agent is busy, paused, or its session has ended — see [Agents](05-agents.md).
