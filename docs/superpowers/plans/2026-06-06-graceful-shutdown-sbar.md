# Graceful Shutdown with SBAR Summaries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user closes the app (or it crashes), generate and persist SBAR summaries for every active agent so the next launch can show what each agent was doing.

**Architecture:** Intercept the main window `close` event with `e.preventDefault()`, show a native Electron `dialog.showMessageBox` asking the user whether to save summaries. If yes, iterate the in-memory `agents` Map, call `createAndStoreSBAR()` for each, then quit. For crash resilience, also generate SBARs on each periodic snapshot cycle so there's always a recent summary even on force-kill. On next launch, the existing `buildRecoveryInfo()` + `SessionReviewPanel` already surface SBAR data — extend it to show multiple agents instead of one.

**Tech Stack:** Electron (`dialog`, `BrowserWindow` close event, `app.before-quit`), better-sqlite3, existing SBAR generator, existing recovery manager, React (SessionReviewPanel)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/main/index.ts` | Intercept window close, show dialog, orchestrate shutdown |
| Modify | `src/main/services/agent-manager.ts` | Export `generateAllSBARs()` that creates SBARs for all active agents |
| Modify | `src/main/services/snapshot-engine.ts` | Generate SBARs on each periodic snapshot cycle |
| Modify | `src/main/services/service-orchestrator.ts` | Wire SBAR generation into snapshot provider |
| Modify | `src/renderer/src/widgets/session-review/SessionReviewPanel.tsx` | Show SBAR summaries for multiple agents |
| Modify | `src/renderer/src/App.tsx` | Pass array of SBARs to SessionReviewPanel |
| Create | `src/main/services/__tests__/generate-all-sbars.test.ts` | Tests for SBAR generation logic |

---

### Task 1: Export `generateAllSBARs()` from agent-manager

**Files:**
- Modify: `src/main/services/agent-manager.ts:619-636`
- Test: `src/main/services/__tests__/generate-all-sbars.test.ts`

- [ ] **Step 1: Write the failing test**

Create a test that validates SBAR generation logic per-agent context:

```ts
// src/main/services/__tests__/generate-all-sbars.test.ts
import { describe, it, expect } from 'vitest'
import { generateSBAR, type AgentContext } from '../sbar-generator'
import type { AgentState } from '../../../shared/types/agent.types'

function createTestAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: 'test-1',
    repoId: 'repo-1',
    name: 'test-agent',
    status: 'busy',
    confidence: 'inferred',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    effortLevel: 'medium',
    taskDescription: 'Fix auth bug',
    pid: 1234,
    ptyFd: null,
    cwd: '/tmp/test',
    progress: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    color: '#3B82F6',
    executionMode: 'native',
    voiceMode: 'off',
    ...overrides
  }
}

describe('generateSBAR for shutdown', () => {
  it('generates SBAR with last output lines context', () => {
    const context: AgentContext = {
      agent: createTestAgent(),
      lastOutputLines: ['Building...', 'Compiling auth module', 'Test passed: 3/5']
    }
    const sbar = generateSBAR(context)
    expect(sbar.agentId).toBe('test-1')
    expect(sbar.situation).toContain('Fix auth bug')
    expect(sbar.assessment).toContain('Test passed')
  })

  it('generates SBAR for agent with no output buffer', () => {
    const context: AgentContext = {
      agent: createTestAgent({ id: 'test-2', name: 'idle-agent', status: 'idle', taskDescription: '' }),
      lastOutputLines: []
    }
    const sbar = generateSBAR(context)
    expect(sbar.agentId).toBe('test-2')
    expect(sbar.situation).toContain('unspecified task')
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/main/services/__tests__/generate-all-sbars.test.ts`
Expected: PASS — `generateSBAR` already exists.

- [ ] **Step 3: Add `generateAllSBARs()` to agent-manager**

In `src/main/services/agent-manager.ts`, add this export after `cleanupAllAgents()`:

```ts
export function generateAllSBARs(): number {
  const db = getDb()
  let count = 0
  const now = Date.now()

  for (const [, managed] of agents) {
    try {
      // Skip if SBAR was generated in the last 60 seconds (e.g. by periodic snapshot)
      const existing = getSBARByAgentId(db, managed.state.id)
      if (existing) {
        const createdAt = new Date(existing.createdAt).getTime()
        if (now - createdAt < 60_000) continue
      }

      const context = buildSBARContext(managed)
      createAndStoreSBAR(db, context)
      count++
    } catch (err) {
      log.warn('Failed to generate SBAR on shutdown', {
        agentId: managed.state.id,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }
  log.info('Shutdown SBARs generated', { count })
  return count
}
```

Note: `buildSBARContext` (line 46), `createAndStoreSBAR` (line 19), and `getSBARByAgentId` (line 18) are already imported/defined in agent-manager.ts. The function iterates the in-memory `agents` Map which only contains running agents. The 60-second dedup check prevents duplicate SBARs when a periodic snapshot ran shortly before shutdown.

- [ ] **Step 4: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: clean output, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/agent-manager.ts src/main/services/__tests__/generate-all-sbars.test.ts
git commit -m "feat(shutdown): add generateAllSBARs for active agents"
```

---

### Task 2: Intercept window close with confirmation dialog

**Files:**
- Modify: `src/main/index.ts:1` (add `dialog` to Electron imports)
- Modify: `src/main/index.ts:8` (add `generateAllSBARs`, `listAgents` to imports)
- Modify: `src/main/index.ts:15-53` (add close handler inside `createWindow`)

- [ ] **Step 1: Add `dialog` to Electron imports at line 1**

```ts
import { app, shell, BrowserWindow, Menu, nativeImage, session, systemPreferences, dialog } from 'electron'
```

- [ ] **Step 2: Add `generateAllSBARs` and `listAgents` to agent-manager import at line 8**

```ts
import { cleanupAllAgents, generateAllSBARs, listAgents } from './services/agent-manager'
```

- [ ] **Step 3: Add module-level shutdown flag after line 13**

```ts
let shutdownConfirmed = false
```

- [ ] **Step 4: Add close interceptor inside `createWindow()` after the `ready-to-show` handler (after line 41)**

```ts
mainWindow.on('close', (e) => {
  if (shutdownConfirmed) return

  const activeAgents = listAgents().filter((a) =>
    ['spawning', 'busy', 'idle', 'locked', 'looping', 'paused', 'tray_running'].includes(a.status)
  )

  if (activeAgents.length === 0) return

  e.preventDefault()

  dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Save & Quit', 'Quit Without Saving', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Active Agents Running',
    message: `${activeAgents.length} agent(s) are still running.`,
    detail: 'Would you like to save a summary of their work before closing?'
  }).then(({ response }) => {
    if (response === 0) {
      generateAllSBARs()
      shutdownConfirmed = true
      app.quit()
    } else if (response === 1) {
      shutdownConfirmed = true
      app.quit()
    }
    // response === 2 (Cancel) — do nothing, keep app open
  })
})
```

- [ ] **Step 5: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: clean output.

- [ ] **Step 6: Manual test**

1. Launch app, spawn an agent, click close → dialog appears with 3 buttons
2. Click "Cancel" → app stays open
3. Click "Save & Quit" → SBARs generated, app closes
4. Launch app with no agents, click close → app closes immediately (no dialog)

- [ ] **Step 7: Commit**

```bash
git add src/main/index.ts
git commit -m "feat(shutdown): show save-summary dialog when closing with active agents"
```

---

### Task 3: Generate SBARs on periodic snapshots (crash resilience)

**Files:**
- Modify: `src/main/services/snapshot-engine.ts:27` (WorkspaceStateProvider interface)
- Modify: `src/main/services/snapshot-engine.ts` (takeSnapshot method)
- Modify: `src/main/services/service-orchestrator.ts:108` (provider wiring)

This ensures that even on a crash or force-kill, there's a recent SBAR for each agent.

- [ ] **Step 1: Read `src/main/services/snapshot-engine.ts` fully before modifying**

- [ ] **Step 2: Extend the `WorkspaceStateProvider` interface**

```ts
export interface WorkspaceStateProvider {
  getAgents(): AgentState[]
  generateSBARsForActiveAgents?(): number
}
```

- [ ] **Step 3: Call SBAR generation inside `takeSnapshot`, after the snapshot is saved**

```ts
try {
  this.provider.generateSBARsForActiveAgents?.()
} catch (err) {
  log.warn('Failed to generate periodic SBARs', { error: err instanceof Error ? err.message : String(err) })
}
```

- [ ] **Step 4: Wire the provider in service-orchestrator**

In `src/main/services/service-orchestrator.ts`, around line 108 where the provider is created, add:

```ts
const provider: WorkspaceStateProvider = {
  getAgents: () => listAgents(),
  generateSBARsForActiveAgents: () => generateAllSBARs()
}
```

Add `generateAllSBARs` to the agent-manager import:

```ts
import { listAgents, pauseAgent, killAgent, cleanupAllAgents, generateAllSBARs } from './agent-manager'
```

- [ ] **Step 5: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: clean output.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/snapshot-engine.ts src/main/services/service-orchestrator.ts
git commit -m "feat(shutdown): generate SBARs on periodic snapshots for crash resilience"
```

---

### Task 4: Surface multiple agent SBARs in SessionReviewPanel

**Files:**
- Modify: `src/renderer/src/widgets/session-review/SessionReviewPanel.tsx`
- Modify: `src/renderer/src/App.tsx` (pass SBAR array)

Currently `SessionReviewPanel` accepts a single `sbar: SBARHandoff | null`. After shutdown with multiple agents, there will be multiple SBARs.

- [ ] **Step 1: Read `src/shared/types/recovery.types.ts` to understand RecoveryInfo and SBARHandoff shapes**

- [ ] **Step 2: Update SessionReviewPanel props to accept an array**

Change the interface:

```ts
interface SessionReviewPanelProps {
  sbars: SBARHandoff[]
  todos: TaskItem[]
  bugs: BugEntry[]
  onSpawnWithTask?: (task: string) => void
}
```

- [ ] **Step 3: Update the SBAR rendering block to loop over the array**

```tsx
function SessionReviewPanel({ sbars, todos, bugs, onSpawnWithTask }: SessionReviewPanelProps): React.JSX.Element {
  const openTodos = todos.filter((t) => t.status !== 'completed' && t.status !== 'tested')
  const openBugs = bugs.filter((b) => !b.resolvedAt)

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full" data-testid="session-review-panel">

      {/* SBAR Summaries */}
      <div className="panel-glass p-3 space-y-2">
        <h3 className="text-xs font-semibold text-warning uppercase tracking-wider">
          Last Session Summary ({sbars.length} agent{sbars.length !== 1 ? 's' : ''})
        </h3>
        {sbars.length > 0 ? (
          sbars.map((sbar) => (
            <div key={sbar.id} className="space-y-1 text-xs text-base-content/70 border-b border-base-content/10 pb-2 last:border-0">
              <div className="font-semibold text-base-content/90 text-xs">{sbar.agentName}</div>
              <div data-testid={`sbar-situation-${sbar.id}`}>
                <span className="font-semibold text-base-content/90">Situation: </span>{sbar.situation}
              </div>
              <div data-testid={`sbar-background-${sbar.id}`}>
                <span className="font-semibold text-base-content/90">Background: </span>{sbar.background}
              </div>
              <div data-testid={`sbar-assessment-${sbar.id}`}>
                <span className="font-semibold text-base-content/90">Assessment: </span>{sbar.assessment}
              </div>
              <div data-testid={`sbar-recommendation-${sbar.id}`} className="text-info">
                <span className="font-semibold text-base-content/90">Recommendation: </span>{sbar.recommendation}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-base-content/40" data-testid="sbar-empty">No session summary available.</p>
        )}
      </div>

      {/* Open Todos and Open Bugs sections remain unchanged */}
```

- [ ] **Step 4: Update App.tsx to pass `sbars` array**

Find where `<SessionReviewPanel` is rendered in App.tsx. Change:
- `sbar={someValue}` to `sbars={Array.isArray(someValue) ? someValue : someValue ? [someValue] : []}`

- [ ] **Step 5: Update SessionReviewPanel tests if they exist**

Update test files to pass `sbars` array instead of single `sbar` prop.

- [ ] **Step 6: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: clean output.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/widgets/session-review/SessionReviewPanel.tsx src/renderer/src/App.tsx
git commit -m "feat(recovery): show multiple agent SBAR summaries in session review"
```

---

## Summary

| What | Why |
|------|-----|
| `generateAllSBARs()` in agent-manager | Creates SBAR summaries for all in-memory agents with 60s dedup |
| Close dialog in `index.ts` | Asks user before closing if agents are active |
| Periodic SBAR in snapshot-engine | Crash resilience — always a recent summary available |
| Multi-SBAR SessionReviewPanel | Shows all agent summaries on next launch |
