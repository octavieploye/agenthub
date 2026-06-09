# Xterm Duplicate Paste Fix — Option Analysis

**Date:** 2026-06-09
**Status:** Pending implementation — awaiting user decision

## The Problem

When pasting (Cmd+V) in the xterm terminal, text is sent twice to the agent process.

Two code paths both call `window.agentHub.agents.sendInput(agentId, data)`:

**Path 1 — terminal-manager.ts:202-204** (always-on):
```ts
managed.term.onData((data: string) => {
  window.agentHub.agents.sendInput(agentId, data)
})
```

**Path 2 — FullTerminal.tsx:93-96** (Cmd+V interceptor):
```ts
if (isMeta && e.key === 'v') {
  const text = window.agentHub.clipboard.readText()
  if (text) window.agentHub.agents.sendInput(agentId, text)
  return false
}
```

**Root cause:** `return false` from `attachCustomKeyEventHandler` suppresses xterm's internal keydown handling, but the OS independently fires a separate `paste` DOM event on xterm's textarea. xterm picks that up via its own paste listener and fires `onData`. So both paths always fire — `return false` was never blocking the duplicate.

---

## Option A — Remove the Cmd+V block (AGREED)

**File:** `src/renderer/src/widgets/full-terminal/FullTerminal.tsx`

**Change:** Delete lines 93-97:
```ts
// REMOVE:
if (isMeta && e.key === 'v') {
  const text = window.agentHub.clipboard.readText()
  if (text) window.agentHub.agents.sendInput(agentId, text)
  return false
}
```

**Why it works:** xterm's native paste event fires on its internal textarea, which triggers `onData` in terminal-manager.ts. That becomes the single paste path. No more duplicate.

**Risks:**
- If Electron's clipboard permissions block the DOM `paste` event in the renderer, paste silently stops. Uncommon but needs a smoke test after the change.
- Breakout window (secondary BrowserWindow) clipboard behavior may differ — needs testing.
- No test changes needed (FullTerminal.test.tsx has no Cmd+V assertion).

**Verdict: Clean, minimal, correct fix.**

---

## Option B — Intercept the native paste DOM event

**Approach:** Add a capture-phase `paste` listener on xterm's internal `<textarea>` with `stopImmediatePropagation` to block xterm's own paste handler, keeping Path 2 as the sole paste source.

**Why it is fragile:**
- Adding `onPaste`/`preventDefault` to the container `<div>` (the React-natural approach) does NOT work — it fires in bubble phase, after xterm already processed the event.
- A working version requires imperatively querying xterm's hidden `<textarea>` after mount and attaching a capture-phase listener — brittle DOM surgery on xterm's undocumented internals.
- Any xterm version update can silently break paste.

**Verdict: Fragile, overengineered, wrong layer.**

---

## Decision

**Option A selected.** Implement by removing the 5-line Cmd+V block from `FullTerminal.tsx:93-97`. Verify with a manual paste test after the change.
