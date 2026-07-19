---
name: team-backend-hardening
description: Backend Hardening Meta-Orchestrator — sequences 5 audit phases (code quality → production readiness → OWASP → external threats → insider threats), each followed by a dev-loop fix cycle and architect+sr-backend validation gate. Proceeds to next phase only after 100% human approval. Outputs Production-Ready Clearance Report.
category: security
---

# Backend Hardening Meta-Orchestrator

5-phase sequential hardening pipeline. Each phase audits, then fixes, then validates before unlocking the next. No phase can start until the previous phase gate is 100% closed by a human.

**This is a meta-orchestrator — it delegates to sub-teams. It does not audit or fix code itself.**
**Every gate requires explicit human approval. Phases never auto-advance.**

## When to Use

- Before the first production launch
- Before opening to real users at scale
- After a major architectural change affecting the backend
- As a quarterly hardening sprint
- When you want end-to-end backend confidence: code quality → security → performance → threats → IP

## What This Orchestrates

| Phase | Audit Team | What It Covers |
|---|---|---|
| 1 | `full-code-review` | Code quality, bugs, test coverage, architecture |
| 2 | `team-production-readiness` | DB, auth, infra, payments, scale (0→10k) |
| 3 | `sec-devops` | OWASP Top 10, dependency CVEs, security architecture |
| 4 | `team-threat-defense` | External threats, attack surface, secrets, injection |
| 5 | `sec-insider-threat` | Insider threats, IP exfiltration, AI prompt injection |

## Per-Phase Cycle (identical structure for all 5 phases)

```
[AUDIT]    Sub-team audits the codebase → findings report (CRITICAL/HIGH/MEDIUM/LOW)
[TRIAGE]   Lead classifies: CRITICAL+HIGH → fix queue. MEDIUM/LOW → roadmap doc (non-blocking).
[FIX]      team-dev-loop dispatched with fix queue → iterates fix→test until passing (max 5 rounds)
[VALIDATE] architect + sr-backend review diff in parallel → both must approve or loop back
[GATE]     Human confirms: "Phase N complete, proceed to Phase N+1?" — mandatory, no auto-advance
```

## Fix Cycle Rules

- `team-dev-loop` handles all fix iteration
- `dev-backend` + `dev-integration` implement. `tester-backend` validates tests still pass.
- Max 5 dev-loop iterations per phase (configurable)
- **Stall protocol**: if dev-loop fails on the same item 3 times → stop, escalate to human. Options: new strategy | accepted-risk (human sign-off) | defer to roadmap. Never retry the same approach a 4th time.
- **MEDIUM/LOW do not block the gate** — collected into roadmap doc, presented at final clearance

## Validator Pair

After each dev-loop fix cycle, `architect` + `sr-backend` review in parallel (2 active):

| Validator | Checks |
|---|---|
| `architect` | Are fixes architecturally sound? New coupling or tech debt introduced? |
| `sr-backend` | Are fixes correct and complete? Does the fix close the finding or paper over it? |

**Both must approve** before the human gate is presented. If either rejects: return to dev-loop with rejection feedback.

## Human Gate Protocol

After both validators approve, lead presents to human:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE N GATE — [Phase Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Findings:     X critical · X high (ALL FIXED) · X medium · X low (roadmap)
Dev-loop:     X iterations · X files changed
Architect:    ✓ approved
sr-backend:   ✓ approved

Proceed to Phase N+1: [Next Phase Name]? (yes / no / pause)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Human says "yes" → next phase begins.
Human says "no" → re-audit current phase from scratch.
Human says "pause" → pipeline suspended, resumable via `/lead-backend-hardening from-phase-N`.

## Invocation Modes

```
/team-backend-hardening                   → full 5-phase pipeline
/team-backend-hardening phase-1           → Phase 1 only (code review)
/team-backend-hardening phase-2           → Phase 2 only (production readiness)
/team-backend-hardening phase-3           → Phase 3 only (OWASP security)
/team-backend-hardening phase-4           → Phase 4 only (threat defense)
/team-backend-hardening phase-5           → Phase 5 only (insider threat)
/team-backend-hardening from-phase-N      → resume from Phase N (prior phases assumed complete)
```

## Concurrency Rules

- **ONE phase active at a time** — sequential, never parallel phases
- Within each phase: max 3 agents active at once (dev-stack rules)
- `architect` + `sr-backend` always run in parallel during validate step (2 active — allowed)
- `team-dev-loop` runs alone during fix cycles

## Output

**Per phase:** findings report + fix diff + validator sign-off (written to `docs/superpowers/security/`)
**Final clearance report:** `docs/superpowers/security/YYYY-MM-DD-HH-MM-full-backend-hardening-report.md`

Final report contains:
- Phase-by-phase finding count table
- All MEDIUM/LOW roadmap items (from all 5 phases)
- Dev-loop fix summary (total iterations, files changed)
- Validator sign-offs per phase
- **Final clearance statement:** "Backend hardening complete. All CRITICAL and HIGH findings resolved. Backend is production-ready."

## Common Mistakes

| Mistake | Fix |
|---|---|
| Running phases in parallel to save time | Sequential only — Phase 2 may find issues introduced by Phase 1 fixes |
| Auto-advancing past human gate | Never. Human must explicitly confirm every gate. |
| Fixing MEDIUM/LOW during phase gates | CRITICAL+HIGH only per gate. MEDIUM/LOW go to roadmap. |
| Proceeding with only one validator's sign-off | Both architect AND sr-backend must approve |
| Starting without a passing test suite | Pre-flight check: tests must exist and pass before Phase 1 |
| Re-running dev-loop 4+ times on the same stalled item | After 3 fails: escalate to human, change strategy |
| Treating secrets rotation as a code fix (Phase 4) | Rotation is a human action — present rotation protocol separately |
