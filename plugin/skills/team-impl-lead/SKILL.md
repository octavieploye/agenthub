---
name: team-impl-lead
description: Implementation Lead Team Orchestrator — full project audit from scratch: stack, architecture, product, content, legal, policies, processes. Produces discovery report + implementation plan + conformance check.
category: dev-skills
---

# Team Implementation Lead

Full project audit from scratch. Invoke when starting a new project or when you need to understand the current state of an existing project and produce an implementation plan that checks what exists, what is missing, and what needs to be built.

## When to Use

- Starting a new project (Opeidos, a new feature set, a new Optimaeus entity)
- Returning to a project after a gap — need to re-orient and verify conformance
- A project has many moving parts (onboarding, architecture, content, legal) and you need a unified plan
- You want to know: "what exists vs. what's missing vs. what needs to be built?"
- You suspect gaps in architecture, legal coverage, UX flows, or documentation

## What You Need Before Starting

- Project name or identifier
- Root directory or repo path (impl-lead will ask if not provided)
- Any existing spec, brief, or feature list (optional — scouts will discover independently)
- Scope: full audit (default) or specific dimensions (stack only / product only / content only)

## What This Team Produces

- `docs/impl-lead/{project-slug}/01-discovery-report.md` — everything found, organized by dimension
- `docs/impl-lead/{project-slug}/02-implementation-plan.md` — what needs to be built, prioritized P0/P1/P2
- `docs/impl-lead/{project-slug}/03-conformance-check.md` — what matches plan vs. what is missing or misaligned
- `docs/impl-lead/{project-slug}/04-open-questions.md` — questions for the user + suggestions discovered during audit

## Agent Sequence

0. **impl-lead** — Phase 0: STACK RESEARCH GATE (mandatory before any scout work begins).
   See full protocol below.

1. **impl-lead** — Phase 1: intake. Asks user for project scope, path, any existing specs. Decides which scouts to activate.
2. **impl-scout-stack** — Phase 2a (parallel): maps architecture, tech stack, DB schema, migrations, services, workflows, infra, .claude/ config. Produces `stack-map.md`.
3. **impl-scout-product** — Phase 2b (parallel): maps features, views, pages, UX flows, onboarding, detectors, AI models, component tree. Produces `product-map.md`.
4. **impl-scout-content** — Phase 2c (parallel): maps content, copy, legal docs, policies, compliance, processes, documentation. Produces `content-map.md`.
5. **impl-lead** — Phase 3: reviews all scout maps, flags contradictions or missing sections, asks user if anything is unexpected.
6. **impl-planner** — Phase 4: synthesizes stack-map + product-map + content-map into implementation plan + conformance check.
7. **impl-lead** — Phase 5: reviews planner output, adds open questions and suggestions, presents everything to user for approval, writes files only after confirmation.

## Phase 0 — STACK RESEARCH GATE

**This gate runs before Phase 1 intake. It cannot be skipped. No implementation plan, no scout work, no file writing starts until the gate is APPROVED.**

For every package, framework, and service in the proposed tech stack:

1. **WebSearch current stable version** — `npm view {package} dist-tags` or equivalent. Never assume a version from training data.
2. **Check deprecation** — is the package itself deprecated? Are any of its sub-packages deprecated? (`npm view {package}` shows deprecation notices)
3. **Check peer dependencies** — do all packages in the stack declare compatible peer deps with each other? (`npm view {package}@{version} peerDependencies`)
4. **Check security advisories** — `npm audit` equivalent or GitHub Advisories search for known CVEs
5. **Confirm compatibility matrix** — produce a table:

```
| Package         | Latest Stable | Version Chosen | Compatible With | Status |
|---|---|---|---|---|
| next            | x.y.z         | x.y.z          | react@18, clerk | APPROVED |
| @clerk/nextjs   | x.y.z         | x.y.z          | next@15.x       | APPROVED |
| ...             | ...           | ...            | ...             | ...     |
```

**Gate rules:**
- If ANY package is deprecated → STOP. Identify the replacement. Use the replacement.
- If ANY package has a known CRITICAL/HIGH CVE → STOP. Identify the patched version. Use it.
- If ANY two packages have incompatible peer deps → STOP. Resolve before proceeding.
- If latest major version is more than 1 major behind → STOP. Justify staying on older major or upgrade.

**Output:** A signed-off `STACK APPROVED` block in the discovery report before any other section.

Only after the user acknowledges the stack approval does Phase 1 begin.

---

## Key Rules

- impl-lead always runs Phase 1 first — never skip user intake
- All 3 scouts run in parallel during Phase 2 (3 active agents, within the 3-agent cap)
- impl-planner does NOT run until all 3 scout maps are complete
- This team is read-only during discovery — no file changes, no commits during Phases 1-4
- All outputs shown to user for review before any files are written to disk
- STOP AND ASK if: project path is ambiguous, a spec contradicts the code, scope is unclear, or scouts return contradictory findings

## How to Invoke

Tell impl-lead the project name and any context. Examples:
- "audit opeidos from scratch" → full audit, impl-lead asks for path + scope
- "map the stack for the new marketplace" → impl-scout-stack only, impl-lead coordinates
- "check if our onboarding matches the spec" → impl-scout-product + impl-planner conformance mode
- "what needs to be built for [project-name]" → full audit → implementation plan
- "we're starting fresh on [project] — what do we have and what's missing?" → full audit
