---
name: team-tech-brainstorm
description: Tech-Brainstorm Team Orchestrator — from approved Idea Brief to approved Feature Brief
---

# Team Tech-Brainstorm

## When to Use

Invoke when an approved Idea Brief (from the brainstorm team) has been routed to TECH-BRAINSTORM. This team translates the idea into a technical design, validates it against the existing codebase, and produces a Feature Brief ready for the dev-stack to implement. Do NOT invoke without an approved Idea Brief.

## What You Need Before Starting

- An approved Idea Brief from the brainstorm team (or user-provided equivalent with the same fields)
- Brain team context: lead-brain co-chairs this session and must load relevant ecosystem context first

## What This Team Produces

- 2–3 technical approaches with architecture trade-offs, sovereignty scores, and cascade impact
- Backend feasibility assessment per approach
- Frontend feasibility assessment per approach
- 2–3 UX direction proposals with step count, jargon risk, and non-tech user flags
- Feature Brief: approved technical + UX direction, open questions resolved, ready for dev-stack

## Agent Sequence (mandatory order)

0. **STACK RESEARCH GATE** — mandatory before `feature-architect` begins.

   For every framework, package, or service being considered in any proposed technical approach:
   - **WebSearch current stable version** — `npm view {package} dist-tags` or equivalent. Never use training-data versions.
   - **Check deprecation** — is the package deprecated? Are sub-packages deprecated?
   - **Check peer dependency compatibility** — do all candidate packages declare compatible peer deps with each other?
   - **Check security advisories** — known CRITICAL/HIGH CVEs?
   - **Produce a compatibility matrix** before proposing any architecture:

   ```
   | Package       | Latest Stable | Version Proposed | Compatible With | Status   |
   |---|---|---|---|---|
   | framework X   | x.y.z         | x.y.z            | dep A, dep B    | APPROVED |
   | auth lib      | x.y.z         | x.y.z            | framework X     | APPROVED |
   ```

   **Gate rules:**
   - Deprecated package → STOP. Use the replacement.
   - CRITICAL/HIGH CVE → STOP. Use the patched version.
   - Incompatible peer deps between proposed packages → STOP. Resolve before proposing the approach.
   - More than 1 major version behind latest → justify or upgrade.

   Gate output must appear as `STACK APPROVED` in the Feature Brief header before any technical approach is written.

1. `feature-architect` — produces 2–3 technical approaches from the Idea Brief
2. `sr-backend` + `sr-frontend` — validate feasibility per approach (read-only, run in parallel). `sr-backend` runs **verif-code-gate**: checks whether proposed features/services already exist in the target repo before assessing feasibility. EXISTS findings block the approach from proposing to "build" what already exists.
3. `ux-explorer` — produces 2–3 UX directions based on validated approaches
4. User review — user selects approach + UX direction
5. Lead-tech-brainstorm assembles the Feature Brief from selected directions

Lead-brain loads UNIVERSAL-STANDARDS.md and hephaestus.md before feature-architect begins.

## Key Rules

- No Idea Brief = session blocked — STOP AND ASK the user before proceeding
- sr-backend and sr-frontend are read-only — no code changes in this session
- Exactly 2–3 technical approaches and 2–3 UX directions — same rule as brainstorm team synthesis
- Sovereignty violations in any approach are flagged immediately — not silently passed
- Cross-entity DB access is always flagged as ARCHITECTURE VIOLATION
- Non-tech user flag is mandatory for every UX direction
- trustworthy-sources skill required before citing any external architectural pattern as a standard
- BMAD is user-request-only — never invoked proactively
- Session output (Feature Brief) goes to dev-stack — not directly to implementation without user approval

## How to Invoke

Pass the approved Idea Brief to lead-tech-brainstorm. Lead activates lead-brain as co-chair, runs the agent sequence, and assembles the Feature Brief after the user selects the direction.
