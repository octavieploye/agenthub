# Crash Debugging
_Last reviewed: 2026-10-02_

When investigating app crashes or unexpected restarts:

- **Log file:** `~/Library/Logs/agenthub/main.log` — always check this first
- **Heartbeat entries** appear every 30s with memory usage (rss/heapUsed/heapTotal in MB) — look at the trend before the last entry
- **Renderer errors** (`window.onerror`, unhandled rejections) are forwarded from the renderer via `log:renderer-error` IPC — look for `Renderer error` entries
- **WebGL context loss** is logged with the `agentId` — look for `WebGL context lost in renderer`
- **IPC flood** is logged if `agentOutput` exceeds 100 msg/s for 3 consecutive seconds — look for `Renderer IPC flood detected`
- **Renderer process gone** / **Renderer became unresponsive** are Electron-level events logged in main

Key files to read when debugging crashes:
- `src/renderer/src/crash-logger.ts` — all renderer-side observers
- `src/main/ipc/log.ipc.ts` — how renderer errors reach electron-log
- `src/main/index.ts` — main process error hooks and heartbeat
- `src/main/services/recovery-manager.ts` — crash recovery logic
