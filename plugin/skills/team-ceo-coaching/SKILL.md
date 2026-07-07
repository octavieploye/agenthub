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
