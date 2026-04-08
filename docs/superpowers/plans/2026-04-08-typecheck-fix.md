# TypeScript Error Fix Sprint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all ~41 TypeScript errors across node and web tsconfigs so `npm run typecheck` passes clean.

**Architecture:** Three parallel workstreams — (1) unused imports/variables cleanup, (2) type-safety fixes in production code, (3) test mock fixes. Each is independent and can run in a separate worktree.

**Tech Stack:** TypeScript 5.9.3, Vitest, React 19, Zustand 5, Electron 39

**Note:** better-sqlite3 native module issue is already resolved — `pretest` script handles rebuild automatically.

---

## Workstream A: Unused Imports & Variables (parallelizable — worktree)

### Task A1: Clean unused imports in main process

**Files:**
- Modify: `src/main/ipc/git.ipc.ts:18` — remove `filesSchema`
- Modify: `src/main/ipc/history.ipc.ts:14` — remove `searchSchema`
- Modify: `src/main/services/container-manager.ts:5` — remove `log`
- Modify: `src/main/services/docker-service.ts:3` — remove `log`
- Modify: `src/main/services/git-service.ts:239` — remove `verb`
- Modify: `src/main/services/voice-service.ts:1` — remove `join`

- [ ] **Step 1: Fix each unused import**

In `src/main/ipc/git.ipc.ts:18` — remove `filesSchema` from the import/declaration.
In `src/main/ipc/history.ipc.ts:14` — remove `searchSchema` from the import/declaration.
In `src/main/services/container-manager.ts:5` — remove `log` import.
In `src/main/services/docker-service.ts:3` — remove `log` import.
In `src/main/services/git-service.ts:239` — remove unused `verb` from destructuring.
In `src/main/services/voice-service.ts:1` — remove `join` from the import.

- [ ] **Step 2: Run node typecheck to verify**

```bash
npm run typecheck:node 2>&1 | grep -c "TS6133\|TS6196"
# Should show fewer errors than before (these 6 should be gone)
```

- [ ] **Step 3: Run tests to verify no breakage**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

---

### Task A2: Clean unused imports in renderer

**Files:**
- Modify: `src/renderer/src/App.tsx:10` — remove `UnifiedView` import
- Modify: `src/renderer/src/App.tsx:77` — remove `updateColor` from destructuring
- Modify: `src/renderer/src/helpers/monaco-theme.ts:18` — remove `base100`
- Modify: `src/renderer/src/services/speech-recognition.ts:1` — remove `AgentState` import
- Modify: `src/renderer/src/widgets/agent-detail/AgentDetailPanel.tsx:1` — remove `useMemo` from import
- Modify: `src/renderer/src/widgets/full-terminal/FullTerminal.tsx:10` — remove `updateTheme` from destructuring
- Modify: `src/renderer/src/widgets/full-terminal/FullTerminal.tsx:28` — remove unused `theme`
- Modify: `src/renderer/src/widgets/repo-file-tree/FileActionPopover.tsx:56` — remove `truncated`
- Modify: `src/renderer/src/widgets/spawn-dialog/SpawnDialog.tsx:67` — remove `dockerStatus` destructuring
- Modify: `src/renderer/src/widgets/unified-view/UnifiedView.tsx:23` — remove `onSoloAgent`, `onMuteAgent`, `onKillAgent`, `soloedAgentId` from props destructuring

- [ ] **Step 1: Fix each unused import/variable**

Remove each unused identifier listed above. For destructured variables, remove them from the destructuring pattern. For imports, remove from the import statement (or the entire import if nothing else is used).

- [ ] **Step 2: Run web typecheck**

```bash
npm run typecheck:web 2>&1 | grep -c "TS6133\|TS6196"
# Should show 0 remaining unused-import errors
```

---

### Task A3: Clean unused imports in test files

**Files:**
- Modify: `src/main/parsers/jsonl-parser.test.ts:39` — remove `ASSISTANT_NO_USAGE_LINE`
- Modify: `src/main/services/auto-pause.test.ts:3` — remove `PausedAgentInfo` from import
- Modify: `src/main/services/claude-monitor.test.ts:2` — remove `UsageSnapshot` from import
- Modify: `src/main/services/notification-router.test.ts:4` — remove `TriageLevel` from import
- Modify: `src/main/services/recovery-manager.test.ts:1` — remove `vi` from import
- Modify: `src/main/services/skills-service.test.ts:428,453,478` — remove unused `cmd` variables (3 occurrences)
- Modify: `src/main/services/__integration__/docker-service.integration.test.ts:12` — remove `deps`

- [ ] **Step 1: Fix each unused import/variable in test files**

Remove each unused identifier. For the `cmd` variables in skills-service.test.ts, if they're destructured from a return value, either use `_cmd` prefix or remove the destructuring.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck:node 2>&1 | grep "TS6133\|TS6196"
# Should show 0 remaining
```

- [ ] **Step 3: Run tests to confirm nothing breaks**

```bash
npm test 2>&1 | tail -5
```

- [ ] **Step 4: Commit workstream A**

```bash
git add -A
git commit -m "fix(types): remove all unused imports and variables across codebase

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Workstream B: Production Code Type Fixes (parallelizable — worktree)

### Task B1: Fix DesktopNotificationPayload — add `awaiting_approval` status

The `DesktopNotificationPayload.status` is `'locked' | 'completed'` but the code and tests use `'awaiting_approval'`.

**Files:**
- Modify: `src/shared/types/notification.types.ts:34`

- [ ] **Step 1: Add `awaiting_approval` to the status union**

In `src/shared/types/notification.types.ts`, change line 34:

```typescript
// Before:
  status: 'locked' | 'completed'
// After:
  status: 'locked' | 'completed' | 'awaiting_approval'
```

- [ ] **Step 2: Verify desktop-notification.ts and test no longer error**

```bash
npm run typecheck:node 2>&1 | grep "desktop-notification"
# Should show 0 errors
```

---

### Task B2: Fix QualityPipeline — add `resolved` to PipelineStatus comparisons

The `quality-pipeline.ts` compares `run.status` against `'resolved'` but the type already includes `'resolved'`. The issue is that TS narrows the type after assignment and the comparison becomes unreachable. The actual fix: the `status` field is set to `'running'` or `'failed'` at creation and only changed by `this.resolve()`. TS sees the comparison as unreachable.

**Files:**
- Modify: `src/main/services/quality-pipeline.ts:5` — remove unused `EscalationLevel` import
- Modify: `src/main/services/quality-pipeline.ts:57,60,63` — status comparisons

- [ ] **Step 1: Remove unused `EscalationLevel` import**

```typescript
// Before:
import type {
  QualityPipelineDeps,
  PipelineRun,
  PipelineAttempt,
  EscalationLevel
} from '@shared/types/quality-pipeline.types'
// After:
import type {
  QualityPipelineDeps,
  PipelineRun,
  PipelineAttempt
} from '@shared/types/quality-pipeline.types'
```

- [ ] **Step 2: Fix status comparison narrowing**

The `run.status` is mutated by `this.resolve()` inside `executeL1/L2/L3`, but TypeScript's control flow analysis doesn't track mutations through method calls. Cast to the full type:

```typescript
// In startPipeline(), replace each:
if (run.status === 'resolved') return run
// With:
if ((run.status as PipelineStatus) === 'resolved') return run
```

Apply at lines 57, 60, 63 (three occurrences in `startPipeline`).

- [ ] **Step 3: Verify**

```bash
npm run typecheck:node 2>&1 | grep "quality-pipeline"
# Should show 0 errors
```

---

### Task B3: Fix SpawnDialog color type — widen useState generic

The `selectedColor` state is initialized with `AGENT_COLOR_PALETTE[0]` which TS narrows to the literal `'#89b4fa'`. But `setSelectedColor` receives other palette values.

**Files:**
- Modify: `src/renderer/src/widgets/spawn-dialog/SpawnDialog.tsx:64`

- [ ] **Step 1: Widen the useState type**

```typescript
// Before:
const [selectedColor, setSelectedColor] = useState(AGENT_COLOR_PALETTE[0])
// After:
const [selectedColor, setSelectedColor] = useState<string>(AGENT_COLOR_PALETTE[0])
```

- [ ] **Step 2: Verify**

```bash
npm run typecheck:web 2>&1 | grep "SpawnDialog"
# Should show 0 errors (the dockerStatus unused import is handled in Workstream A)
```

---

### Task B4: Fix AgentSidebar — missing return values

Two sort comparator functions don't return values on all code paths.

**Files:**
- Modify: `src/renderer/src/widgets/agent-sidebar/AgentSidebar.tsx:135,161`

- [ ] **Step 1: Read the file to see the exact sort functions**

```bash
# Read around lines 130-170
```

- [ ] **Step 2: Add explicit return 0 at end of each comparator**

Each sort comparator must return a number on all paths. Add `return 0` as the final statement in each function body at lines ~135 and ~161.

- [ ] **Step 3: Verify**

```bash
npm run typecheck:web 2>&1 | grep "AgentSidebar"
# Should show 0 errors
```

---

### Task B5: Fix UnifiedView — missing return value

**Files:**
- Modify: `src/renderer/src/widgets/unified-view/UnifiedView.tsx:31`

- [ ] **Step 1: Read the function and add missing return**

Read around line 31 to find the function that doesn't return on all paths. Add the missing `return null` or appropriate fallback.

- [ ] **Step 2: Verify**

```bash
npm run typecheck:web 2>&1 | grep "UnifiedView"
# Should show 0 errors (unused props handled in Workstream A)
```

---

### Task B6: Fix HelpPopover — IpcError vs string type mismatch

**Files:**
- Modify: `src/renderer/src/widgets/help-popover/HelpPopover.tsx:73`

- [ ] **Step 1: Read the file around line 73**

The error is that an `IpcError` is being passed where `string` is expected (likely in a `setError(err)` call). Fix by converting to string:

```typescript
// If the pattern is:
.catch((err) => setError(err))
// Change to:
.catch((err) => setError(err instanceof Error ? err.message : String(err)))
```

- [ ] **Step 2: Verify**

```bash
npm run typecheck:web 2>&1 | grep "HelpPopover"
```

---

### Task B7: Fix TodoTab — focusBorderColor property

**Files:**
- Modify: `src/renderer/src/widgets/agent-detail/TodoTab.tsx:195`

- [ ] **Step 1: Read the file around line 195 and replace `focusBorderColor` with `borderColor`**

The property `focusBorderColor` doesn't exist. If it's an inline style, use the correct CSS property name.

- [ ] **Step 2: Verify**

```bash
npm run typecheck:web 2>&1 | grep "TodoTab"
```

---

### Task B8: Fix SpeechRecognition global type

**Files:**
- Modify: `src/renderer/src/services/speech-recognition.ts:9,21`

- [ ] **Step 1: Add a type declaration for the Web Speech API**

At the top of `speech-recognition.ts`, add:

```typescript
// Web Speech API types (not in standard lib for Electron)
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}
```

Or alternatively, use a type assertion on the window object:

```typescript
const SpeechRecognitionCtor = (window as Record<string, unknown>).SpeechRecognition as
  | (new () => SpeechRecognition)
  | undefined ??
  (window as Record<string, unknown>).webkitSpeechRecognition as
  | (new () => SpeechRecognition)
  | undefined
```

Read the file first to determine the best approach that matches existing code style.

- [ ] **Step 2: Verify**

```bash
npm run typecheck:web 2>&1 | grep "speech-recognition"
```

---

### Task B9: Fix GitTab — unknown type on sub-component props

The error says properties don't exist on type `unknown` at lines 260, 261, 369, 422. These are parameter type annotations using `ReturnType<typeof useGitStore>['status']`. If TS can't resolve the store type, these become `unknown`.

**Files:**
- Modify: `src/renderer/src/widgets/agent-detail/GitTab.tsx:260,261,369,422`

- [ ] **Step 1: Replace ReturnType annotations with explicit types**

```typescript
// Before (StatusSection params):
  status: ReturnType<typeof useGitStore>['status']
  branches: ReturnType<typeof useGitStore>['branches']
// After:
  status: GitRepoStatus | null
  branches: GitBranchInfo | null

// Before (CommitSection params):
  status: ReturnType<typeof useGitStore>['status']
// After:
  status: GitRepoStatus | null

// Before (LogSection params):
  log: ReturnType<typeof useGitStore>['log']
// After:
  log: GitCommitEntry[]
```

The imports `GitRepoStatus`, `GitCommitEntry`, `GitBranchInfo` are already imported at the top of the file (line 4 imports from `@shared/types/git.types`). Add `GitRepoStatus` to that import if missing.

- [ ] **Step 2: Verify**

```bash
npm run typecheck:web 2>&1 | grep "GitTab"
# Should show 0 errors
```

---

### Task B10: Fix App.tsx RefObject nullability

**Files:**
- Modify: `src/renderer/src/App.tsx:871`

- [ ] **Step 1: Read around line 871 to see the ref usage**

The error is `RefObject<RepoSwitcherHandle | null>` vs `RefObject<RepoSwitcherHandle>`. Fix by aligning the ref creation with the component's expected type — likely change `useRef<RepoSwitcherHandle | null>(null)` to `useRef<RepoSwitcherHandle>(null!)` or adjust the component prop to accept `| null`.

Read the file first to determine the correct approach.

- [ ] **Step 2: Verify**

```bash
npm run typecheck:web 2>&1 | grep "App.tsx"
# Should show 0 errors (unused imports handled in Workstream A)
```

- [ ] **Step 3: Commit workstream B**

```bash
git add -A
git commit -m "fix(types): resolve all type-safety errors in production code

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Workstream C: Test File Type Fixes (parallelizable — worktree)

### Task C1: Fix AgentState mock helpers — add missing required fields

Multiple test files create mock `AgentState` objects missing `effortLevel`, `color`, `executionMode`.

**Files:**
- Modify: `src/main/db/queries/snapshots.queries.test.ts:74`
- Modify: `src/main/services/sbar-generator.test.ts:21`
- Modify: `src/main/services/snapshot-engine.test.ts:42`

- [ ] **Step 1: Find the `createMockAgent` helper or inline mock objects**

Check if there's a shared `createMockAgent` helper. If so, add the missing fields there. If mocks are inline, add to each:

```typescript
effortLevel: 'medium' as const,
color: '#3B82F6',
executionMode: 'native' as const,
```

- [ ] **Step 2: Fix snapshots.queries.test.ts:74**

Add the three missing fields to the mock AgentState at line 74.

- [ ] **Step 3: Fix sbar-generator.test.ts:21**

Add the three missing fields. Note: the error says `effortLevel` is `undefined` — ensure it's a valid `EffortLevel` value, not `undefined`.

- [ ] **Step 4: Fix snapshot-engine.test.ts:42**

Add the three missing fields.

- [ ] **Step 5: Verify**

```bash
npm run typecheck:node 2>&1 | grep "effortLevel\|Missing properties"
# Should show 0 errors
```

---

### Task C2: Fix claude-monitor.test.ts — readdir reference

The test uses `mockedReaddir` but `readdir` is not imported, causing 8 errors.

**Files:**
- Modify: `src/main/services/claude-monitor.test.ts`

- [ ] **Step 1: Read the test file imports and mock setup (lines 1-40)**

Look for how `readdir` is mocked. It's likely that `readdir` needs to be imported from `node:fs/promises` and then referenced in the mock.

- [ ] **Step 2: Add the missing import**

```typescript
import { readdir, readFile } from 'node:fs/promises'
```

Or if the mock setup uses `vi.mocked()`, ensure the import exists for the type reference.

- [ ] **Step 3: Verify**

```bash
npm run typecheck:node 2>&1 | grep "claude-monitor.test"
# Should show 0 errors (UsageSnapshot unused import handled in Workstream A)
```

---

### Task C3: Fix Docker integration test types

**Files:**
- Modify: `src/main/services/__integration__/container-manager.integration.test.ts:248`
- Modify: `src/main/services/__integration__/docker-agent-adapter.integration.test.ts:37,46,79,80,81`

- [ ] **Step 1: Fix ContainerManagerDeps — add `getApiKey`**

Read the `ContainerManagerDeps` type definition. If `getApiKey` is used in the test but not in the type, either:
- Add `getApiKey` to the type (if the implementation needs it), or
- Remove it from the test mock (if it's not actually used)

- [ ] **Step 2: Fix DockerExecOptions — add `env` property**

Read the `DockerExecOptions` type. Add the `env` property:

```typescript
env?: Record<string, string>
```

Read the type file first to confirm location and existing shape.

- [ ] **Step 3: Verify**

```bash
npm run typecheck:node 2>&1 | grep "integration"
# Should show 0 errors
```

---

### Task C4: Fix window-manager.test.ts type errors

**Files:**
- Modify: `src/main/services/window-manager.test.ts:64,155`

- [ ] **Step 1: Read the test around lines 60-70 and 150-160**

Line 64: Cannot assign to read-only `ELECTRON_RENDERER_URL`. Use `vi.stubGlobal()` or type assertion.
Line 155: Unsafe conversion and tuple access. Fix the mock setup to use properly typed values.

- [ ] **Step 2: Fix the read-only assignment**

```typescript
// Instead of direct assignment to process.env or import.meta:
// Use Object.defineProperty or vi.stubEnv
```

- [ ] **Step 3: Fix the tuple access**

Ensure the mock returns the correct shape.

- [ ] **Step 4: Verify**

```bash
npm run typecheck:node 2>&1 | grep "window-manager.test"
```

- [ ] **Step 5: Commit workstream C**

```bash
git add -A
git commit -m "fix(types): fix all type errors in test files

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task D: Final Verification

- [ ] **Step 1: Run full typecheck**

```bash
npm run typecheck 2>&1
# Expected: 0 errors
```

- [ ] **Step 2: Run full test suite**

```bash
npm test 2>&1 | tail -20
# Expected: all tests pass (except pre-existing better-sqlite3 failures if running outside pretest)
```

- [ ] **Step 3: Merge worktree branches and final commit**

If using worktrees, merge all three workstream branches into main. Resolve any conflicts (unlikely since workstreams touch different files).

---

## Execution Strategy

| Workstream | Agent Role | Worktree? | Estimated Tasks |
|-----------|-----------|-----------|----------------|
| A: Unused imports | dev-frontend or dev-backend | Yes — isolate cleanup | 3 tasks, ~15 min |
| B: Prod type fixes | dev-frontend + dev-backend | Yes — isolate fixes | 10 tasks, ~30 min |
| C: Test type fixes | tester-backend | Yes — isolate test fixes | 4 tasks, ~20 min |
| D: Final verification | lead | No — runs on main after merge | 1 task, ~5 min |

**Parallelism:** Workstreams A, B, and C are fully independent — different files, no overlap. Run all 3 in parallel worktrees with max 3 agents.
