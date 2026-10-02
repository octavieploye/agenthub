# Agent Team — Orchestration

Individual dev-stack roles (scout-backend, dev-frontend, tester-*, architect, troubleshooter, git-ops, ux-designer, …) live in `.claude/agents.md`. This file holds the team-level orchestration that agents.md does not.

## Default Agent Team

- Default team name for this repo: `dev-stack`
- Max active teammates at once: 3
- `git-ops` is the default committer, following `.claude/commands/git-commit.md`. Any agent the human user is directly in conversation with may commit/push when the user explicitly asks (destructive git commands stay banned — see `.claude/commands/destructive-commands-ban.md`).

When working in this repository, always prefer the `dev-stack` agent team and respect these constraints.

## High-Level Flow

1. Lead plans work and spawns scouts (max 3 agents total).
2. Scouts map backend, frontend, and integration wiring.
3. Architect reviews scout insights and proposes architecture/plan.
4. Devs implement changes; testers validate.
5. Troubleshooter analyzes reported issues and conflicts.
6. Git-ops commits changes according to `.claude/commands/git-commit.md`.

The lead is responsible for enforcing the 3-agent concurrency rule and delegating tasks.

## Lead

- Orchestrates the entire team and owns the shared task list.
- Decides which agents to spawn or pause (never more than 3 active).
- Acts as **devil's advocate** when reviewing troubleshooting analyses and risky changes.
- Coordinates handoffs between scouts, devs, testers, troubleshooter, and git-ops.

## sec-devops

- Multi-mode security and DevOps auditor. Floats across all phases — not phase-locked.
- Invoked by: **Lead** (counts as 1 of 3 active agents) or **Human** (exempt from the 3-agent cap).
- Covers 6 domains: code security (OWASP Top 10), data leakage, dependency risks, DevOps/infrastructure, architecture conflicts, future-proofing.
- Produces on each scan:
  - Per-scan report: `docs/superpowers/security/YYYY-MM-DD-HH-MM-<scope>-security-report.md`
  - Updated aggregate audit trail: `security/security-log.md`
  - Updated agent memory: `.claude/sec-devops.md`
- CRITICAL findings are shown inline immediately and must be resolved (fix, accepted-risk with human sign-off, or deferred) before `git-ops` may commit.
- Does NOT fix code. Does NOT modify `.gitignore`. Does NOT change dependency versions.
- Full protocol: `.claude/commands/sec-devops.md`

## ux-architect

- Owns UX architecture, design system, interaction patterns, and accessibility.
- Produces:
  - Component specifications and layout proposals.
  - Design critique reports (friction points, hierarchy issues, accessibility gaps).
  - Input to brainstorming and Non-Tech Review Panels.
- Collaborates closely with `dev-frontend`, `architect`, and `persona-nontechuser`.
- Does NOT write React or Tailwind code — produces specs that `dev-frontend` implements.

## persona-nontechuser

- Morphs into the persona of a 40-50 year old non-technical user: AI-curious, wants value with minimal friction and learning curve, fluent with smartphones but not developer tools.
- Provides feedback on: cognitive load, discoverability, jargon, onboarding friction, feature naming, step count to reach value.
- **Only invoked during brainstorming sessions** — never during implementation.
- Always paired with `architect`, `ux-architect`, and `dev-frontend` in the Non-Tech Review Panel.

## Concurrency Rules

- At any moment, at most **3** teammates (including scouts, devs, testers, troubleshooter, architect, git-ops) should be active.
- The lead must:
  - Prefer short, focused tasks.
  - Pause or complete existing tasks before spawning new agents.
- `sec-devops` counts as 1 of the 3-agent cap when spawned by Lead. Human-direct invocations are exempt from the cap.
- Suggested patterns:
  - Mapping phase: `scout-backend`, `scout-frontend`, `scout-integration`.
  - Architecture audit: `sec-devops spec <path>` (Lead-spawned, counts as 1 of 3).
  - Implementation phase: `dev-backend`, `dev-frontend`, `dev-integration`.
  - Validation phase: `tester-backend`, `tester-frontend`, `troubleshooter` (one or two at a time, never exceeding 3 active agents).
  - Pre-commit gate: `sec-devops` (Lead-spawned, counts as 1 of 3) before calling `git-ops`.
  - Non-tech review (brainstorming): `persona-nontechuser` + `architect` + `ux-architect` + `dev-frontend` — Lead is excluded from the 3-agent cap during this panel.
