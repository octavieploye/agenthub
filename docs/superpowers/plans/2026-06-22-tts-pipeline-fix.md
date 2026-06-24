# TTS Pipeline Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all TTS runtime malfunctions — stop false fires at launch, fix Cmd+Shift+I, add speech queue, add approval TTS, correct sound mapping, and clean up dead code.

**Architecture:** Two-phase fix. Phase 1 stops the broken behavior (false fires, startup TTS, hotkey). Phase 2 adds missing functionality (approval TTS, speech queue, correct sounds). All changes are additive or surgical — the underlying TtsTrigger/filter/BEL/Piper pipeline is architecturally sound and is NOT being replaced.

**Tech Stack:** TypeScript, Electron (main + renderer), vitest, node-pty, Piper TTS, Howler.js, Web Audio API

## Global Constraints

- NEVER mock modules with `vi.mock()` — use `vi.fn()` for spies only, real implementations for everything else
- NEVER change tests to pass — fix the code
- Test files use `createMockAgent()` or `makeAgent()` helpers with `Partial<AgentState>` + spread
- Mock agents MUST include `color: '#3B82F6'` field
- All test files clean up after themselves (beforeEach/afterEach)
- Run type-checking after every task: `npx tsc --noEmit`
- Default voiceMode for new agents must be `'off'` (not `'always_on'`)

---

## Phase 1: Stop the Broken Behavior

---

### Task 1: Fix startup TTS — add `hasSentInput` guard to suppress TTS until user interaction

The `primed: false` mechanism in TtsTrigger is defeated by Claude CLI's multi-phase startup (shell prompt → CLI banner → spinner → prompt), which causes multiple busy/locked cycles that prime the trigger before the user has sent anything. The fix is a hard gate in agent-manager: never emit RESPONSE_READY until the user has actually sent input to this agent.

**Files:**
- Modify: `src/main/services/agent-manager.ts:42-59` (ManagedAgent interface), `:415-436` (TtsTrigger init + agents.set), `:516-527` (sendInput), `:479-501` (task auto-send paths)
- Modify: `src/main/utils/tts-trigger.test.ts` (add regression test documenting multi-cycle startup)
- Test: `src/main/utils/tts-trigger.test.ts`

**Interfaces:**
- Produces: `ManagedAgent.hasSentInput: boolean` field — internal to agent-manager

- [ ] **Step 1: Write regression test documenting multi-cycle startup bug**

Add to `src/main/utils/tts-trigger.test.ts` inside the `TtsTrigger — task-agent startup banner suppression` describe block:

```typescript
it('REGRESSION: multi-cycle startup (shell→banner→prompt) primes trigger and fires on banner', () => {
  // Documents the bug: Claude CLI startup has multiple status cycles.
  // Shell prompt → locked (skipped by primed:false) → CLI spinner → busy →
  // CLI prompt → locked (primed was set to true by locked→busy, so this FIRES)
  const emit = vi.fn()
  const trigger = new TtsTrigger({ debounceMs: 300, onEmit: emit, primed: false })

  // Phase 1: shell prompt → busy→locked
  trigger.onStatusChange('busy', 'locked', '')
  vi.advanceTimersByTime(100)
  // Phase 2: Claude CLI starts → locked→busy (primes the trigger!)
  trigger.onStatusChange('locked', 'busy', '')
  // Phase 3: CLI banner done → busy→locked (trigger is primed, fires!)
  trigger.onStatusChange('busy', 'locked', 'Tips for getting started with Claude Code...')
  vi.advanceTimersByTime(300)

  // BUG confirmed: TtsTrigger fires with banner text.
  // The guard must live in agent-manager (hasSentInput), not TtsTrigger.
  expect(emit).toHaveBeenCalledTimes(1)
  expect(emit).toHaveBeenCalledWith('Tips for getting started with Claude Code...')
})
```

- [ ] **Step 2: Run test to confirm it passes (documents current behavior)**

Run: `npx vitest run src/main/utils/tts-trigger.test.ts --reporter verbose`
Expected: PASS — this test confirms TtsTrigger fires on multi-cycle startup.

- [ ] **Step 3: Add `hasSentInput` to ManagedAgent and wire the guard**

In `src/main/services/agent-manager.ts`:

**3a.** Add `hasSentInput` to the ManagedAgent interface (after line 58, before the closing `}`):

```typescript
  /** True once the user (or task auto-send) has written input to this agent's PTY. */
  hasSentInput: boolean
```

**3b.** In the `onEmit` callback (around line 425), add the guard. Replace the current onEmit:

```typescript
    onEmit: (text: string) => {
      const current = agents.get(agentState.id)
      if (!current) return
      if (!current.hasSentInput) {
        log.debug('[TTS] suppressed RESPONSE_READY — no user input yet', { agentId: agentState.id })
        current.cleanTextBuffer = ''
        return
      }
      current.cleanTextBuffer = ''
      log.info('[TTS] emitting RESPONSE_READY', {
        agentId: agentState.id,
        textLen: text.length,
        preview: text.slice(0, 200).replace(/\n/g, '↵'),
      })
      emitToAllRenderers(IPC_EVENTS.TTS.RESPONSE_READY, agentState.id, text)
    }
```

**3c.** Add `hasSentInput: false` to the `agents.set()` call (line 436). Add it after `ttsTrigger`:

```typescript
  agents.set(agentState.id, {
    state: agentState, ptyProcess, parser,
    outputBuffer: '', flushTimer: null,
    ipcBatchBuffer: '', ipcBatchTimer: null,
    responseCollector: null, cleanTextBuffer: '',
    ttsStatus: agentState.status, ttsTrigger,
    hasSentInput: false
  })
```

**3d.** Set `hasSentInput = true` at the top of `sendInput()` (around line 518, after the null check):

```typescript
export function sendInput(agentId: string, data: string): void {
  const managed = agents.get(agentId)
  if (!managed) throw new Error(`Agent ${agentId} not found`)
  managed.hasSentInput = true
  console.log('[Main sendInput]', { agentId, len: data.length, preview: data.slice(0, 80) })
  // ... rest unchanged
```

**3e.** Set `hasSentInput = true` in the Ollama task auto-send (around line 486-488):

```typescript
      if (task) {
        setTimeout(() => {
          const mOllama = agents.get(agentState.id)
          if (mOllama) {
            mOllama.cleanTextBuffer = ''
            mOllama.hasSentInput = true
          }
          ptyProcess.write(task + '\n')
```

**3f.** Set `hasSentInput = true` in the non-Ollama task auto-send (around line 494-496):

```typescript
  } else if (task) {
    setTimeout(() => {
      const mTask = agents.get(agentState.id)
      if (mTask) {
        mTask.cleanTextBuffer = ''
        mTask.hasSentInput = true
      }
      const escapedTask = task.replace(/"/g, '\\"')
```

- [ ] **Step 4: Run TTS tests and type-check**

Run: `npx vitest run src/main/utils/tts-trigger.test.ts --reporter verbose && npx tsc --noEmit`
Expected: All tests pass, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/agent-manager.ts src/main/utils/tts-trigger.test.ts
git commit -m "fix(tts): add hasSentInput guard to suppress TTS before user interaction

The primed:false mechanism in TtsTrigger is defeated by Claude CLI's
multi-phase startup which has multiple busy/locked cycles. This adds a
hard gate: RESPONSE_READY is never emitted until the user (or auto-task)
has actually sent input to the agent's PTY."
```

---

### Task 2: Revert default voiceMode to `'off'`

Every new agent currently defaults to `always_on` (commit `ef72027`), meaning all TTS bugs are audible for every new agent. Revert to `'off'` — users opt in via agent settings.

**Files:**
- Modify: `src/main/db/queries/agents.queries.ts:102`

**Interfaces:**
- Produces: New agents have `voiceMode: 'off'` by default

- [ ] **Step 1: Change the default**

In `src/main/db/queries/agents.queries.ts`, line 102, change:

```typescript
  const voiceMode = agent.voiceMode ?? 'off'
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/db/queries/agents.queries.ts
git commit -m "fix(tts): revert default voiceMode to 'off'

New agents are silent until user opts in. The always_on default (ef72027)
made every startup TTS bug audible for all agents."
```

---

### Task 3: Fix Cmd+Shift+I — add fallback agent selection and error logging

Two problems: (1) `focusedAgentId` is often null so `readFullResponse` silently returns, (2) there is no feedback when it fails. Fix: fall back to the most recent responding agent when no agent is focused. Add console warnings for all silent failure paths.

**Files:**
- Modify: `src/renderer/src/hooks/useAgentTts.ts:89-95`
- Modify: `src/renderer/src/App.tsx:498-502`
- Test: `src/renderer/src/hooks/useAgentTts.test.ts`

**Interfaces:**
- Consumes: `useViewStore.getState().focusedAgentId`, `useAgentStore.getState().agents`
- Produces: `readFullResponse(agentId)` now logs warnings on failure; App.tsx falls back to most recent agent

- [ ] **Step 1: Write failing tests**

Add to `src/renderer/src/hooks/useAgentTts.test.ts`:

```typescript
it('readFullResponse with null agentId logs a warning', async () => {
  const agent = makeAgent({ voiceMode: 'always_on' })
  const agents = new Map([['agent-1', agent]])
  const { result } = renderHook(() => useAgentTts(agents))
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  await act(async () => {
    result.current.readFullResponse(null)
  })

  expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining('[useAgentTts]'),
    expect.stringContaining('no agent')
  )
  warnSpy.mockRestore()
})

it('readFullResponse with valid agent but no stored text logs a warning', async () => {
  const agent = makeAgent({ voiceMode: 'always_on' })
  const agents = new Map([['agent-1', agent]])
  const { result } = renderHook(() => useAgentTts(agents))
  const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  // Don't emit any responseReady — lastResponseText is empty
  await act(async () => {
    result.current.readFullResponse('agent-1')
  })

  expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining('[useAgentTts]'),
    expect.stringContaining('no stored text')
  )
  expect(hub.tts.speak).not.toHaveBeenCalled()
  warnSpy.mockRestore()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/src/hooks/useAgentTts.test.ts --reporter verbose`
Expected: FAIL — current code returns silently without logging.

- [ ] **Step 3: Add warning logs to readFullResponse**

In `src/renderer/src/hooks/useAgentTts.ts`, replace `readFullResponse` (lines 89-95):

```typescript
  const readFullResponse = useCallback((agentId: string | null) => {
    if (!agentId) {
      console.warn('[useAgentTts] readFullResponse: no agent focused — press arrow keys to select an agent first')
      return
    }
    const text = lastResponseText.current.get(agentId)
    if (!text) {
      console.warn('[useAgentTts] readFullResponse: no stored text for agent', agentId)
      return
    }
    cancelSpeech()
    invokeTts(text).catch((err) => console.warn('[useAgentTts] readFullResponse error:', err))
  }, [])
```

- [ ] **Step 4: Add fallback agent selection in App.tsx**

In `src/renderer/src/App.tsx`, replace the Cmd+Shift+I handler (lines 498-502):

```typescript
        // Cmd+Shift+I — read full response for the focused agent (or most recent)
        if (e.key === 'I' && e.shiftKey) {
          e.preventDefault()
          let targetId = useViewStore.getState().focusedAgentId
          if (!targetId) {
            // Fallback: find the most recently updated agent that has responded
            const allAgents = Array.from(useAgentStore.getState().agents.values())
            const recent = allAgents
              .filter((a) => a.status === 'locked' || a.status === 'completed' || a.status === 'awaiting_approval')
              .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
            targetId = recent[0]?.id ?? null
          }
          readFullResponse(targetId)
        }
```

- [ ] **Step 5: Run tests and type-check**

Run: `npx vitest run src/renderer/src/hooks/useAgentTts.test.ts --reporter verbose && npx tsc --noEmit`
Expected: All tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/hooks/useAgentTts.ts src/renderer/src/App.tsx src/renderer/src/hooks/useAgentTts.test.ts
git commit -m "fix(tts): fix Cmd+Shift+I — add fallback agent selection and error logging

readFullResponse silently returned when focusedAgentId was null (common
when user hasn't clicked an agent card). Now falls back to most recently
updated agent and logs warnings on all failure paths."
```

---

### Task 4: Fix BEL false positives from tool output

The BEL character (`\x07`) in tool stdout (e.g., terminal-aware Bash commands) falsely triggers a busy→locked transition, causing premature TTS mid-tool-use. Fix: require ≥10 words of filtered prose before using BEL as a TTS accelerator.

**Files:**
- Modify: `src/main/services/agent-manager.ts:256-266` (BEL handler)

**Interfaces:**
- Consumes: `managed.cleanTextBuffer`, `filterTtsResponse()`, `managed.ttsStatus`
- Produces: BEL fast-path only fires when filtered text has ≥10 words

- [ ] **Step 1: Add prose-length guard to BEL fast-path**

In `src/main/services/agent-manager.ts`, replace lines 256-266:

```typescript
    // BEL character (\x07) — Claude CLI sends this when a response completes.
    // Only use as TTS accelerator when the filtered buffer has substantial prose.
    // BEL can appear in tool stdout (terminal-aware Bash commands), so guard
    // against false positives by requiring >=10 words of filtered prose.
    if (data.includes('\x07') && managed) {
      if (managed.ttsStatus === 'busy') {
        const rawFiltered = filterTtsResponse(managed.cleanTextBuffer.trim())
        const wordCount = rawFiltered.trim().split(/\s+/).filter((w) => w.length > 0).length
        if (wordCount >= 10) {
          log.debug('[TTS] BEL detected — accelerating locked transition', { agentId: agentState.id, filteredLen: rawFiltered.length, wordCount })
          managed.ttsStatus = 'locked'
          managed.ttsTrigger.onStatusChange('busy', 'locked', rawFiltered)
        } else {
          log.debug('[TTS] BEL detected but insufficient prose, ignoring', { agentId: agentState.id, wordCount })
        }
      }
    }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/services/agent-manager.ts
git commit -m "fix(tts): guard BEL fast-path against false positives from tool output

BEL in tool stdout was falsely triggering busy->locked, causing premature
TTS mid-tool-use. Now requires >=10 words of filtered prose before
accelerating the transition."
```

---

## Phase 2: Add Missing Functionality

---

### Task 5: Add speech queue to prevent cacophony

When multiple agents fire RESPONSE_READY near-simultaneously, `playWav()` calls `stopPlayback()`, killing in-progress audio. Add a FIFO queue that serializes speech requests.

**Files:**
- Create: `src/renderer/src/services/tts-queue.ts`
- Create: `src/renderer/src/services/tts-queue.test.ts`
- Modify: `src/renderer/src/hooks/useAgentTts.ts:18-22` (replace direct invokeTts with queue)

**Interfaces:**
- Produces: `TtsQueue` class with `enqueue(text: string): void`, `clear(): void`, `get pending(): number`
- Consumed by: `useAgentTts.ts` (this task), approval TTS (Task 7)

- [ ] **Step 1: Write failing tests for TtsQueue**

Create `src/renderer/src/services/tts-queue.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { TtsQueue } from './tts-queue'

describe('TtsQueue', () => {
  let speakFn: ReturnType<typeof vi.fn>
  let queue: TtsQueue

  afterEach(() => {
    queue?.clear()
  })

  it('speaks a single item immediately', async () => {
    speakFn = vi.fn().mockResolvedValue(undefined)
    queue = new TtsQueue(speakFn)

    queue.enqueue('Hello')
    await vi.waitFor(() => expect(speakFn).toHaveBeenCalledWith('Hello'))
  })

  it('serializes multiple items — second waits for first', async () => {
    let resolve1!: () => void
    const p1 = new Promise<void>((r) => { resolve1 = r })
    speakFn = vi.fn().mockReturnValueOnce(p1).mockResolvedValue(undefined)
    queue = new TtsQueue(speakFn)

    queue.enqueue('First')
    queue.enqueue('Second')

    await vi.waitFor(() => expect(speakFn).toHaveBeenCalledTimes(1))
    expect(speakFn).toHaveBeenCalledWith('First')

    resolve1()
    await vi.waitFor(() => expect(speakFn).toHaveBeenCalledTimes(2))
    expect(speakFn).toHaveBeenCalledWith('Second')
  })

  it('clear() stops pending items from being spoken', async () => {
    let resolve1!: () => void
    const p1 = new Promise<void>((r) => { resolve1 = r })
    speakFn = vi.fn().mockReturnValueOnce(p1).mockResolvedValue(undefined)
    queue = new TtsQueue(speakFn)

    queue.enqueue('First')
    queue.enqueue('Second')
    queue.enqueue('Third')

    queue.clear()
    resolve1()

    await new Promise((r) => setTimeout(r, 50))
    expect(speakFn).toHaveBeenCalledTimes(1)
  })

  it('pending count reflects queued items', () => {
    speakFn = vi.fn().mockReturnValue(new Promise(() => {}))
    queue = new TtsQueue(speakFn)

    queue.enqueue('A')
    queue.enqueue('B')
    queue.enqueue('C')
    expect(queue.pending).toBe(2)
  })

  it('handles speak errors gracefully — continues to next item', async () => {
    speakFn = vi.fn()
      .mockRejectedValueOnce(new Error('piper crash'))
      .mockResolvedValueOnce(undefined)
    queue = new TtsQueue(speakFn)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    queue.enqueue('Will fail')
    queue.enqueue('Will succeed')

    await vi.waitFor(() => expect(speakFn).toHaveBeenCalledTimes(2))
    expect(speakFn).toHaveBeenCalledWith('Will succeed')
    warnSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/src/services/tts-queue.test.ts --reporter verbose`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement TtsQueue**

Create `src/renderer/src/services/tts-queue.ts`:

```typescript
/**
 * FIFO speech queue — serializes TTS requests so agents don't cut each
 * other off. Each enqueued text waits for the previous one to finish.
 */
export class TtsQueue {
  private queue: string[] = []
  private speaking = false
  private speakFn: (text: string) => Promise<void>

  constructor(speakFn: (text: string) => Promise<void>) {
    this.speakFn = speakFn
  }

  enqueue(text: string): void {
    this.queue.push(text)
    if (!this.speaking) this.drain()
  }

  clear(): void {
    this.queue = []
  }

  get pending(): number {
    return this.queue.length
  }

  private async drain(): Promise<void> {
    if (this.speaking) return
    this.speaking = true
    while (this.queue.length > 0) {
      const text = this.queue.shift()!
      try {
        await this.speakFn(text)
      } catch (err) {
        console.warn('[TtsQueue] speak error, continuing:', err)
      }
    }
    this.speaking = false
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/src/services/tts-queue.test.ts --reporter verbose`
Expected: All pass.

- [ ] **Step 5: Wire TtsQueue into useAgentTts**

In `src/renderer/src/hooks/useAgentTts.ts`:

**5a.** Add import at the top:

```typescript
import { TtsQueue } from '../services/tts-queue'
```

**5b.** Add module-level queue after the `invokeTts` function:

```typescript
// Module-level queue — shared across all hook instances (one in App.tsx)
const ttsQueue = new TtsQueue(invokeTts)
```

**5c.** In the `onResponseReady` handler, replace the try/catch block (around lines 71-77):

```typescript
      try {
        ttsQueue.enqueue(announcement)
        if (lastParagraph) ttsQueue.enqueue(lastParagraph)
      } catch (err) {
        console.warn('[useAgentTts] TTS error:', err)
      }
```

**5d.** Update `readActiveAgent` to clear the queue (lines 85-87):

```typescript
  const readActiveAgent = useCallback(() => {
    ttsQueue.clear()
    cancelSpeech()
  }, [])
```

- [ ] **Step 6: Run all TTS tests and type-check**

Run: `npx vitest run src/renderer/src/hooks/useAgentTts.test.ts src/renderer/src/services/tts-queue.test.ts --reporter verbose && npx tsc --noEmit`
Expected: All pass, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/services/tts-queue.ts src/renderer/src/services/tts-queue.test.ts src/renderer/src/hooks/useAgentTts.ts
git commit -m "feat(tts): add speech queue to serialize TTS requests

Prevents agents from cutting each other off when multiple RESPONSE_READY
events fire simultaneously. Queue serializes speak calls. clear() stops
pending items. Cmd+Shift+S now also clears the queue."
```

---

### Task 6: Fix sound mapping — correct event for voice-off notification

When voice is off, `onNotificationSound` fires `agent_completed` (bridge-beep.wav) on every response. This is semantically wrong — the agent just responded, it didn't complete. Use the existing `agent_locked` event (alert-yellow.wav) which was defined but unreachable.

**Files:**
- Modify: `src/renderer/src/App.tsx:171`

**Interfaces:**
- Consumes: `playAgentSound`, `SOUND_MAP`
- Produces: `agent_locked` sound plays on mid-conversation response; `agent_completed` reserved for actual completion

- [ ] **Step 1: Change onNotificationSound to use `agent_locked`**

In `src/renderer/src/App.tsx`, line 171:

```typescript
  const { readActiveAgent, readFullResponse } = useAgentTts(agents, {
    onNotificationSound: () => playAgentSound('agent_locked', soundDeps.current)
  })
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "fix(tts): use agent_locked sound for mid-conversation response notification

When voice is off, plays alert-yellow.wav for 'agent has responded'
instead of bridge-beep.wav which is reserved for actual task completion.
The agent_locked sound entry was previously defined but unreachable."
```

---

### Task 7: Add approval TTS — "[agent name] is waiting for your approval"

When an agent enters `awaiting_approval`, emit a new IPC event and speak the approval announcement. This is immediate (no debounce) and independent from RESPONSE_READY.

**Files:**
- Modify: `src/shared/constants/ipc-channels.ts:212-213` (add APPROVAL_NEEDED event)
- Modify: `src/main/services/agent-manager.ts:324-331` (emit on awaiting_approval)
- Modify: `src/preload/index.ts:242-246` (add onApprovalNeeded bridge)
- Modify: `src/renderer/src/hooks/useAgentTts.ts` (listen for APPROVAL_NEEDED)
- Modify: `src/shared/types/ipc.types.ts` (add type)
- Test: `src/renderer/src/hooks/useAgentTts.test.ts`

**Interfaces:**
- Produces: `IPC_EVENTS.TTS.APPROVAL_NEEDED` event with `(agentId: string)` payload
- Consumed by: `useAgentTts` hook in renderer

- [ ] **Step 1: Write failing tests for approval TTS**

In `src/renderer/src/hooks/useAgentTts.test.ts`:

**1a.** Update `makeAgentHub` to support the new event. Replace the entire function:

```typescript
function makeAgentHub() {
  const responseListeners: ResponseReadyCb[] = []
  const approvalListeners: ((agentId: string) => void)[] = []
  const ttsSpeak = vi.fn().mockResolvedValue({})
  return {
    on: {
      agentStatusChange: vi.fn(() => vi.fn()),
    },
    tts: {
      speak: ttsSpeak,
      onResponseReady: vi.fn((cb: ResponseReadyCb) => {
        responseListeners.push(cb)
        return () => responseListeners.splice(responseListeners.indexOf(cb), 1)
      }),
      onApprovalNeeded: vi.fn((cb: (agentId: string) => void) => {
        approvalListeners.push(cb)
        return () => approvalListeners.splice(approvalListeners.indexOf(cb), 1)
      }),
    },
    _emit: {
      responseReady: (agentId: string, text: string) =>
        responseListeners.forEach((l) => l(agentId, text)),
      approvalNeeded: (agentId: string) =>
        approvalListeners.forEach((l) => l(agentId)),
    },
  }
}
```

**1b.** Add the approval tests:

```typescript
describe('useAgentTts — approval announcement', () => {
  it('speaks approval announcement when agent enters awaiting_approval (always_on)', async () => {
    const agent = makeAgent({ voiceMode: 'always_on', name: 'Sam' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.approvalNeeded('agent-1')
    })

    expect(hub.tts.speak).toHaveBeenCalledTimes(1)
    expect(hub.tts.speak.mock.calls[0][0].text).toBe("Sam is waiting for your approval.")
  })

  it('speaks approval announcement in speak_up mode', async () => {
    const agent = makeAgent({ voiceMode: 'speak_up', name: 'Sam' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.approvalNeeded('agent-1')
    })

    expect(hub.tts.speak).toHaveBeenCalledTimes(1)
    expect(hub.tts.speak.mock.calls[0][0].text).toBe("Sam is waiting for your approval.")
  })

  it('does NOT speak approval when voiceMode is off', async () => {
    const agent = makeAgent({ voiceMode: 'off' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.approvalNeeded('agent-1')
    })

    expect(hub.tts.speak).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/src/hooks/useAgentTts.test.ts --reporter verbose`
Expected: FAIL — `onApprovalNeeded` does not exist yet.

- [ ] **Step 3: Add APPROVAL_NEEDED IPC event constant**

In `src/shared/constants/ipc-channels.ts`, in the `IPC_EVENTS` object under `TTS:` (around line 212-213):

```typescript
  TTS: {
    RESPONSE_READY: 'on-tts:response-ready',
    APPROVAL_NEEDED: 'on-tts:approval-needed',
  },
```

- [ ] **Step 4: Emit APPROVAL_NEEDED from agent-manager**

In `src/main/services/agent-manager.ts`, inside the `if (newStatus === 'awaiting_approval')` block (around line 324-331), add after `applyStatusChange()`:

```typescript
        if (newStatus === 'awaiting_approval') {
          approvalEntryTimes.set(agentState.id, Date.now())
          const existing = approvalHoldTimers.get(agentState.id)
          if (existing) {
            clearTimeout(existing)
            approvalHoldTimers.delete(agentState.id)
          }
          applyStatusChange()
          // Emit TTS approval announcement (immediate — no debounce needed)
          emitToAllRenderers(IPC_EVENTS.TTS.APPROVAL_NEEDED, agentState.id)
```

- [ ] **Step 5: Add preload bridge**

In `src/preload/index.ts`, inside the `tts` object (after `onResponseReady`, around line 246):

```typescript
    onApprovalNeeded: (cb: (agentId: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, agentId: string): void => cb(agentId)
      ipcRenderer.on(IPC_EVENTS.TTS.APPROVAL_NEEDED, handler)
      return () => ipcRenderer.removeListener(IPC_EVENTS.TTS.APPROVAL_NEEDED, handler)
    },
```

- [ ] **Step 6: Add listener in useAgentTts**

In `src/renderer/src/hooks/useAgentTts.ts`, inside the `useEffect`, after the `unsubResponseReady` setup (around line 78):

```typescript
    const unsubApproval = window.agentHub.tts.onApprovalNeeded(async (agentId) => {
      const agent = agentsRef.current.get(agentId)
      if (!agent) return
      if (agent.voiceMode === 'off') return

      const announcement = `${agent.name} is waiting for your approval.`
      console.log('[TTS] onApprovalNeeded', { agentId, agentName: agent.name, voiceMode: agent.voiceMode })
      try {
        ttsQueue.enqueue(announcement)
      } catch (err) {
        console.warn('[useAgentTts] approval TTS error:', err)
      }
    })

    return () => {
      unsubResponseReady()
      unsubApproval()
    }
```

- [ ] **Step 7: Update IPC types**

In `src/shared/types/ipc.types.ts`, find the `tts` section in the `AgentHubApi` interface and add:

```typescript
    onApprovalNeeded: (cb: (agentId: string) => void) => () => void
```

- [ ] **Step 8: Run tests and type-check**

Run: `npx vitest run src/renderer/src/hooks/useAgentTts.test.ts --reporter verbose && npx tsc --noEmit`
Expected: All pass, no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/shared/constants/ipc-channels.ts src/main/services/agent-manager.ts src/preload/index.ts src/renderer/src/hooks/useAgentTts.ts src/renderer/src/hooks/useAgentTts.test.ts src/shared/types/ipc.types.ts
git commit -m "feat(tts): add approval TTS — speaks '[name] is waiting for your approval'

When an agent enters awaiting_approval, emits TTS.APPROVAL_NEEDED
immediately (no debounce). Renderer speaks the announcement in speak_up
and always_on modes. Off mode defers to the triage sound path."
```

---

### Task 8: Remove dead code — responseCollector

Clean up the abandoned responseCollector (dual-spawn approach), which adds confusion.

**Files:**
- Delete: `src/main/services/response-collector.ts`
- Delete: `src/main/services/response-collector.test.ts` (if exists)
- Modify: `src/main/services/agent-manager.ts` (remove responseCollector from ManagedAgent, agents.set, kill paths)

**Interfaces:**
- Consumes: nothing (dead code removal)
- Produces: cleaner codebase

- [ ] **Step 1: Remove `responseCollector` from ManagedAgent**

In `src/main/services/agent-manager.ts`, remove from the interface:

```typescript
  responseCollector: import('child_process').ChildProcess | null
```

- [ ] **Step 2: Remove from agents.set()**

Remove `responseCollector: null,` from the `agents.set()` call.

- [ ] **Step 3: Remove kill paths**

Search for `responseCollector` in agent-manager.ts and remove all blocks like:

```typescript
if (mgd.responseCollector && !mgd.responseCollector.killed) {
  mgd.responseCollector.kill()
}
```

These appear in the onExit handler and kill functions.

- [ ] **Step 4: Delete response-collector files**

```bash
rm -f src/main/services/response-collector.ts src/main/services/response-collector.test.ts
```

- [ ] **Step 5: Type-check and test**

Run: `npx tsc --noEmit && npx vitest run --reporter verbose`
Expected: No type errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(tts): remove dead responseCollector code

responseCollector (dual-spawn approach) was abandoned and replaced by
cleanTextBuffer + filterTtsResponse. The field was always null but kill
paths still checked it."
```

---

### Task 9: Verify sound-off path end-to-end

No code changes — verification task. Confirm all sound effects work when voice is off.

**Expected sound mapping after all fixes:**

| Event | Sound File | Trigger Path | When |
|---|---|---|---|
| Agent spawned | `state-change.mp3` | STATUS_CHANGE, first agentId appearance | On spawn |
| Agent responded | `alert-yellow.wav` | RESPONSE_READY → onNotificationSound | Mid-conversation (voice off) |
| Awaiting approval | `user-approval.mp3` | TRIAGED → statusToSoundEvent | Agent needs approval |
| Agent completed | `bridge-beep.wav` | TRIAGED → completed check | Task finished |
| All agents done | `mission-complete.wav` | STATUS_CHANGE → all completed | Multi-agent finish |
| Agent error | `code-blue.mp3` | TRIAGED → error check | On error |

- [ ] **Step 1: Verify soundEnabled defaults to true**

Read `src/renderer/src/stores/view-store.ts:16`: `stored === null ? true : stored === 'true'` — default is `true`.

- [ ] **Step 2: Trace each sound trigger path through the code**

Walk through each row in the table above and confirm the function calls exist. Special attention to:
- `getNotificationConfig()` in agent-manager.ts has `soundEnabled: true` (line 94)
- `statusToSoundEvent('awaiting_approval')` returns `'user_approval'` (sound-alert.ts:21)
- App.tsx spawn detection plays `agent_spawned` on first agent appearance (line 208-211)

- [ ] **Step 3: Document findings**

All paths should check out after Tasks 1-8. If any path is broken, create a follow-up task.

---

## Post-Implementation Verification Matrix

| Scenario | voiceMode=off | voiceMode=speak_up | voiceMode=always_on |
|---|---|---|---|
| Agent spawns | state-change.mp3 | state-change.mp3 | state-change.mp3 |
| Agent responds (mid-convo) | alert-yellow.wav | "[name] has responded." | "[name] has responded." + last paragraph |
| Agent awaiting approval | user-approval.mp3 | "[name] is waiting for your approval." | "[name] is waiting for your approval." |
| Agent completes task | bridge-beep.wav | bridge-beep.wav | bridge-beep.wav |
| All agents done | mission-complete.wav | mission-complete.wav | mission-complete.wav |
| Agent error | code-blue.mp3 | code-blue.mp3 | code-blue.mp3 |
| Cmd+Shift+I | speaks last response | speaks last response | speaks last response |
| Cmd+Shift+S | stops audio | stops speech | stops speech |
| 3+ agents respond | each gets its sound | queued, one at a time | queued, one at a time |
| Agent launch (before input) | nothing | nothing | nothing |

---

## Self-Review

**Spec coverage:**
- Startup TTS suppression → Task 1 (hasSentInput guard)
- Default voiceMode revert → Task 2
- Cmd+Shift+I fix → Task 3 (fallback + logging)
- BEL false positives → Task 4 (word count guard)
- Speech queue → Task 5 (TtsQueue)
- Sound mapping → Task 6 (agent_locked for responses)
- Approval TTS → Task 7 (APPROVAL_NEEDED IPC)
- Dead code → Task 8 (responseCollector)
- Sound verification → Task 9

**Placeholder scan:** No TBD/TODO found. All steps have complete code.

**Type consistency:** `TtsQueue` is created in Task 5 and consumed in Task 5 (useAgentTts wiring) and Task 7 (approval enqueue). `IPC_EVENTS.TTS.APPROVAL_NEEDED` is defined in Task 7 Step 3 and consumed in Steps 4-6. All signatures match.
