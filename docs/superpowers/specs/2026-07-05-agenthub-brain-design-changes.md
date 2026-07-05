# AgentHub Brain Design - Changes Summary

## Date: 2026-07-05
## Updated Spec: 2026-07-05-agenthub-brain-design.md

## Three New Features Added

### 1. Repo/Project Path Display with Annotations ✅

**What was added:**
- Pointer files now support an optional `note` field in frontmatter for annotations
- Brain entry rows display the relative artifact path as muted text
- Notes are displayed as italicized text below the path
- Database schema updated with `note TEXT` column (Migration 030)

**UI Example:**
```
Token Optimizer    plan→sprint   ████░░  3/5    IN PROGRESS   [open]
  docs/superpowers/specs/2026-07-05-token-optimizer-spec.md
  "Needs validation sprint before implementation"
```

**Files Changed:**
- `BrainEntryRow.tsx` - added path and note display
- `brain-scanner.ts` - parse and store note field
- `brain.types.ts` - added note to BrainEntry interface
- Migration 030 - added note column to brain_entries table

### 2. Add Task to Kanban Functionality ✅

**What was added:**
- `[+ Task]` button on each brain entry row
- Lightweight task creation modal pre-filled with brain entry details
- Automatic linking of new tasks to brain entries via `brain_entry_id`
- New IPC channel `brain:create-task`

**Workflow:**
1. Click `[+ Task]` button
2. Modal opens with pre-filled subject from brain entry
3. Add optional description
4. Submit creates task in kanban with automatic linking
5. Task counts update automatically

**Files Changed:**
- `BrainEntryRow.tsx` - added [+ Task] button
- `BrainTaskModal.tsx` - new component for task creation
- `brain.ipc.ts` - added brain:create-task channel
- `brain-scanner.ts` - added createTaskFromBrainEntry method

### 3. Timeline View (Brain + Git Events) ✅

**What was added:**
- New `[Timeline]` tab in Brain panel
- Vertical timeline showing merged brain and git events
- Brain events (blue brain icon) + Git commits (green git icon)
- Auto-refresh every 30s + manual refresh
- Chronological sorting with date headers

**UI Example:**
```
Jul 5
  ◆ spec created       "Token Optimizer"
  ◆ plan created       "Token Optimizer"

Jul 6
  ● git commit         "feat(token-optimizer): add pipeline"
  ● git commit         "fix(token-optimizer): gate logic"
```

**Files Changed:**
- `BrainPanel.tsx` - added tab switcher
- `BrainTimelineView.tsx` - new timeline component
- `BrainTimelineEntry.tsx` - timeline entry component
- `brain-scanner.ts` - added getTimeline method with git merging
- `brain.ipc.ts` - added brain:timeline channel

## Database Changes

### New Migration (030)
```sql
ALTER TABLE brain_entries ADD COLUMN note TEXT;
```

### Updated Interfaces
```typescript
export interface BrainEntry {
  // ... existing fields
  note?: string
}

export interface BrainTimelineEntry {
  id: string
  repoId: string
  date: string
  type: 'brain' | 'git'
  subject: string
  details?: string
  icon: 'brain' | 'git-commit'
}
```

## IPC Changes

### New Channels
- `brain:timeline` - `{ repoId: string }` → `BrainTimelineEntry[]`
- `brain:create-task` - `{ brainEntryId, subject?, description? }` → creates linked task

### Updated Channels
- `brain:register` - now accepts optional `note` field
- `brain:query` - now returns `note` in results

## Scope Impact

**Total New Files:** 4
- `BrainTimelineView.tsx`
- `BrainTimelineEntry.tsx`
- `BrainTaskModal.tsx`
- `030-brain-note-column.sql`

**Modified Files:** 8
- `BrainEntryRow.tsx`
- `BrainPanel.tsx`
- `brain-scanner.ts`
- `brain.ipc.ts`
- `brain.types.ts`
- `brain.queries.ts`
- `BrainRegisterModal.tsx`
- `workspace-memory-writer.ts`

**Total Scope:** ~500 lines of code across 12 files. Manageable in single sprint.

## Backward Compatibility

✅ All changes are additive
✅ Existing pointer files without `note` field continue to work
✅ Optional fields maintain backward compatibility
✅ No breaking changes to existing IPC contracts

## Next Steps

The spec is now complete with all requested features. Ready for:
1. Implementation planning
2. Writing the implementation plan
3. Code implementation
4. Testing and validation
