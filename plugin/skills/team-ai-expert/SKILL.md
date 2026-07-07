---
name: team-ai-expert
description: AI Expert Team Orchestrator — audits, optimizes, and scaffolds .claude/ configs across Optimaeus projects
---

# Team AI Expert

## When to Use

Invoke when the user wants to audit `.claude/` configuration files, optimize prompts for token efficiency, analyze workflow structures, or scaffold new agent commands and skill files. This team operates in report/propose mode — no file changes happen without user approval.

## What You Need Before Starting

- A scope: single file, team name, "full" (all .claude/ files), "pre-build" (readiness gate), or "fix" mode
- For fix mode: config-auditor must have already run and produced a findings report

## What This Team Produces

**Audit mode:** Per-file findings report (PASS/WARN/FAIL/CRITICAL) against two standards layers
**Optimize mode:** BEFORE/AFTER proposal with token delta — no file modified until user approves
**Workflow analysis:** Findings report: dead ends, missing handoffs, gate violations, redundancies
**Scaffold mode:** New command/skill/config files from an approved spec — no scope expansion
**Pre-build gate:** Readiness checklist for `.claude/` config before starting a major build

## Agent Sequence (select per mode)

- `config-auditor` — audit against Layer 1 (ai-engineering-reference) and Layer 2 (Optimaeus standards)
- `prompt-optimizer` — propose token-efficient rewrites (runs after config-auditor in fix mode)
- `workflow-analyst` — analyze orchestration patterns, handoffs, and gate integrity
- `framework-builder` — scaffold new files from an approved spec (only after other agents confirm spec is complete)

## Key Rules

- config-auditor and workflow-analyst are read-only — never modify files
- prompt-optimizer proposals require user approval before framework-builder applies them
- CRITICAL findings (sovereignty violations, missing STOP AND ASK, BMAD proactive usage) are shown immediately — not batched
- BMAD is user-request-only — never invoked proactively by any agent in this team
- trustworthy-sources skill required before citing any external AI engineering standard
- Stop-and-ask rule: if findings are ambiguous or architectural, halt and ask the user before proceeding

## How to Invoke

Tell lead-ai-engineer the mode and scope. Examples:
- "audit team-business commands" → config-auditor in team mode
- "optimize market-researcher.md" → config-auditor first, then prompt-optimizer
- "analyze brainstorm workflow" → workflow-analyst
- "scaffold a new agent for {name}" → provide the spec, framework-builder builds it
- "pre-build gate check" → config-auditor in pre-build mode
