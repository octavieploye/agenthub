# AgentHub Brain — Implementation Plan

**Date:** 2026-07-05
**Spec:** 2026-07-05-agenthub-brain-design.md
**Status:** draft
**Estimated Duration:** 1 sprint (5-7 days)

---

## Overview

This plan implements three new features for the AgentHub Brain panel:
1. **Repo/Project Path Display with Annotations** - Show artifact paths and review notes
2. **Add Task to Kanban** - Quick task creation linked to brain entries
3. **Timeline View** - Merged brain and git event timeline

---

## Phase 1: Database & Backend Setup (1 day)

### Task 1.1: Database Migration for Note Field
**File:** `src/main/db/migrations/030-brain-note-column.sql`
**Effort:** 30m
**Dependencies:** None

```sql
-- Migration 030
ALTER TABLE brain_entries ADD COLUMN note TEXT;
```

**Steps:**
1. Create migration file
2. Add to migration runner
3. Test migration applies correctly
4. Verify column exists in DB

### Task 1.2: Update Brain Scanner Service
**File:** `src/main/services/brain-scanner.ts`
**Effort:** 2h
**Dependencies:** Task 1.1

**Changes:**
- Parse `note` field from frontmatter
- Store note in database during scan
- Add `getTimeline()` method for timeline feature
- Add `createTaskFromBrainEntry()` method

**Implementation:**
```typescript
// Parse note from frontmatter
const note = frontmatter.note || null;

// Store in DB
db.run("UPDATE brain_entries SET note = ? WHERE id = ?", [note, entry.id]);

// Timeline method
async function getTimeline(repoId: string): Promise<BrainTimelineEntry[]> {
  const brainEvents = await getBrainEvents(repoId);
  const gitEvents = await gitService.getRecentCommits(repoId);
  return mergeAndSortEvents(brainEvents, gitEvents);
}
```

### Task 1.3: Update IPC Handlers
**File:** `src/main/ipc/brain.ipc.ts`
**Effort:** 1.5h
**Dependencies:** Task 1.2

**New Handlers:**
```typescript
// brain:timeline handler
electronIpcMain.handle('brain:timeline', async (event, { repoId }) => {
  return brainScanner.getTimeline(repoId);
});

// brain:create-task handler
electronIpcMain.handle('brain:create-task', async (event, { brainEntryId, subject, description }) => {
  return brainScanner.createTaskFromBrainEntry(brainEntryId, subject, description);
});
```

### Task 1.4: Update Queries
**File:** `src/main/db/queries/brain.queries.ts`
**Effort:** 1h
**Dependencies:** Task 1.1

**Changes:**
- Include `note` in query results
- Add timeline query

---

## Phase 2: Shared Types & Interfaces (0.5 day)

### Task 2.1: Update Brain Types
**File:** `src/shared/types/brain.types.ts`
**Effort:** 1h
**Dependencies:** None

**Additions:**
```typescript
export interface BrainEntry {
  // ... existing fields
  note?: string;
}

export interface BrainTimelineEntry {
  id: string;
  repoId: string;
  date: string;
  type: 'brain' | 'git';
  subject: string;
  details?: string;
  icon: 'brain' | 'git-commit';
}

export interface CreateTaskFromBrainInput {
  brainEntryId: string;
  subject?: string;
  description?: string;
}
```

### Task 2.2: Update IPC Channels
**File:** `src/shared/constants/ipc-channels.ts`
**Effort:** 30m
**Dependencies:** None

**Additions:**
```typescript
export const BRAIN = {
  // ... existing
  TIMELINE: 'brain:timeline',
  CREATE_TASK: 'brain:create-task',
};
```

---

## Phase 3: Frontend Implementation (2 days)

### Task 3.1: Brain Entry Row Updates
**File:** `src/renderer/src/widgets/brain-panel/BrainEntryRow.tsx`
**Effort:** 2h
**Dependencies:** Phase 2

**Changes:**
- Display artifact path as muted text
- Display note as italicized text
- Add `[+ Task]` button
- Add timeline icon/button

**UI Structure:**
```tsx
<div className="brain-entry-row">
  <div className="main-info">
    {/* ... existing subject, badges, etc. */}
  </div>
  <div className="path-info text-sm text-gray-500">
    {entry.artifactPath}
  </div>
  {entry.note && (
    <div className="note-info text-sm italic text-gray-400">
      "{entry.note}"
    </div>
  )}
  <div className="actions">
    <button onClick={openArtifact}>[open]</button>
    <button onClick={openTaskModal}>[+ Task]</button>
  </div>
</div>
```

### Task 3.2: Task Creation Modal
**File:** `src/renderer/src/widgets/brain-panel/BrainTaskModal.tsx`
**Effort:** 3h
**Dependencies:** Task 3.1

**Implementation:**
```tsx
function BrainTaskModal({
  brainEntry,
  onClose,
  onCreate
}) {
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    onCreate({
      brainEntryId: brainEntry.id,
      subject: brainEntry.subject,
      description
    });
  };

  return (
    <Modal>
      <h3>Create Task from Brain Entry</h3>
      <div>Subject: {brainEntry.subject}</div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Task description..."
      />
      <button onClick={handleSubmit}>Create Task</button>
    </Modal>
  );
}
```

### Task 3.3: Timeline View Components
**Files:**
- `BrainTimelineView.tsx` (2h)
- `BrainTimelineEntry.tsx` (1.5h)
**Effort:** 3.5h
**Dependencies:** Phase 2

**BrainTimelineView.tsx:**
```tsx
function BrainTimelineView({ repoId }) {
  const [entries, setEntries] = useState<BrainTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      setLoading(true);
      const result = await window.electron.ipcRenderer.invoke('brain:timeline', { repoId });
      setEntries(result);
      setLoading(false);
    };

    fetchTimeline();
    const interval = setInterval(fetchTimeline, 30000);
    return () => clearInterval(interval);
  }, [repoId]);

  const groupedByDate = groupEntriesByDate(entries);

  return (
    <div className="timeline-view">
      {Object.entries(groupedByDate).map(([date, events]) => (
        <TimelineDateGroup key={date} date={date} events={events} />
      ))}
    </div>
  );
}
```

**BrainTimelineEntry.tsx:**
```tsx
function BrainTimelineEntry({ entry }) {
  const icons = {
    brain: <BrainIcon />,
    git: <GitCommitIcon />
  };

  return (
    <div className="timeline-entry">
      <div className="icon">{icons[entry.type]}</div>
      <div className="content">
        <div className="subject">{entry.subject}</div>
        {entry.details && <div className="details">{entry.details}</div>}
      </div>
    </div>
  );
}
```

### Task 3.4: Update Brain Panel
**File:** `src/renderer/src/widgets/brain-panel/BrainPanel.tsx`
**Effort:** 2h
**Dependencies:** Tasks 3.1, 3.3

**Changes:**
- Add tab switcher: `[Overview] [Timeline]`
- Conditional rendering based on active tab
- State management for active tab

```tsx
function BrainPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline'>('overview');

  return (
    <div className="brain-panel">
      <div className="header">
        <h2>Brain</h2>
        <div className="tabs">
          <button
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={activeTab === 'timeline' ? 'active' : ''}
            onClick={() => setActiveTab('timeline')}
          >
            Timeline
          </button>
        </div>
        <button onClick={refresh}>↻ Refresh</button>
      </div>

      {activeTab === 'overview' && <BrainOverviewView />}
      {activeTab === 'timeline' && <BrainTimelineView />}
    </div>
  );
}
```

---

## Phase 4: Integration & Testing (1 day)

### Task 4.1: Wire Everything Together
**Files:**
- `src/main/services/service-orchestrator.ts` - register updated services
- `src/main/ipc/system.ipc.ts` - ensure shell:open-path works
**Effort:** 1h
**Dependencies:** All previous tasks

### Task 4.2: Unit Tests
**Effort:** 3h
**Files:**
- `brain-scanner.test.ts` - test note parsing, timeline merging
- `brain.ipc.test.ts` - test new IPC handlers
- `BrainEntryRow.test.tsx` - test path/note display
- `BrainTimelineView.test.tsx` - test timeline rendering

**Test Cases:**
- Note field parsing from frontmatter
- Timeline event merging and sorting
- Task creation with brain entry linking
- Path display with truncation
- Auto-refresh functionality

### Task 4.3: Integration Tests
**Effort:** 2h
**Scenarios:**
1. Create brain entry with note → verify displays correctly
2. Click `[+ Task]` → verify task created with correct linking
3. Switch to timeline → verify brain and git events appear
4. Add new brain entry → verify timeline updates automatically
5. Make git commit → verify timeline updates on next poll

### Task 4.4: Manual Testing
**Effort:** 2h
**Checklist:**
- [ ] Path display shows correctly for various path lengths
- [ ] Notes display with proper formatting
- [ ] `[+ Task]` button opens modal with pre-filled data
- [ ] Task creation works and links correctly
- [ ] Timeline shows both brain and git events
- [ ] Timeline auto-refreshes every 30s
- [ ] Manual refresh works
- [ ] Tab switching works smoothly
- [ ] All existing functionality still works

---

## Phase 5: Documentation & Cleanup (0.5 day)

### Task 5.1: Update CLAUDE.md
**File:** `.claude/CLAUDE.md`
**Effort:** 30m
**Changes:**
- Add note field to Brain Index rule
- Document new `[+ Task]` functionality
- Document timeline view usage

### Task 5.2: Update How-To Guide
**File:** `docs/how-to/XX-brain-features.md`
**Effort:** 1h
**Content:**
- How to add annotations to brain entries
- How to create tasks from brain entries
- How to use the timeline view
- Best practices for brain entry organization

### Task 5.3: Code Review & Cleanup
**Effort:** 1h
**Checklist:**
- Remove debug console.logs
- Ensure consistent code style
- Add missing type annotations
- Verify all imports are correct
- Check for unused variables

---

## Risk Assessment

### Low Risk ✅
- **Database changes:** Additive only (new column)
- **Backend changes:** Extensions to existing services
- **Frontend changes:** New components, no breaking changes
- **IPC changes:** New channels, existing unchanged

### Medium Risk ⚠️
- **Timeline merging logic:** Complexity in merging two event streams
- **Auto-refresh:** Performance impact if not optimized
- **Task linking:** Ensuring foreign key relationships work correctly

### Mitigation Strategies:
- Write comprehensive tests for timeline merging
- Add debouncing to auto-refresh
- Test task linking thoroughly with edge cases
- Performance test with large repos

---

## Success Criteria

### Feature 1: Path Display with Annotations
- [ ] Artifact paths display correctly for all entries
- [ ] Notes display as italicized text when present
- [ ] Long paths truncate with ellipsis and tooltip
- [ ] Notes are stored and retrieved from database

### Feature 2: Add Task to Kanban
- [ ] `[+ Task]` button visible on all brain entries
- [ ] Modal opens with pre-filled subject from brain entry
- [ ] Task creation works and links to brain entry
- [ ] Linked tasks appear in task counts
- [ ] Brain entry can be accessed from linked task

### Feature 3: Timeline View
- [ ] Timeline tab accessible from Brain panel
- [ ] Brain events (creation/updates) appear in timeline
- [ ] Git commits appear in timeline
- [ ] Events sorted chronologically
- [ ] Auto-refresh works every 30s
- [ ] Manual refresh button works
- [ ] Date headers group events correctly

---

## Timeline & Milestones

| Day | Phase | Tasks | Status |
|-----|-------|-------|--------|
| 1 | Database & Backend | 1.1, 1.2, 1.3, 1.4 | ⏳ Planned |
| 2 | Shared Types | 2.1, 2.2 | ⏳ Planned |
| 3-4 | Frontend | 3.1, 3.2, 3.3, 3.4 | ⏳ Planned |
| 5 | Integration & Testing | 4.1, 4.2, 4.3, 4.4 | ⏳ Planned |
| 6 | Documentation | 5.1, 5.2, 5.3 | ⏳ Planned |

**Total Estimated:** 6 days (1 sprint)

---

## Team Assignment

### Backend (Days 1-2)
- **Agent:** dev-backend
- **Tasks:** Database migration, scanner updates, IPC handlers
- **Focus:** Data model, business logic, API contracts

### Frontend (Days 3-4)
- **Agent:** dev-frontend
- **Tasks:** Component implementation, UI/UX, state management
- **Focus:** React components, user interactions, visual design

### Testing (Day 5)
- **Agent:** tester-frontend + tester-backend
- **Tasks:** Unit tests, integration tests, manual testing
- **Focus:** Quality assurance, edge cases, user flows

### Documentation (Day 6)
- **Agent:** dev-frontend (docs) + architect (review)
- **Tasks:** CLAUDE.md updates, how-to guide, code cleanup
- **Focus:** User documentation, best practices, polish

---

## Dependencies & Blockers

### Internal Dependencies
- ✅ Brain scanner service must be working (existing)
- ✅ Git service must be functional (existing)
- ✅ Kanban task creation must work (existing)
- ✅ IPC infrastructure must be in place (existing)

### External Dependencies
- ❌ None - all dependencies are internal

### Potential Blockers
- ⚠️ Git service performance with large repos
- ⚠️ Timeline rendering performance with many events
- ⚠️ Foreign key constraint issues with task linking

### Mitigation
- Test with largest repo first
- Implement virtualization for timeline if needed
- Write migration to clean up orphaned tasks

---

## Rollback Plan

If issues arise during implementation:

1. **Feature flags:** Wrap new features in feature flags
2. **Database:** Migration 030 is additive - easy to ignore new column
3. **UI:** New components can be hidden without affecting existing functionality
4. **IPC:** New channels can be stubbed if backend not ready

**Full rollback steps:**
1. Revert migration 030
2. Remove new UI components
3. Revert IPC handler additions
4. Remove new types

---

## Monitoring & Metrics

### Post-Implementation Monitoring
- Track usage of `[+ Task]` button
- Monitor timeline view adoption
- Measure note field usage percentage
- Track performance of timeline queries

### Success Metrics
- **Adoption:** 80% of brain entries have tasks created via new button within 2 weeks
- **Usage:** Timeline view used in 50% of brain panel sessions
- **Performance:** Timeline load time < 500ms for repos with < 1000 commits
- **Quality:** < 2 bugs reported in first week of use

---

## Approval Checklist

- [ ] Spec reviewed and approved
- [ ] Implementation plan reviewed
- [ ] Resource allocation confirmed
- [ ] Timeline fits sprint schedule
- [ ] Dependencies verified available
- [ ] Risks assessed and mitigated

**Approver:** _________________________
**Date:** _________________________

---

## Next Steps

1. ✅ Finalize this implementation plan
2. ⏳ Get approval from lead
3. ⏳ Assign tasks to team members
4. ⏳ Begin implementation with Phase 1
5. ⏳ Daily standups to track progress
6. ⏳ Code reviews at each phase completion
7. ⏳ Final testing and documentation
8. ⏳ Deploy to production

---

## Contingency

**If behind schedule:**
1. Prioritize Feature 2 (Add Task to Kanban) - highest user value
2. Simplify Feature 3 timeline to basic view without auto-refresh
3. Defer Feature 1 enhancements (notes) to next sprint if needed

**If ahead of schedule:**
1. Add keyboard shortcuts for common actions
2. Implement search/filter in timeline view
3. Add export functionality for brain data

---

**Plan Status:** Ready for Review
**Last Updated:** 2026-07-05
**Version:** 1.0