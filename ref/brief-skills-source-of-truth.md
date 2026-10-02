# Brief — Source of truth for skills / workflows / teams

_Last reviewed: 2026-10-02 · Brainstorm target: Monday_

## Problem

The same capabilities (`team-sprint-planner`, `team-ui-builder`, `team-brainstorm`, …) are defined in **three places** with no single source of truth:

| Location | Count | Role |
|---|---|---|
| `workflow-server-api/workflows/` | 28 | commercial — served to Hephaestus/OPTimaeus via Opeidos |
| `agenthub/plugin/skills/` | 91 | internal — tracked Claude Code skills |
| `agenthub/.claude/skills/` | 78 | internal — live mirror (gitignored) |

- 23 of 28 workflow-server-api workflows overlap with agenthub skills.
- The `.claude/` ↔ `plugin/` drift was reconciled 2026-10-02 (43 diverged `SKILL.md` + 74 `manifest.yaml` pushed into `plugin/`), but the cross-repo duplication remains.

## Options

- **A — workflow-server-api owns the definitions.** Skills derive/sync from it. (It already has `workflows/` + `WORKFLOW-CATALOG.md`.)
- **B — a shared package owns the definitions** (e.g. `optimaeus-llm`). Both `skills/` and `workflows/` derive from it.
- **C — keep them separate on purpose.** Internal skills evolve fast; commercial workflows are curated.

## Questions to settle

1. Is a "skill" (`SKILL.md`, internal) and a "workflow" (server `.md`, commercial) the *same thing in two formats*, or genuinely different?
2. Which home is the source of truth?
3. What is the sync / derivation mechanism (and does `.claude/skills/` become a generated mirror or disappear)?

## Additional items (Monday)

- `.codex/skills/` is a 4th skill location (Codex's own copy of `orchestrator-coordinator`). `.codex/` and `.llm/` should **mirror** `.claude/` instructions/guardrails and **point to** skills/workflows, not duplicate them.
- `countercheck-rule.md` is duplicated in `.llm/` and `.codex/` and they differ — reconcile to one.
- `.codex/AGENTS.md` is referenced by the skill-discovery rule but does not exist — create it or fix the reference.
- `calentity` (OPTimaeus business calendar): wire the route agenthub → Anamnesis → calentity so scheduled items surface in the calendar.
