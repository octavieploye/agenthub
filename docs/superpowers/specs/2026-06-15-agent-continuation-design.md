# Agent Continuation Flow — Design Spec
Date: 2026-06-15

## Problem

When the app restarts after a crash or quit, interrupted agents appear on the Recovery Screen. "View Output" switches to the xterm terminal widget, which is empty because the PTY process is gone and the output buffer is in-memory only. Users have no way to see what happened or continue the work without manually re-writing the full context.

## Goals

1. Let users see what the previous agent did (read-only output replay).
2. Let users spawn a new agent that continues from where the last one left off — with a pre-filled prompt based on the SBAR summary + terminal tail, which the user can freely edit.

---

## What Already Exists (reuse these)

- `terminal_output` DB table — all agent output is persisted to SQLite during the session.
- `sbar` table + `getSBARByAgentId(db, agentId)` — structured SBAR handoff (Situation / Background / Assessment / Recommendation) generated when agents stop.
- `getTerminalHistory(db, agentId)` — query that returns all terminal output rows for an agent ordered by `created_at ASC`.
- Recovery screen (`RecoveryScreen.tsx`) — already lists interrupted agents with View Output / Drop buttons.
- SpawnDialog — existing agent spawn modal with cwd, model, repo fields.
- `AgentContextMenu` — right-click menu on agents.

---

## Feature 1 — Output Replay Modal

### Trigger
"View Output" button on recovery screen for any interrupted agent.

### Behavior
Opens a new modal `OutputReplayModal`. Does NOT navigate away from the recovery screen.

### Modal contents
- Header: agent name + status badge + timestamp of last output
- Scrollable read-only `<pre>` block showing the full content from `terminal_output` DB records for that agent, joined in order
- ANSI color codes stripped for readability (or rendered if a simple ANSI parser is available)
- "Spawn Continuation" button at the bottom → opens the Continuation Dialog (Feature 2) pre-seeded with this agent's data
- "Drop Agent" button → same as existing Drop action
- "Close" → dismisses modal, stays on recovery screen

### Data flow
```
onViewOutput(agentId)
  → IPC: agents.getTerminalHistory(agentId)   [new IPC call]
  → returns: string (all rows joined)
  → renders in OutputReplayModal
```

---

## Feature 2 — Continuation Dialog

### Trigger
- "Spawn Continuation" button in OutputReplayModal (Feature 1)
- Right-click any completed or interrupted agent → "Spawn Continuation" (new context menu item)

### Modal: `ContinuationDialog`

New standalone modal, separate from SpawnDialog. Three zones stacked vertically.

#### Zone 1 — Context Summary (read-only, collapsible, default: expanded)
Displays the full SBAR handoff for the previous agent:
```
Situation:      [sbar.situation]
Background:     [sbar.background]
Assessment:     [sbar.assessment]
Recommendation: [sbar.recommendation]
────────────────────────────────────
Terminal tail (last 50 lines):
[last 50 lines of terminal_output]
```
Label: "What the previous agent did". Toggle button: "Show / Hide".
This section is NOT editable. It is the historical record.

#### Zone 2 — Continuation Prompt (editable textarea)
Pre-filled on open by `buildContinuationPrompt(sbar, tail)`:

```
Continue the work from the previous agent session.

## Summary of where we left off

**Situation:** [sbar.situation]
**Background:** [sbar.background]
**Assessment:** [sbar.assessment]
**Recommendation:** [sbar.recommendation]

## Last terminal output (tail)

[last 50 lines joined as plain text]

## Next step

[sbar.recommendation — repeated as the direct instruction]
```

User can freely edit this text — change the next step, add constraints, or clear it entirely and write a new prompt. A "Reset to generated" link restores the auto-generated text.

Label: "Prompt for new agent". Placeholder when cleared: "Write a new prompt or reset to generated."

#### Zone 3 — Agent Configuration
Pre-filled from previous agent, all fields editable:
- Name: "[previous name] (cont.)"
- Directory (cwd): same as previous agent
- Model: same as previous agent
- Repo: same as previous agent

"Spawn Agent" button at bottom → spawns new agent with the edited prompt sent as the initial message.
"Cancel" → dismisses dialog.

### Data flow
```
onSpawnContinuation(agentId)
  → IPC: agents.getSBAR(agentId)              [new IPC call]
  → IPC: agents.getTerminalHistory(agentId)   [same as Feature 1]
  → buildContinuationPrompt(sbar, tail)       [renderer helper]
  → ContinuationDialog opens pre-filled
  → user edits
  → spawnAgent({ cwd, model, repoId, name, taskDescription: userEditedPrompt })
```

`taskDescription` is the existing field in `AgentSpawnOptions`. In `agent-manager.ts` line 355, it is already written to the PTY via `ptyProcess.write(task + '\n')` immediately after spawn. No new wiring needed — the continuation prompt flows through the existing task description mechanism.

---

## New IPC Calls Required

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `agents:getTerminalHistory` | renderer → main | `agentId: string` | `string` (full output joined) |
| `agents:getSBAR` | renderer → main | `agentId: string` | `SBARHandoff \| null` |

Both are read-only DB queries — no side effects.

---

## New Components

| Component | Location | Purpose |
|---|---|---|
| `OutputReplayModal` | `widgets/output-replay/OutputReplayModal.tsx` | Read-only terminal output viewer |
| `ContinuationDialog` | `widgets/continuation-dialog/ContinuationDialog.tsx` | Continuation prompt editor + agent config |
| `buildContinuationPrompt` | `widgets/continuation-dialog/buildContinuationPrompt.ts` | Pure function: (sbar, tail) → string |

---

## Changes to Existing Code

| File | Change |
|---|---|
| `RecoveryScreen.tsx` | `onViewOutput` opens `OutputReplayModal` instead of navigating |
| `AgentContextMenu.tsx` | Add "Spawn Continuation" item (shown for completed/interrupted agents) |
| `App.tsx` | Wire new IPC calls, pass handlers to RecoveryScreen and ContextMenu |
| `src/main/ipc/agents.ipc.ts` | Add handlers for `agents:getTerminalHistory` and `agents:getSBAR` |
| `src/preload/index.ts` | Expose new IPC channels via `window.agentHub.agents` |

---

## Out of Scope

- Replaying ANSI color codes in OutputReplayModal (plain text is sufficient for MVP)
- Automatically sending the continuation prompt without user review
- Storing continuation relationships between agents in the DB
- Showing continuation history chain in the UI

---

## Success Criteria

1. On the recovery screen, clicking "View Output" on an interrupted agent opens a modal showing the full terminal output from the DB.
2. From that modal (or right-click), user can open the Continuation Dialog.
3. The Continuation Dialog opens pre-filled with the SBAR + terminal tail as the prompt.
4. User can edit or clear the prompt.
5. Clicking "Spawn Agent" creates a new agent that receives the prompt as its first message.
6. The new agent begins working from the context provided.
