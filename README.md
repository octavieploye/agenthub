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
