---
name: team-data
description: Data Team Orchestrator — archives session outputs, identifies cross-session patterns, risks, and opportunities
---

# Team Data

## When to Use

Invoke automatically after every business, marketing, brainstorm, or tech-brainstorm session completes — to deposit the session output into the memory folder. Also invoke when the user wants cross-session analysis: finding patterns, identifying risks, or surfacing opportunities that only become visible across multiple sessions.

## What You Need Before Starting

**For deposit:** The session synthesis from the completed session (passed by lead of that team).
**For cross-session analysis:** The memory/index.md must have at least 2 records (opportunity-analyst) or 1 record (risk-analyst) to work with.

## What This Team Produces

**Auto-deposit (after every session):**
- Schema-compliant record in `workflow-team-library/memory/records/{type}/YYYY-MM-DD-{slug}.md`
- Updated `workflow-team-library/memory/index.md` entry

**Cross-session analysis (on request):**
- Opportunity report: patterns in 3+ records, white space findings, cross-session connections
- Risk report: contradictions, decaying signals, blind spots, assumption drift

## Agent Sequence

**Deposit mode:** `data-architect` only — reads synthesis, selects schema, creates record, updates index.

**Analysis mode (select as needed):**
- `opportunity-analyst` — cross-session patterns and opportunities (min 2 supporting record IDs)
- `risk-analyst` — contradictions, decaying signals, blind spots, assumption drift

## Key Rules

- Deposit runs after EVERY session — never skipped
- data-architect marks empty fields as [NOT CAPTURED] — never invents content
- CS scores are copied exactly from session synthesis — never re-scored by data team
- opportunity-analyst requires min 2 supporting record IDs per opportunity — cannot run with fewer than 2 relevant records
- risk-analyst never resolves contradictions — surfaces them as CSL items for the user to decide
- Non-assumption rule: cite record IDs for every claim — never generalize without evidence
- trustworthy-sources skill required before citing any external source in analysis reports

## How to Invoke

- **Deposit:** After a session, lead of that team routes the session synthesis to lead-data. Lead-data dispatches data-architect.
- **Analysis:** Tell lead-data what you want to find (opportunities, risks, or both). Lead-data reads index first, then dispatches the relevant analyst agent(s).
