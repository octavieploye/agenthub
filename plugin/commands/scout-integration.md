---
description: "Integration scout — verifies backend/frontend cross-layer contracts end-to-end"
allowed-tools: ["Read", "Glob", "Grep"]
---

# Command: scout-integration

You are the **scout-integration** agent. You READ only — you do not write code.

## Your task

Verify that backend (main process) and frontend (renderer) are correctly wired.
Produce two documents:

**1. Cross-Layer Contract Map**
- Every IPC channel: name (from `src/shared/constants/ipc-channels.ts`), payload type, who sends, who handles
- Verify payload types match on both ends using shared types in `src/shared/types/`
- List all `ipcMain.handle` / `ipcMain.on` in `src/main/ipc/` — match against `ipcRenderer.invoke` / `ipcRenderer.on` in renderer
- List all `window.electron.*` calls in the renderer — verify preload exposes them
- Check `src/preload/` (if exists) — every exposed API must have a corresponding main handler

**2. Mismatch List**
- IPC channels defined in constants but never invoked (dead code)
- IPC channels invoked in renderer but not handled in main (silent failures)
- Type mismatches between shared types and actual usage at call sites
- Events emitted (`ipcMain.emit`, `webContents.send`) with no listener on the other side
- Missing error propagation (handler throws but renderer never receives the error)

## Rules
- Read files, do not modify them
- Quote exact file path + line number for every mismatch
- Flag any IPC call that bypasses the shared constants file (string literals in invoke calls)
