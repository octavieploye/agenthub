# TTS Pipeline Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three compounding TTS pipeline bugs that silence the "Agent X has responded" announcement for tool-only responses.

**Architecture:** The TTS pipeline is: PTY data → `cleanTextBuffer` (ANSI-stripped) → `filterTtsResponse()` (removes tool calls, spinners, banners) → `TtsTrigger` (2500ms debounce on final `busy→locked`) → IPC `TTS.RESPONSE_READY` → renderer `useAgentTts` → speaks announcement + optional last paragraph. All three fixes are in a single chain. The root bug is a guard in `TtsTrigger` that silences the IPC event when filtered text is empty — which is the normal case for tool-only responses.

**Tech Stack:** TypeScript, Electron IPC, Vitest (fake timers)

## Global Constraints

- Never modify `.gitignore`
- Run `npm run typecheck` after every code change — zero errors required before committing
- Never change test assertions to make tests pass; change the code to satisfy the assertions
- Exception for this plan: two tests in `tts-trigger.test.ts` are asserting WRONG behavior — they must be updated to assert the correct desired behavior FIRST, then the implementation is fixed to match

---

## Root Cause Analysis (read before touching code)

**What currently happens for a tool-only response** (agent reads files, runs code, no prose):

1. `cleanTextBuffer` accumulates: `"⏺ Reading foo.ts\n⎿ 42 lines\n✓ Done\n"`
2. `busy → locked` transition → `filterTtsResponse()` returns `""` (all lines are tool chrome)
3. `TtsTrigger.onStatusChange('busy', 'locked', '')` is called
4. Timer set for 2500ms
5. Timer fires → **`if (text.trim()) this.onEmit(text)`** → `''.trim()` is falsy → **`onEmit` never called**
6. No IPC event → renderer never receives anything → **announcement never fires**

**What should happen:**

5. Timer fires → `this.onEmit('')` — always called
6. IPC event fires with `(agentId, '')`
7. Renderer speaks `"${agent.name} has responded."` (independent of `cleanText` content — already wired correctly in `useAgentTts.ts`)
8. No prose read (because `cleanText` is empty → `isReadableParagraph` returns false)

**Why removing the guard is safe (premature fire prevention is NOT the guard's job):**

The guard was added to prevent false announcements when Claude briefly flashes the `❯` prompt during startup. But this is already handled by the `locked → busy` cancellation in `TtsTrigger`. When Claude flashes `❯` prematurely:
- `busy → locked` (empty text) → timer set
- `locked → busy` (Claude starts working) → **timer cancelled** ← this is the real protection
- Real `busy → locked` → new timer set → fires correctly

The `if (text.trim())` guard prevents legitimate tool-only announcements without adding any safety for premature fires. It is the bug.

**Existing code that is already correct (do NOT touch):**

- `piper-service.ts:64` — already has `if (!text.trim()) return Promise.resolve(Buffer.alloc(0))` ✓
- `useAgentTts.ts:46-62` — announcement fires independently of `cleanText`; prose gated on `isReadableParagraph` ✓
- `voice-speaker.ts:48-49` — `if (!text.trim()) return` guards direct `speak()` calls ✓
- `TtsTrigger` debounce logic — already fires on `locked OR completed`, already cancels on `locked → busy` ✓

---

## File Map

| File | Change |
|---|---|
| `src/main/utils/tts-trigger.test.ts` | Update 2 tests: change assertions from "not called" to "called with empty string" |
| `src/main/utils/tts-trigger.ts` | Remove `if (text.trim())` guard on line 66 — always call `this.onEmit(text)` |

No other files are modified.

---

## Task 1: Update failing tests to assert correct behavior

**Context:** Lines 135–155 in `tts-trigger.test.ts` contain two tests that assert `onEmit` is NOT called when text is empty. These tests encode the current bug as expected behavior. Update them to assert the correct behavior: `onEmit` IS called, with `''` or `'   \n  '` respectively.

**Files:**
- Modify: `src/main/utils/tts-trigger.test.ts` — update 2 assertions in describe block `'TtsTrigger — empty text guard (premature fire prevention)'`

- [ ] **Step 1.1: Run the current test suite to confirm baseline (all tests pass with current code)**

```bash
cd /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub && npx vitest run src/main/utils/tts-trigger.test.ts 2>&1
```

Expected: all tests pass (current code satisfies current assertions).

- [ ] **Step 1.2: Update test "does NOT call onEmit when text is empty string" to assert it IS called**

In `src/main/utils/tts-trigger.test.ts`, find the test at approximately line 136 (inside `describe('TtsTrigger — empty text guard (premature fire prevention)')`) and replace it:

```typescript
it('calls onEmit with empty string when text is empty (tool-only response)', () => {
  const emit = vi.fn()
  const trigger = new TtsTrigger({ debounceMs: 300, onEmit: emit })

  trigger.onStatusChange('busy', 'locked', '')

  vi.advanceTimersByTime(300)

  expect(emit).toHaveBeenCalledTimes(1)
  expect(emit).toHaveBeenCalledWith('')
})
```

- [ ] **Step 1.3: Update test "does NOT call onEmit when text is whitespace only" to assert it IS called**

In the same describe block, find the test at approximately line 147 and replace it:

```typescript
it('calls onEmit with whitespace-only string (renderer will filter it)', () => {
  const emit = vi.fn()
  const trigger = new TtsTrigger({ debounceMs: 300, onEmit: emit })

  trigger.onStatusChange('busy', 'locked', '   \n  ')

  vi.advanceTimersByTime(300)

  expect(emit).toHaveBeenCalledTimes(1)
  expect(emit).toHaveBeenCalledWith('   \n  ')
})
```

- [ ] **Step 1.4: Run tests to confirm the two updated tests now FAIL (and no others)**

```bash
cd /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub && npx vitest run src/main/utils/tts-trigger.test.ts 2>&1
```

Expected output: exactly 2 tests FAIL with "expected to have been called" or similar. All other tests still pass.
If more than 2 tests fail, stop and report — do not proceed.

---

## Task 2: Fix TtsTrigger — always call onEmit

**Files:**
- Modify: `src/main/utils/tts-trigger.ts` — 1 line change at line 66

- [ ] **Step 2.1: Apply the fix**

In `src/main/utils/tts-trigger.ts`, find this block (around line 63–67):

```typescript
      this.timer = setTimeout(() => {
        this.timer = null
        if (text.trim()) this.onEmit(text)
      }, this.debounceMs)
```

Replace with:

```typescript
      this.timer = setTimeout(() => {
        this.timer = null
        this.onEmit(text)
      }, this.debounceMs)
```

That is the entire change: remove the `if (text.trim())` wrapper.

- [ ] **Step 2.2: Run the tests to verify all tests pass**

```bash
cd /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub && npx vitest run src/main/utils/tts-trigger.test.ts 2>&1
```

Expected: all tests pass. Zero failures.
If any test fails (other than the two we updated), do NOT proceed — report what failed.

- [ ] **Step 2.3: Run the full test suite to confirm no regressions**

```bash
cd /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub && npx vitest run 2>&1 | tail -30
```

Expected: all previously-passing tests still pass. The two updated tests now pass. No new failures.

- [ ] **Step 2.4: Typecheck**

```bash
cd /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub && npm run typecheck 2>&1
```

Expected: zero errors.

- [ ] **Step 2.5: Commit**

```bash
cd /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub && git add src/main/utils/tts-trigger.ts src/main/utils/tts-trigger.test.ts && git commit -m "fix(tts): always emit RESPONSE_READY so announcement fires on tool-only responses

TtsTrigger previously guarded onEmit behind if (text.trim()), silencing the
completion announcement when an agent's entire response consisted of tool calls
(no prose). The guard was intended to prevent premature fires but that is already
handled by the locked→busy timer cancellation. Removing the guard allows the
renderer to speak the announcement independently of whether cleanText is empty."
```

---

## Self-Review

**Spec coverage:**
- Fix 1 (locked OR completed debounce): TtsTrigger already fires on `locked OR completed` with 2500ms debounce — confirmed correct, no code change needed ✓
- Fix 2 (announcement separated from prose): renderer `useAgentTts.ts` already speaks announcement independently of `cleanText` — confirmed correct, no code change needed ✓
- Fix 3 (filteredText guard): `if (text.trim())` guard removed from `tts-trigger.ts` line 66 — implemented in Task 2 ✓

**Placeholder scan:** None found.

**Type consistency:** Single-line change, no new types or signatures introduced. No cross-file type dependencies modified.
