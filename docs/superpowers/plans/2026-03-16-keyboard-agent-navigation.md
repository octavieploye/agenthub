# Keyboard Agent Navigation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add keyboard shortcuts — Option+↑/↓ to navigate the agent sidebar list, Option+←/→ to switch agent terminals in terminal view.

**Architecture:** Single block added inside the existing `handleKeyDown` useEffect in `App.tsx`. No new files needed. `e.altKey` maps to the Mac Option key in browser events.

**Tech Stack:** React hooks, TypeScript, `useAgentStore` + `useViewStore` Zustand stores, existing `handleSelectAgent`.

---

## Design Decisions

| Shortcut | Action |
|----------|--------|
| `Option+↑` | Select previous agent in sidebar (wraps) |
| `Option+↓` | Select next agent in sidebar (wraps) |
| `Option+←` | Switch to previous agent terminal (terminal view only, wraps) |
| `Option+→` | Switch to next agent terminal (terminal view only, wraps) |

- No focus guard needed — Option key combos don't conflict with PTY input.
- Left/right scoped to terminal view to avoid conflicting with horizontal scrolling elsewhere.

---

## File Map

| File | Change |
|------|--------|
| `src/renderer/src/App.tsx` | Add `Option+Arrow` block inside existing `handleKeyDown` useEffect |

---

## Task 1: Implement Option+Arrow navigation in App.tsx

**Files:**
- Modify: `src/renderer/src/App.tsx` — `handleKeyDown` useEffect (~line 331)

- [ ] **Step 1: Locate the existing keyboard shortcut block in App.tsx**

The block starts around line 331:
```tsx
const handleKeyDown = (e: KeyboardEvent): void => {
  if (e.metaKey || e.ctrlKey) {
    ...
  }
}
```

- [ ] **Step 2: Add Option+Arrow block after the existing metaKey block**

Add this block inside `handleKeyDown`, right after the closing `}` of the `if (e.metaKey || e.ctrlKey)` block:

```tsx
// Agent navigation — Option+Arrow (Mac: Option key = e.altKey)
if (e.altKey && !e.metaKey && !e.ctrlKey) {
  const currentAgents = Array.from(useAgentStore.getState().agents.values())
  if (currentAgents.length < 2) return

  const currentId = useAgentStore.getState().activeAgentId
  const currentIndex = currentAgents.findIndex((a) => a.id === currentId)

  // Option+↑ / Option+↓ — navigate agent list from any view
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const nextIndex =
      e.key === 'ArrowDown'
        ? (currentIndex + 1) % currentAgents.length
        : (currentIndex - 1 + currentAgents.length) % currentAgents.length
    handleSelectAgent(currentAgents[nextIndex].id)
    return
  }

  // Option+← / Option+→ — switch agent terminals, only in terminal view
  if (
    (e.key === 'ArrowRight' || e.key === 'ArrowLeft') &&
    useViewStore.getState().viewMode === 'terminal'
  ) {
    e.preventDefault()
    const nextIndex =
      e.key === 'ArrowRight'
        ? (currentIndex + 1) % currentAgents.length
        : (currentIndex - 1 + currentAgents.length) % currentAgents.length
    handleSelectAgent(currentAgents[nextIndex].id)
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Run existing tests to verify no regressions**

```bash
npx vitest run --reporter=verbose 2>&1 | grep -E "PASS|FAIL|Tests:" | tail -20
```
