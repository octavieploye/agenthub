---
name: team-ceo-coaching
description: CEO Coaching Team Orchestrator — structured coaching sessions with intake profiling, inner/outer game coaching, and session synthesis
category: business-venture
---

# Team CEO Coaching

## When to Use

Invoke when the user wants CEO-level coaching: mindset blocks, strategic decisions, execution problems, leadership challenges, or a structured coaching intake session.

## What You Need Before Starting

- Check `docs/ceo-coaching/profiles/` for an existing CoachingProfile
- If no profile exists, the session starts with intake (ceo-profiler)
- If profile exists, read it + most recent session from `docs/ceo-coaching/sessions/`

## What This Team Produces

- **Intake session:** CoachingProfile (personality assessment, domain scores)
- **Standard session:** 3 key insights + next actions + pattern flags
- **All sessions:** Session record in `docs/ceo-coaching/sessions/` + `memory/coaching/`

## Agent Sequence

1. `ceo-profiler` — intake and personality assessment (first session or crisis only)
2. `ceo-inner` — inner game: mindset, resilience, fear, avoidance (domains 2, 7)
3. `ceo-outer` — outer game: strategy, financials, execution, marketing, leadership (domains 1, 3, 4, 5, 6)
4. `ceo-synthesizer` — closes every session, produces structured synthesis (never skipped)

## Routing

| Presenting problem | Route to |
|---|---|
| "I keep avoiding X" / fear / identity / can't make myself do it | `ceo-inner` |
| Strategic direction / hiring / pricing / marketing | `ceo-outer` |
| Fear-driven financial avoidance | `ceo-inner` + `ceo-outer` |
| First session / no profile | `ceo-profiler` |
| Crisis / "I'm stuck / nothing works" | `ceo-profiler` (re-check) → `ceo-inner` |
| When in doubt | Route to `ceo-inner` first |

## Key Rules

- Never coach directly from the orchestrator — always dispatch to an agent
- `ceo-synthesizer` closes every session — never skip it
- Never cite Bezos, Musk, Zuckerberg as business authorities (SOURCES RULE)
- Maximum 3 agents active at once

## Output Format

### Intake Session — CoachingProfile

```
COACHING PROFILE
================
Name:             [user name or alias]
Date:             [ISO 8601]
Session #:        1 (intake)

DOMAIN SCORES (1-10)
  1. Strategic clarity:     [score] — [one-line rationale]
  2. Emotional resilience:  [score] — [one-line rationale]
  3. Financial acumen:      [score] — [one-line rationale]
  4. Marketing instinct:    [score] — [one-line rationale]
  5. Execution discipline:  [score] — [one-line rationale]
  6. Leadership presence:   [score] — [one-line rationale]
  7. Self-awareness:        [score] — [one-line rationale]

RADAR CHART DATA
  [7 domain labels + scores — render as markdown table for chart tools]

PERSONALITY PATTERNS
  Decision style:         [analytical | intuitive | consultative | avoidant]
  Under pressure:         [fight | flight | freeze | fawn]
  Blind spot:             [identified pattern]

INITIAL GOALS (SMART format)
  1. [Specific, Measurable, Achievable, Relevant, Time-bound]
  2. [...]
  3. [...]
```

### Standard Session — Session Record

```
SESSION RECORD
==============
Date:             [ISO 8601]
Session #:        [n]
Duration:         [minutes]
Presenting topic: [user's stated issue]

EXPLORATION
  Root cause identified:  [yes/no — if yes, describe]
  Patterns observed:      [list — link to prior sessions if recurring]
  Inner game signals:     [avoidance, fear, identity conflict — if present]

KEY INSIGHTS
  1. [insight + evidence from session]
  2. [...]
  3. [...]

ACTIONS
  | # | Action | Domain | Deadline | Success metric |
  |---|---|---|---|---|
  [3-5 actions, each tied to a domain score]

COACH OBSERVATIONS (not shared with user unless asked)
  Progress vs profile:    [improving / stagnant / regressing — on which domains]
  Pattern flags:          [recurring avoidance, deflection, or breakthrough signals]

SESSION VALUE RATING
  User self-rating:       [1-10, asked at end of session]
  Coach assessment:       [1-10, based on insight depth + action quality]
```
