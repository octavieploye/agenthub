# Learning: The TTS Debugging Saga — 11 Days, 15+ Commits, Same Bug

## Context

**Feature:** Per-agent text-to-speech in AgentHub (Electron app managing AI coding agents).
**Timeline:** June 6–16, 2026 (11 days across 6+ agent sessions).
**Files involved:** `useAgentTts.ts` (renderer hook), `agent-manager.ts` (main process), `response-collector.ts` (removed), `tts-response-filter.ts` (created), `piper-service.ts`, `strip-ansi.ts`.

**Goal:** When an agent finishes responding, announce it via TTS and optionally read the response aloud.

**Expected result:** TTS fires exactly once per agent response, speaks clean prose (no CLI chrome), works reliably across sessions.

**Actual result:** TTS broke repeatedly across 15+ commits. Each fix addressed a symptom but introduced a new regression, or silently changed a working condition. The bug persisted for 11 days.

---

## Full Commit Timeline with LLM Behavior Analysis

### Phase 1 — Initial Implementation (June 6, commit `a6b88f6`)

**What the LLM did:** Built the full TTS feature in one large commit (22 files). Used a renderer-side PTY accumulator to capture output, fired TTS on `busy -> idle/locked` status transitions.

**What went wrong:** The approach was architecturally sound but had two bugs:
- Status flickers during tool-call cycles caused multiple `busy -> idle` transitions per response = multiple TTS fires.
- PTY output chunks arrive 100-400ms after status flips to `idle`, so late chunks (containing the actual response) were dropped by the `if (agent.status !== 'busy') return` guard.

**LLM behavior pattern:** *Shipped a large feature without testing the real-world interaction pattern.* The agent didn't simulate what actually happens when Claude runs tool calls (rapid status cycling). It tested the happy path only.

---

### Phase 2 — Symptom Chasing (June 6, commits `3612826` + `a946a89`)

**What the LLM did:**
- `3612826`: Added `hasFiredTts` guard, `isAccumulating` flag, `stripTrailingNoise` — 3 mechanisms to patch the two bugs.
- `a946a89`: Removed a `confirmed` confidence gate that was blocking ALL triggers (parser only emits `inferred`, never `confirmed`).

**What went wrong:** Each fix addressed one symptom without understanding the root cause. The `hasFiredTts` guard was declared but *never wired up* in the first commit. The confidence gate fix was valid but masked the deeper architectural issue (renderer shouldn't be accumulating PTY output at all).

**LLM behavior pattern:** *Layering guards and flags without stepping back to question the architecture.* Instead of asking "should the renderer be doing this at all?", the LLM kept patching the renderer approach. Each patch added complexity that made the next bug harder to find.

---

### Phase 3 — Scorched Earth Reset (June 6, commit `ff6e69d`)

**What the LLM did:** Stripped TTS down to announcement-only. Removed ALL accumulation, reading, cleaning logic. Created a plan document for a better approach using Piper TTS sidecar.

**What went right:** This was the correct decision. The LLM recognized the approach was fundamentally broken and reset.

**What went wrong:** The plan document proposed extracting text from xterm's terminal buffer — still a renderer-side approach, still fighting the same problem from a different angle.

**LLM behavior pattern:** *Correct instinct (reset), wrong next step (same architecture with different tooling).* The reset was good but the replacement plan didn't address the root cause: *text cleaning should happen where the text originates (main process), not where it's displayed (renderer).*

---

### Phase 4 — ResponseCollector Approach (June 11, commit `2620bfb`)

**What the LLM did:** Spawned a second `claude --print --output-format stream-json` process alongside the PTY. This process received clean, structured JSON output. On `message_stop`, it emitted `TTS.RESPONSE_READY` with clean text.

**What went right:** TTS worked. The text was pre-cleaned at source. No ANSI, no tool chrome, no filtering needed.

**What went wrong:** Spawning two Claude processes per agent was unstable and expensive. It crashed.

**LLM behavior pattern:** *Over-engineering a clean solution without considering operational cost.* The LLM found the cleanest possible text source but ignored the constraint that spawning a second LLM process per agent is impractical.

---

### Phase 5 — ResponseCollector Removed, Revert to Baseline (June 15, commit `60a16d4`)

**What the LLM did:** Removed ResponseCollector. Reverted `useAgentTts` to a PTY accumulator baseline that fires on `busy -> idle/locked`.

**What went wrong:** The hook listened for `TTS.RESPONSE_READY` from main process, but nothing in main process emitted that event anymore. TTS was completely dead. The revert was incomplete — it removed the emitter but kept the listener.

**LLM behavior pattern:** *Partial revert that creates a dead signal path.* The LLM removed one end of the IPC channel without updating the other end. This is a recurring pattern: changes are made to one file without tracing all callers/listeners.

---

### Phase 6 — Main Process Buffer (June 15-16, commits `f693335` + `295dd28` + `f4eddf8`)

**What the LLM did:**
- Created `strip-ansi.ts` utility for main process.
- Added `cleanTextBuffer` to `agent-manager.ts`, accumulated ANSI-stripped PTY text.
- Emitted `TTS.RESPONSE_READY` on `busy -> locked OR completed`.
- Rewrote `useAgentTts.ts` to listen only to `onResponseReady`.

**What went right:** This was the correct architecture. Text cleaning at source (main process), single emission point, renderer just listens and speaks. TTS worked.

**LLM behavior pattern:** *Finally solved the right problem.* After 4 failed approaches, the LLM built the solution that the Phase 3 plan should have proposed: accumulate clean text in the main process where the PTY stream lives.

---

### Phase 7 — The Fatal "Improvement" (June 16, commit `7bea3ee`)

**What the LLM did:** Added `tts-response-filter.ts` to strip tool calls, spinners, and banners from the text buffer. Good idea. But also:
1. **Changed trigger from `locked OR completed` to `completed` only** — buried in the commit as "Also fixes TTS firing on `locked` status."
2. **Added `if (filteredText)` guard** — suppressed emission when filter returned empty string.

**What went wrong:** Both changes broke TTS:
- Agents almost never reach `completed` during normal use (they reach `locked` — waiting for next input). So TTS never fires.
- Tool-only responses filter to empty string, suppressing even the completion announcement.
- The commit message described the trigger change as a "fix" when it was actually the primary regression.

**LLM behavior pattern:** *Bundling a regression into an improvement commit and describing it as a fix.* This is the most dangerous pattern. The LLM:
1. Made an unrelated change to a working condition (`locked OR completed` -> `completed` only).
2. Described that change positively in the commit message ("Also fixes...").
3. Did not test the change against real agent behavior (agents reach `locked`, not `completed`).
4. The actual filter feature was correct and well-tested — the regression was in the 4 lines of wiring, not the 60 lines of filter logic.

---

### Phase 8 — Debug Session That Crashed (June 16, current session)

**What the LLM did:** Wrote an excellent debug plan (`2026-06-16-tts-debug-plan.md`) that correctly identified both root causes, 4 over-filtering issues, and the compounding triple-guard problem. Partially applied a fix (removed `if (filteredText)` guard) but left the trigger condition unfixed. Then the app crashed.

**What went right:** The diagnostic was perfect — best analysis in the entire saga.

**What went wrong:** The fix was incomplete. The most critical issue (trigger condition) was identified as Root Cause #1 but not changed in the code.

**LLM behavior pattern:** *Excellent diagnosis, incomplete execution.* The LLM spent effort writing a thorough analysis but didn't finish applying its own recommendations before the session ended.

---

## Recurring LLM Anti-Patterns (Observed Across All Sessions)

### 1. Symptom Stacking Instead of Root Cause Analysis

**Pattern:** Add a guard/flag/debounce to suppress a symptom. When the next symptom appears, add another layer. Never question whether the underlying architecture is wrong.

**Observed:** Phase 2 added `hasFiredTts`, `isAccumulating`, `stripTrailingNoise` — three mechanisms that addressed symptoms of one root cause (renderer shouldn't accumulate PTY output).

**Counter-rule:** Before adding any guard/flag/debounce, write one sentence describing WHY the unwanted behavior occurs. If you can't, you don't understand the root cause. If the answer involves timing or race conditions, the data flow architecture is wrong — patching timing issues with debounces creates fragile code.

### 2. Fixing One File Without Tracing Signal Flow

**Pattern:** Edit the emitter without updating the listener. Edit the listener without checking the emitter. Remove one end of an IPC channel.

**Observed:** Phase 5 removed ResponseCollector (emitter) but kept `onResponseReady` listener. Phase 7 changed trigger condition without checking what statuses agents actually reach.

**Counter-rule:** For any IPC/event change, trace the full path: emitter -> channel -> listener -> consumer. List all files in that path. Verify each one is consistent after the change. If you change when an event fires, check what the listener expects.

### 3. Bundling Regressions Into Feature Commits

**Pattern:** While implementing Feature X, also "fix" or "clean up" an adjacent behavior Y. The commit message emphasizes X. The regression is in Y.

**Observed:** Phase 7 committed a well-tested filter feature alongside an untested trigger condition change. The filter had 22 passing tests. The trigger change had zero tests.

**Counter-rule:** One concern per commit. If you're adding a feature AND changing a trigger condition, those are two commits. The trigger change gets its own test proving the new behavior is correct. If you can't write that test, you don't understand what you changed.

### 4. Describing Regressions as Improvements

**Pattern:** Commit message says "fixes X" or "also improves Y" when the change actually breaks the working behavior.

**Observed:** `7bea3ee` says "Also fixes TTS firing on `locked` status" — but firing on `locked` was the CORRECT behavior that made TTS work. The LLM described removing a working trigger as fixing it.

**Counter-rule:** Before writing "fix" in a commit message, answer: "What was broken before? What test failed? What user-visible bug existed?" If you can't name the bug, it's not a fix — it's a change. Call it what it is.

### 5. Over-Engineering Then Reverting, Repeatedly

**Pattern:** Build a complex solution -> discover it's unstable -> revert to baseline -> build another complex solution -> repeat.

**Observed:** ResponseCollector (dual process spawn) -> revert -> PTY accumulator in renderer -> revert -> main process buffer -> filter layer. Each approach was fully built before being tested against real conditions.

**Counter-rule:** Before building any solution, test the minimal version first. For TTS: can you emit a hardcoded string on status change and hear it? Yes? Now add the real text. Works? Now add filtering. Each layer is validated before the next begins.

### 6. Perfect Diagnosis, Incomplete Execution

**Pattern:** Write a thorough analysis identifying all root causes with file/line references, then fix 1 of 3 issues and call it done (or crash before finishing).

**Observed:** Phase 8 debug plan identified 3 compounding root causes but the fix only addressed 1 of 3.

**Counter-rule:** After diagnosis, create a checklist of every change needed. Check each off only after the code is modified AND verified. Don't move to the next task until all items are checked. If you identified 3 root causes, you need 3 code changes.

---

## The Compounding Problem

The most insidious pattern in this saga was how bugs compounded silently:

```
Layer 1: Trigger fires on `completed` only (rarely reached)
   -> TTS almost never fires
Layer 2: Filter returns empty for tool-only responses
   -> Even when trigger fires, emission may be suppressed
Layer 3: Renderer returns early on empty text
   -> Even if emission reaches renderer, announcement is blocked
```

Each layer independently could silence TTS. Together, they made the bug appear total and mysterious. Each fix attempt addressed one layer, verified it "should work now," but the other two layers kept TTS silent. This led to the perception that the bug was deep and complex, when in reality it was three simple one-line issues stacked.

**Counter-rule for compounding:** When a feature is "completely broken" (no output at all), trace the signal path end-to-end in one pass. Add a temporary log at every gate/guard/conditional between the trigger and the output. Run once. The logs tell you exactly which gate is blocking. Fix ALL blocking gates before removing the logs.

---

## What Finally Worked (The Correct Architecture)

```
PTY onData (main process)
  -> stripAnsi(chunk) -> append to cleanTextBuffer

Status change: busy -> locked OR completed (main process)
  -> filterTtsResponse(cleanTextBuffer) -> strip tool calls, spinners, banners
  -> emitToAllRenderers(TTS.RESPONSE_READY, agentId, filteredText)
  -> clear cleanTextBuffer

Renderer (useAgentTts hook)
  -> onResponseReady(agentId, cleanText)
  -> ALWAYS speak announcement (even if cleanText is empty)
  -> IF always_on AND cleanText non-empty: speak last paragraph

Piper safety net
  -> if (!text.trim()) return empty buffer (don't spawn process)
```

**Why this works:**
1. Text cleaning happens at the source (main process owns the PTY).
2. Emission happens exactly once per response (buffer cleared after emit).
3. Announcement and prose reading are independent (announcement always fires).
4. Each layer has exactly one responsibility.

---

## Actionable Rules for Future Persistent Bugs

1. **3-strike rule for symptom fixes:** If you've made 3 commits that add guards/flags/debounces to the same feature and it still doesn't work, STOP. The architecture is wrong. Write a one-page analysis of the data flow before touching code again.

2. **Signal tracing before code changes:** For any event-driven bug, draw the signal path (emitter -> channel -> listener -> consumer) on paper. Verify each node. Change all broken nodes in one commit.

3. **One concern per commit, tested:** Never bundle unrelated behavior changes into a feature commit. Each behavioral change gets its own test.

4. **"Fix" requires a bug:** Never use "fix" in a commit message unless you can name the specific user-visible bug that existed before the commit.

5. **Validate incrementally:** Build the minimal working version first. Add complexity one layer at a time, validating at each step. Don't build a 60-line filter before confirming the trigger condition works.

6. **Complete your own checklist:** If your diagnosis identifies N root causes, your fix must contain N code changes. Track with checkboxes. Don't submit until all are checked.

7. **Test against real behavior, not ideal behavior:** Agents reach `locked`, not `completed`. Status flickers during tool calls. PTY chunks arrive late. Test against these real patterns, not the happy path.

---

## Cost of This Bug

- 11 calendar days
- 6+ agent sessions
- 15+ commits (many reverted or superseded)
- 2 plan documents
- 1 debug document
- 1 removed feature (ResponseCollector)
- 3 architectural rewrites
- Net useful code: ~80 lines across 3 files

The fix that finally worked could have been written in the first session if the LLM had traced the signal path end-to-end and tested against real agent behavior instead of the happy path.
