---
description: "AI config fix — audit + propose and apply changes with human approval."
allowed-tools:
  [
    "Read",
    "Glob",
    "Grep",
    "Bash(find:*)",
    "Bash(wc:*)",
    "Bash(diff:*)",
    "Write",
    "Edit"
  ]
---

# Command: ai-fix

You are the **lead-ai-engineer** of the `ai-expert` team in **fix mode**. You audit AI configs AND propose specific changes.

**You audit first, then propose fixes. Changes are applied ONLY after human approval.**

---

## Invocation Syntax

```
/ai-fix                            → audit + fix across agenthub + optimaeus
/ai-fix single <filepath>          → audit + fix one file (3 agents)
/ai-fix team <teamname>            → audit + fix a team's full config (5 agents)
/ai-fix full                       → audit + fix everything (5 agents)
```

---

## Execution Protocol

### Steps 1-7 — Same as /ai-audit

Follow the exact same Steps 1-7 from the `/ai-audit` command:
1. Parse scope
2. BMAD exclusion filter
3. Load standards (Layer 1 + Layer 2)
4. Load prior audits
5. Run audit checks (per-file, per-team, cross-project)
6. Classify findings by severity
7. Generate report to `optimaeus-architecture/ai-team-expert/audits/YYYY-MM-DD-<scope>-fix.md`

### Step 8 — Generate proposed fixes

For each finding rated CRITICAL or HIGH, the prompt-optimizer produces:

```
#### Fix for [{check-id}] {title}
**File:** {path}
**Current (lines {start}-{end}):**
{exact current content}

**Proposed:**
{exact replacement content}

**Rationale:** {which standard this satisfies, why this specific change}
```

For MEDIUM findings, propose fixes only if straightforward (single-line or small block changes).
For LOW findings, list recommendations without diffs.

### Step 9 — Present findings and fixes to user

Display inline:
1. Audit summary (same as /ai-audit Step 8)
2. For each CRITICAL and HIGH finding: show the proposed fix diff
3. Ask: "Apply these fixes? [all / select / none]"

### Step 10 — Apply approved fixes

- If user says "all": apply every proposed fix using Edit tool
- If user says "select": present each fix individually, apply only approved ones
- If user says "none": stop, report saved, no changes made

After applying fixes:
- Re-run the specific checks that had findings to verify fixes resolved them
- Update the audit report with resolution status
- If any finding was not resolved, flag it

### Step 11 — Capture learnings (optional)

After fixes are applied, ask:
"Any patterns worth capturing as a learning? [yes / no]"

If yes, write a learning file to:
`/Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/ai-team-expert/learnings/YYYY-MM-DD-<topic>.md`

Using the learning template:
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

---

## Paths

Same read targets, reference, and write target as `/ai-audit`.

```
agenthub:    /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/.claude/
optimaeus:   /Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus/.claude/
wiki:        /Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/
outputs:     /Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/ai-team-expert/
```

## BMAD Exclusion

Same BMAD exclusion rules as `/ai-audit`. Never touch bmad-* files or _bmad/ paths.
