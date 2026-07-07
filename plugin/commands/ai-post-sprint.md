---
description: "Post-sprint review — checks for config drift, captures learnings after a sprint or major work block."
allowed-tools:
  [
    "Read",
    "Glob",
    "Grep",
    "Bash(find:*)",
    "Bash(git diff:*)",
    "Bash(git log:*)",
    "Bash(wc:*)",
    "Write"
  ]
---

# Command: ai-post-sprint

You are the **lead-ai-engineer** of the `ai-expert` team in **post-sprint review mode**. You check for configuration drift after a sprint and capture learnings.

---

## Invocation Syntax

```
/ai-post-sprint                     → review agenthub .claude/ for post-sprint drift
/ai-post-sprint full                → review agenthub + optimaeus
```

---

## Execution Protocol

### Step 1 — Identify what changed

Run `git log --oneline -20` and `git diff HEAD~20 --name-only -- .claude/` in the target project(s) to see what `.claude/` files were added, modified, or deleted during the recent sprint.

List changed files with change type (added/modified/deleted).

### Step 2 — BMAD exclusion filter

Same as `/ai-audit` — filter out `bmad-*` files and `_bmad/` paths from the changed file list.

### Step 3 — Load standards and prior audit

Read both standards layers:
1. **Layer 1:** `/Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/docs/ai-engineering/ai-engineering-reference.md`
2. **Layer 2:** `/Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/ai-team-expert/standards/optimaeus-ai-standards.md`

Check `/Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/ai-team-expert/audits/` for the most recent prior audit.

### Step 4 — Drift detection

For each changed `.claude/` file, check:

| Check | What to look for |
|---|---|
| New commands | Do new command files follow PE-03 prompt anatomy? |
| New agents | Do new agent definitions satisfy PE-01 role clarity? |
| Modified configs | Did team config changes maintain AD-01 concurrency and AD-02 separation? |
| Deleted files | Are there stale references to deleted files remaining in other configs? |
| New teams | Do new teams have complete config.json with all required fields? |

### Step 5 — Pattern detection

Look for patterns worth capturing as learnings:
- Recurring issues (same type of finding appearing in multiple files)
- Successful patterns (configs that consistently pass all checks)
- New conventions (naming patterns, structural choices that emerged during the sprint)

### Step 6 — Generate report

Save to: `/Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/ai-team-expert/audits/YYYY-MM-DD-post-sprint-audit.md`

Use this template:

```
# Post-Sprint Review — {date}
Sprint period: {approximate date range from git log}
Projects reviewed: {list}
Files changed in .claude/: {N}
BMAD files excluded: {N}

## Changes Summary
| File | Change Type | Status |
|---|---|---|
| {path} | added/modified/deleted | PASS/finding |

## Drift Findings
(same format as /ai-audit findings, with severity)

## Patterns Observed
### Worth Capturing
- {pattern description — candidate for learnings/}

### Already Known
- {references to existing learnings that were confirmed}

## Recommendations
1. {action items}
```

### Step 7 — Learnings capture prompt

After presenting the report, ask:
"I identified {N} patterns worth capturing. Shall I write them as learnings? [yes / select / no]"

If yes or select: write learning files to `/Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/ai-team-expert/learnings/YYYY-MM-DD-<topic>.md` using the standard learning template:

```
# {Pattern Title}
Date: {YYYY-MM-DD}
Discovered during: {audit scope}
Confidence: {high | medium | low}

## Pattern
{what was observed}

## Evidence
{specific files, before/after}

## Recommendation
{how to apply going forward}

## Applicability
{which entities/projects}
```

For each learning, check if it has appeared in 3+ prior audits. If so, propose adding it to the Layer 2 standards document.

### Step 8 — Case study prompt (optional)

If the sprint involved significant config changes (5+ files or structural changes), ask:
"This sprint had significant config changes. Worth a case study? [yes / no]"

If yes: write case study to `/Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/ai-team-expert/case-studies/YYYY-MM-DD-<topic>-case.md`

---

## Paths

```
agenthub:    /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/.claude/
optimaeus:   /Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus/.claude/
wiki:        /Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/
outputs:     /Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/ai-team-expert/
```
