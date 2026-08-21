# KNOWLEDGE: Project Calendar — Workflow to Schedule
OWNER:  lead-brain + strategy-advisor
UPDATED: 2026-06-26
SOURCE: Project management research (CPM, workback scheduling), content production
        pipelines, [source] backward planning

---

## PURPOSE

Rules for breaking a project into a workflow of tasks, estimating time,
and mapping those tasks onto a calendar. This is the PROJECT calendar —
separate from the HUMAN calendar (see human-constraints.md).

---

## RULE 1 — EVERY DELIVERABLE IS A PIPELINE

A deliverable is never a single block of time. It is a sequence of stages.
Each stage has its own time estimate, energy requirement, and dependencies.

### Example — Podcast Episode:

| Stage | Tasks | Estimated time | Energy type | Can AI help? |
|---|---|---|---|---|
| 1. Planning | Research topic, outline, guest prep | 1.5h | Peak (creative) | YES — research, draft outline |
| 2. Recording | Record episode | 1.5h | Peak (performance) | NO — human only |
| 3. Editing | Cut, clean audio, add intro/outro | 3h | High (sustained focus) | YES — rough cut, noise removal |
| 4. Assets | Show notes, thumbnails, social posts | 1h | Medium | YES — draft all, human reviews |
| 5. Publishing | Upload, schedule, distribute | 0.5h | Low (routine) | YES — can automate |
| 6. Promotion | Social posts, email newsletter, community | 1h | Medium | YES — draft posts, schedule |
| **Total** | | **8.5h** | | |
| **With 25% buffer** | | **~10.5h** | | |

### Example — Marketing Campaign:

| Stage | Estimated time | Energy type |
|---|---|---|
| 1. Strategy & research | 2-3h | Peak |
| 2. Copy & creative brief | 2h | Peak |
| 3. Design / asset creation | 3-4h | High |
| 4. Review & approval | 1h | Medium |
| 5. Setup & deployment | 1-2h | Low-Medium |
| 6. Monitor & optimize | 1h/week ongoing | Medium |

---

## RULE 2 — ESTIMATE THEN ADD BUFFER

| Step | Action |
|---|---|
| 1 | Estimate each stage independently — do not estimate the whole project as one number |
| 2 | Add 25% buffer to the total — not to each stage |
| 3 | Track actual vs estimated after completion — improve future estimates |
| 4 | If a stage has never been done before, double the estimate |

### Why 25%:
- Tasks almost always take longer than estimated
- Interruptions, rework, and coordination eat time
- 25% is the minimum safe margin — increase for unfamiliar work

---

## RULE 3 — MAP STAGES TO ENERGY TYPES

Not all stages require the same energy. Place them accordingly.

| Energy requirement | Stage types | When to schedule |
|---|---|---|
| Peak | Strategy, creative writing, recording, hard decisions | Morning maker block |
| High | Editing, design, analysis, structured creation | Second maker block |
| Medium | Reviews, meetings, collaboration, promotion | Manager block |
| Low | Publishing, uploading, admin, scheduling | End of day |

Rule: NEVER schedule a peak-energy stage in a low-energy slot.
A strategy session at 4pm will produce worse output than at 9am.

---

## RULE 4 — BACKWARD PLAN FROM DEADLINE

Always plan backward from the delivery date, not forward from today.

### The sequence:

```
1. Set the deadline (immovable)
2. List all stages in reverse order
3. Assign duration to each stage (with buffer)
4. Place the last stage just before the deadline
5. Work backward: each stage ends when the next must start
6. The start date reveals itself — if it is in the past, the scope is too large
```

### Example — Podcast #4 publishes Thursday:

```
Thursday   → Publish + promote (0.5h + 1h)
Wednesday  → Assets creation (1h)
Tuesday    → Editing (3h)
Monday     → Recording (1.5h)
Friday prior → Planning + research (1.5h)
```

If the start date (Friday) is already past, you must either:
- Cut scope (shorter episode, skip promotion)
- Delegate stages to AI or outsource
- Move the deadline

---

## RULE 5 — IDENTIFY DEPENDENCIES

Some stages cannot start until others finish. Some can run in parallel.

| Dependency type | Rule | Example |
|---|---|---|
| Finish-to-Start | A must finish before B starts | Recording must finish before editing starts |
| Parallel | A and B can happen at the same time | AI generates show notes WHILE human edits audio |
| Conditional | B only happens if A produces a certain result | Promotion only starts if review passes |

### Critical path:
The critical path is the longest chain of dependent stages.
If any stage on the critical path slips, the ENTIRE project slips.

Rule: always identify the critical path first and protect those stages.

---

## RULE 6 — TWO CALENDARS, ONE ALLOCATION

| Calendar | What it holds | Who manages it |
|---|---|---|
| Project calendar | All stages of all projects, with estimates and dependencies | AI generates, human approves |
| Human calendar | Available time slots after constraints and exceptions | System computes from human-constraints.md |

### The allocation process:

```
1. Project calendar produces: list of tasks with duration, energy type, dependencies
2. Human calendar produces: available slots with energy levels
3. AI matches tasks to slots:
   a. Human-only tasks → place in human calendar
   b. AI-only tasks → run in background (no human slot needed)
   c. Human+AI tasks → place in human calendar with AI support noted
   d. Outsource candidates → flag for user decision
4. If human calendar cannot hold all human-only tasks:
   a. Suggest outsourcing specific stages
   b. Suggest rescheduling to later dates
   c. Suggest scope reduction
   d. Present all options — user decides
```

---

## RULE 7 — MULTI-PROJECT SEQUENCING

When running multiple projects simultaneously:

| Rule | Why |
|---|---|
| One project's critical-path task per day maximum | Prevents context switching between deep-work projects |
| Batch similar stages across projects | All recording on Monday, all editing on Tuesday |
| Day-theme by project when possible | Monday = Project A, Tuesday = Project B |
| Never let one project starve the others | Weekly review catches imbalance (see scheduling-frameworks.md) |
| Track capacity across projects, not per project | Human has one calendar, not three |

---

## ANTI-PATTERNS

1. Treating a project as a single calendar block ("podcast time") instead of a pipeline
2. Estimating the whole project as one number instead of per stage
3. Planning forward from today instead of backward from the deadline
4. No buffer — one stage overruns and everything cascades
5. Ignoring energy types — scheduling creative work at low-energy times
6. Not identifying parallel stages — missing opportunities for AI to work simultaneously
7. Filling the human calendar to 100% — no room for overflow or emergencies
8. Running 3 critical-path tasks from 3 different projects in the same day
