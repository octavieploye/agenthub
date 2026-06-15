# agenthub

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## Voice TTS (Piper)

AgentHub uses [Piper](https://github.com/rhasspy/piper) for neural text-to-speech. TTS reads the actual Claude response text (not the terminal noise) via a clean structured output channel.

### First-time setup

Download the piper binary and starter voice models (en/fr/es):

```bash
bash scripts/setup-piper.sh
```

This places the piper binary at `resources/bin/piper` and 3 voice models in `resources/voices/`.

### Enabling TTS per agent

Each agent card has a voice mode toggle (click to cycle):

| Icon | Mode | Behaviour |
|------|------|-----------|
| 🔇 | Off | Silent — no TTS |
| 🔔 | Speak Up | Announces `"[Agent] has completed a response."` + reads the response |
| 🔊 | Always On | Same as Speak Up (automatic, no manual trigger needed) |

Only agents with Speak Up or Always On fire TTS. Silent agents have zero extra API cost.

### Configuring voice, speed, and volume

Open **Settings → Voice** (top-right ⚙️):

- **Voice** — dropdown of installed Piper voices (loaded from `resources/voices/`)
- **Volume** — 0–100%
- **Speed** — 0.5× to 2.0×

The selected voice determines language — pick a French voice for French output, English for English, etc.

### Adding more voices

Download any voice from the [Piper voices catalogue](https://huggingface.co/rhasspy/piper-voices/tree/v1.0.0). Place the `.onnx` and `.onnx.json` pair in `resources/voices/` and restart the app — it will appear in the Voice dropdown automatically.

---

## Debugging

### Crash Logs

The app uses `electron-log` to write a persistent debug log. After a crash and recovery cycle, inspect:

```
~/Library/Logs/agenthub/main.log
```

**What's logged:**

| Entry | What it means |
|---|---|
| `Heartbeat` | Memory snapshot (rss, heapUsed, heapTotal in MB) every 30s — shows memory trend leading up to a crash |
| `Process exit { code }` | Exit code when the main process closes |
| `Renderer error` | Uncaught JS exceptions from the renderer (window.onerror) |
| `Renderer error (unhandledRejection)` | Unhandled promise rejections in the renderer |
| `WebGL context lost in renderer` | xterm WebGL canvas lost GPU context — includes agentId |
| `Renderer IPC flood detected` | agentOutput IPC rate exceeded 100 msg/s for 3+ consecutive seconds — includes rate |
| `Renderer process gone` | Electron-level renderer crash — includes reason and exit code |
| `Renderer became unresponsive` | Renderer process hung |
| `Uncaught exception` | Main process uncaught error — includes stack |
| `Unhandled rejection` | Main process unhandled promise rejection |

**Key source files:**

- `src/renderer/src/crash-logger.ts` — renderer-side observers (window errors, IPC flood, WebGL)
- `src/main/ipc/log.ipc.ts` — IPC handler that writes renderer errors to electron-log
- `src/main/index.ts` — heartbeat, exit handler, main process error hooks
- `src/preload/index.ts` — `agentHub.log.rendererError()` bridge binding

**Tail the log in real time during dev:**

```bash
tail -f ~/Library/Logs/agenthub/main.log
```
