# Kanban Board Design Spec

## Overview

A global Kanban board that serves as both the planning surface and the persistent memory for agent work. Cards are the existing `TaskItem` records, columns map to `TaskStatus` values, and SBAR summaries auto-attach when agents finish or get interrupted. The board opens in a breakout window with collapsible columns. Per-agent filtering provides the "what did this agent do" view without a separate data model.

## Goals

- **Lost memory solved:** Every agent's work is captured as an SBAR linked to the task card. Interrupted work shows what happened and what to do next.
- **Future workflow:** The board is where the user plans what agents will work on. Cards flow from Backlog → Today → In Progress → Done.
- **Single source of truth:** TodoTab and Kanban board read from the same `tasks` table and `task-store`. No parallel data model.

## Data Model Changes

### Migration: add `position` and `sbar_id` to tasks

Add two columns to the existing `tasks` table:

- `position INTEGER DEFAULT 0` — sort order within a column. Lower number = higher on the board. When a card is dragged within a column, only the affected cards in that column get their positions recalculated.
- `sbar_id TEXT REFERENCES sbar_handoffs(id)` — nullable. Links the most recent SBAR summary to the card. Set automatically when an agent completes or gets interrupted.

### Type changes

Extend `TaskItem` in `src/shared/types/task.types.ts`:

- Add `position: number`
- Add `sbarId: string | null`

### Column collapse state

Stored via the existing `SettingsService` as a JSON setting:

- Key: `kanban_collapsed_columns`
- Value: `string[]` (e.g. `["backlog", "tested"]`)
- Default: `[]` (all expanded)

## Columns

The 6 existing `TaskStatus` values map directly to Kanban columns:

| Column | Status | Purpose |
|--------|--------|---------|
| Backlog | `backlog` | Ideas and future work |
| Today | `today` | Planned for current session |
| In Progress | `in_progress` | Agent actively working |
| Done | `completed` | Finished successfully |
| Tested | `tested` | Verified/reviewed |
| Interrupted | `interrupted` | Agent stopped, SBAR attached |

All columns are collapsible. Collapsed columns show only the header and card count. Collapse state persists across sessions via `SettingsService`.

## Agent Lifecycle Integration

One-way automation: agent status changes update the card. The board never controls agent lifecycle.

### Status mapping

| Agent event | Card action |
|-------------|-------------|
| Agent spawned via "Play" on a card | `agentId` set on task (already exists) |
| Agent status → `busy` | Task status → `in_progress` |
| Agent status → `completed` | Task status → `completed`, generate SBAR, link via `sbar_id` |
| Agent status → `interrupted` | Task status → `interrupted`, generate SBAR, link via `sbar_id` |
| Agent status → `looping` | No card move; visual indicator on card |
| Agent status → `locked` | No card move; visual indicator on card |

### Where this hooks in

In `agent-manager.ts`, inside the existing status change handler (around the `updateAgentStatus` + `emitToAllRenderers` block). When a status change fires for an agent that has a linked task (via `agentId` on the task), update the task status and attach SBAR if applicable. Emit a task-updated IPC event so the renderer store stays in sync.

### What does NOT happen

- Dragging a card to "In Progress" does not spawn an agent
- Dragging a card to "Done" does not kill an agent
- The board reflects reality; it is not a control surface for agent lifecycle

## Breakout Window

### Window lifecycle

- New breakout window type registered in `WindowManager`, similar to breakout terminals but loads the Kanban route
- Window size/position remembered across sessions via `SettingsService`
- Two triggers to open:
  - **Main app header** — "Board" button opens global view (all repos, all agents)
  - **Agent detail panel** — "Board" button opens pre-filtered to that agent's cards

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Kanban Board                          [Filter: All / Agent ▼]  │
├───────┬──────────┬─────────────┬────────┬────────┬──────────────┤
│▶ Back │ Today    │ In Progress │▶ Done  │▶Tested │ Interrupted  │
│ log   │          │             │        │        │              │
│(col-  │ ┌──────┐ │ ┌──────┐   │(col-   │(col-   │ ┌──────┐    │
│lapsed)│ │Card  │ │ │Card  │   │lapsed) │lapsed) │ │Card  │    │
│       │ │P2    │ │ │P1 🔵 │   │        │        │ │P1 ⚠  │    │
│  3    │ │      │ │ │agent │   │  12    │  5     │ │SBAR  │    │
│       │ └──────┘ │ │working│   │        │        │ │linked│    │
│       │ ┌──────┐ │ └──────┘   │        │        │ └──────┘    │
│       │ │Card  │ │            │        │        │              │
│       │ └──────┘ │            │        │        │              │
└───────┴──────────┴─────────────┴────────┴────────┴──────────────┘
```

### Filter dropdown

Located in the board header. Options:

- **All** — global view, all repos, all agents
- **Per-agent** — shows only cards that agent touched (cards where `agentId` matches). This is the "C" view — the agent's work history.
- **Per-repo** — shows only cards for that repo

When opened from an agent detail panel, the filter defaults to that agent. User can switch to "All" from there.

### Card appearance

Each card shows:

- Title and priority badge (P1/P2/P3)
- Repo name tag (small, muted)
- Agent color dot if assigned, with agent name on hover
- SBAR indicator if `sbarId` is set — clickable to expand the SBAR summary inline on the card
- Animated badge for `looping` or `locked` agent status

### Drag and drop

- Cards draggable between columns (updates `status` in DB)
- Cards draggable within a column (updates `position` in DB)
- Use HTML5 drag API or `@dnd-kit` — check existing dependencies first before adding a library

## SBAR as Card Memory

### End-to-end flow

1. User creates a task card ("Fix auth token refresh") in Backlog
2. User drags to Today or leaves in Backlog
3. User hits "Play" on the card → agent spawns, `agentId` linked to card
4. Agent works → card auto-moves to In Progress
5. Agent finishes/interrupted → SBAR generated → `sbar_id` written to task → card moves to Done/Interrupted

### Next session recovery

User reopens the app, opens the board. Interrupted cards sit in the Interrupted column with SBAR indicators. User clicks a card, sees the SBAR summary (situation, assessment, recommendation). User hits "Play" again → new agent spawns with same task + SBAR context. Card moves back to In Progress.

### SBAR history

A card stores only the latest `sbar_id`. Older SBARs remain in `sbar_handoffs` table linked by `agentId`. The card detail view can show the full SBAR trail by querying all SBARs for agents that worked on that task. No work is ever lost, even across multiple resume/interrupt cycles.

Periodic snapshot SBARs (from the graceful shutdown plan) provide crash resilience — there is always a recent summary available.

## Testing Strategy

### Backend

- DB migration: verify `position` and `sbar_id` columns exist after migration
- Task queries: `updateTaskPosition` (reorder within column), `linkSBARToTask` (attach SBAR id)
- Agent lifecycle hook: agent status change to `completed` updates linked task status and `sbar_id`
- SBAR trail query: fetch all SBARs for a given task across multiple agent assignments

### Renderer

- KanbanBoard component: correct columns rendered, cards in right columns by status, collapsed columns show count only
- Drag and drop: column-to-column updates status, within-column reorder updates position
- Filter: "All" shows all cards, agent filter shows only that agent's cards
- SBAR indicator: cards with `sbarId` show indicator, click expands summary inline

### Integration

- Create task → spawn agent via Play → agent completes → card in Done with SBAR linked
- Breakout window: opens with correct data, filter persists, collapse state persists across close/reopen

All tests use real sqlite and real IPC — no mocks per project testing philosophy.

## Files Affected

| Action | File | Change |
|--------|------|--------|
| Create | `src/main/db/migrations/014-kanban.sql` | Add `position` and `sbar_id` columns to tasks |
| Modify | `src/shared/types/task.types.ts` | Add `position`, `sbarId` to `TaskItem` |
| Modify | `src/main/db/queries/tasks.queries.ts` | Add `updateTaskPosition`, `linkSBARToTask` queries |
| Modify | `src/main/services/agent-manager.ts` | Hook status changes to update linked task + attach SBAR |
| Create | `src/renderer/src/widgets/kanban/KanbanBoard.tsx` | Board component with columns, cards, drag-drop |
| Create | `src/renderer/src/widgets/kanban/KanbanCard.tsx` | Card component with SBAR indicator, agent dot |
| Create | `src/renderer/src/widgets/kanban/KanbanColumn.tsx` | Column component with collapse toggle |
| Modify | `src/main/services/window-manager.ts` | Register kanban breakout window type |
| Create | `src/renderer/src/layouts/KanbanLayout.tsx` | Breakout window layout for kanban |
| Modify | `src/renderer/src/stores/task-store.ts` | Add position/sbar fields, reorder action |
| Modify | `src/renderer/src/App.tsx` | Add "Board" button to header |
| Modify | `src/renderer/src/widgets/agent-detail/AgentDetailPanel.tsx` | Add "Board" button to agent panel |
| Modify | `src/shared/constants/ipc-channels.ts` | Add kanban-specific IPC channels if needed |
| Modify | `src/main/services/settings-service.ts` | Collapse state persistence (may just use existing API) |
