# Session Review Panel + Paste Fix Design

**Date:** 2026-06-06
**Status:** Approved

---

## Problem Statement

Three issues identified on app startup with agents from previous sessions:

1. **View Output → blank terminal** — clicking "View Output" on an interrupted (dead process) agent shows a blank xterm because no live PTY exists and no snapshot is replayed.
2. **Resume auto-engages Claude** — `respawnAgent` spawns a Claude CLI process and auto-sends the SBAR context after 2 seconds, burning tokens before the user reaches the dashboard or approves any action.
3. **Paste duplicates input** — pasting into `InlineTaskInput` or the breakout window input inserts content twice.

---

## Design

### 1. Session Review Panel (fixes issues 1 & 2)

#### Recovery Screen

The recovery screen is simplified to two actions per interrupted agent:

- **View Output** — navigates to dashboard with agent selected, opens Session Review Panel
- **Drop** — archives/kills the agent, no spawn

The "Resume" button is removed as a separate action. The dashboard input field becomes the resume trigger.

#### Session Review Panel

Rendered in the agent detail area when an interrupted agent is selected. Contains:

| Section | Content |
|---|---|
| SBAR Summary | Pinned card: Situation, Background, Assessment, Recommendation |
| Terminal Snapshot | Read-only xterm replay of last saved DB snapshot |
| Todos | Open todo items for this agent, highlighted |
| Bugs | Open bug tasks linked to this agent |

Git history is accessible via the existing Git tab on the dashboard — no duplication needed here.

The input field below is active. The user can:
- Type a new prompt
- Pick a todo or bug task to send as the prompt
- Send to trigger `respawnAgent`

#### Hard Rule — No Early Spawn

`respawnAgent` is called in **exactly one place**: when the user explicitly submits from the input field on the dashboard.

The following surfaces are **read-only** and never spawn a Claude process:
- Recovery screen
- Session Review Panel (snapshot, SBAR, todos, bugs display)
- "View Output" navigation path

The 2-second `setTimeout` → `sendInput(SBAR context)` block in `respawnAgent` is removed. SBAR context is displayed in the panel for the user to read — not injected into Claude automatically.

#### Data Flow

```
View Output clicked
  → IPC: fetch snapshot by agentId
  → IPC: fetch SBAR by agentId
  → IPC: fetch todos by agentId
  → IPC: fetch bug tasks by agentId
  → navigate to dashboard, select agent
  → render SessionReviewPanel with fetched data
  → xterm replays snapshot buffer (read-only)
  → user reads, composes prompt, hits send
  → respawnAgent(agentId) called
  → agent spawned, user prompt sent as first input
```

#### Components

- **`SessionReviewPanel`** — new component, renders in agent detail area when agent status is `interrupted`
- **`SBARCard`** — displays SBAR fields in a compact card (may already exist partially)
- **`SnapshotTerminal`** — read-only xterm instance, replays saved buffer, input disabled, "Session ended" badge in toolbar
- Recovery screen: remove Resume button, keep View Output + Drop only

---

### 2. Paste Duplicate Fix (issue 3)

**Affected components:** `InlineTaskInput`, breakout window input (`BreakoutLayout`)

**Root cause:** Both the `onPaste` event and the React `onChange`/controlled value update fire on paste, inserting content twice.

**Fix:** In both components, intercept `onPaste`, call `e.preventDefault()`, read clipboard content via `e.clipboardData.getData('text')`, and insert it once into the controlled value at the current cursor position.

```
onPaste(e)
  → e.preventDefault()
  → text = e.clipboardData.getData('text')
  → insert text at cursor into controlled value (once)
  → onChange fires with updated value (single write)
```

No `onChange` suppression flags or uncontrolled refs needed.

---

## Out of Scope

- Git history in the Session Review Panel (use existing Git tab)
- Modifying the SBAR generation logic
- Changes to agents that are still alive (recovered agents) — only interrupted agents show the Session Review Panel

---

## Acceptance Criteria

- [ ] Clicking "View Output" on an interrupted agent navigates to dashboard and renders Session Review Panel with snapshot, SBAR, todos, and bugs
- [ ] xterm shows last saved snapshot (read-only); no blank terminal
- [ ] No Claude process is spawned until user submits from the input field
- [ ] Recovery screen shows only "View Output" and "Drop" for interrupted agents
- [ ] Pasting into `InlineTaskInput` inserts content exactly once
- [ ] Pasting into breakout input inserts content exactly once
- [ ] All existing tests pass; new tests cover SessionReviewPanel render and paste behavior
