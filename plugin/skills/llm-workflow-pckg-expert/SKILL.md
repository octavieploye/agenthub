---
name: llm-workflow-pckg-expert
description: LLM workflow packages expert — audits current package state, distribution gaps, and Opeidos readiness. Covers all packages in agenthub/packages/ and optimaeus-architecture/shared/.
category: intelligence
---

# LLM Workflow Package Expert

On-demand status snapshot of all LLM workflow packages — what exists, what is built, what is missing, and what is needed before any package can be distributed on Opeidos.

## When to Use

- "What is the status of the LLM workflow packages?"
- "Which packages are distributable?"
- "What do we need to publish packages on Opeidos?"
- "What is the state of the destructuring / deep-reasoning / market-modeling package?"
- Any question about package architecture, licensing, or distribution

## What You Need Before Starting

Read from:
- `agenthub/packages/` — all package directories
- `optimaeus-architecture/shared/` — infrastructure packages
- `agenthub/docs/superpowers/plans/2026-07-03-*.md` — package plans
- `agenthub/docs/superpowers/specs/2026-07-04-package-architecture-design.md` — architecture spec

## Known Baseline (as of 2026-07-13 — verify before citing)

### Package Inventory

| Package | Location | State | Dist built? | Opeidos ready? |
|---|---|---|---|---|
| `@optimaeus/destructuring` | agenthub/packages/destructuring/ | src/ COMPLETE, 50+ files | NO (dist/ missing) | NO |
| token-optimizer | agenthub/packages/token-optimizer/ | Shell script, working | N/A | PARTIAL |
| package-factory | agenthub/packages/package-factory/ | Scaffolding only | N/A | NO |
| package-ts-factory | agenthub/packages/package-ts-factory/ | Scaffolding only | N/A | NO |
| market-modeling | agenthub/packages/market-modeling/ | Workflow, working | N/A | PARTIAL |
| market-sim-pkg | agenthub/packages/market-sim-pkg/ | Planning docs only | N/A | NO |
| optimaeus-llm-ts | optimaeus-architecture/shared/optimaeus-llm-ts/ | Built, dist/ COMPILED | YES | NO (not published) |
| optimaeus-llm-py | optimaeus-architecture/shared/optimaeus-llm-py/ | Built, source ready | N/A | NO (not published) |
| anamnesis-client-ts | optimaeus-architecture/shared/anamnesis-client-ts/ | Scaffolding only | NO | NO (Anamnesis backend missing) |
| anamnesis-client-py | optimaeus-architecture/shared/anamnesis-client-py/ | Scaffolding only | NO | NO (Anamnesis backend missing) |
| learning-schema | optimaeus-architecture/shared/learning-schema/ | SQL reference only | N/A | N/A |
| skill-schema | optimaeus-architecture/shared/skill-schema/ | SQL reference only | N/A | N/A |

### Architecture Spec (2026-07-04 — PENDING APPROVAL)
- Single monorepo: `llm-workflows-pckg` (not yet created)
- 29 packages total: 14 TS + 15 Py
- Infrastructure (MIT): 13 packages
- Commercial (Proprietary): 16 packages
- Dual contracts: 4 packages (llm-router, learning, sovereignty, audit)
- Anti-piracy: compiled + JWT license keys + machine fingerprint + periodic validation

### Opeidos Distribution Blockers
1. No npm organization (`@optimaeus` scope declared but org not created)
2. No obfuscation/compilation pipeline for commercial packages
3. No license key validation system (JWT + machine fingerprint + Stripe webhooks)
4. No `llm-workflows-pckg` monorepo created
5. Destructuring dist/ not built — `npm run build` never run
6. Deep-reasoning not scaffolded (path: llm-workflows-pckg/packages/deep-reasoning/ does not exist)
7. Anamnesis clients depend on non-existent Anamnesis backend

### Installer Mechanism — Current vs Needed
| Current | Proposed (2026-07-04 spec) |
|---|---|
| `file:` symlink in package.json | Published npm packages |
| `pip install -e /path` | Published PyPI packages |
| `add-to-project.sh` (rsync) | Opeidos storefront checkout + license key |
| `install.sh` (copies to .claude/) | JWT-signed keys + machine fingerprint |

## Workflow

1. Glob `agenthub/packages/*/package.json` — list all packages and their version/license fields
2. Check `dist/` directory exists for each TS package
3. Check `optimaeus-architecture/shared/optimaeus-llm-ts/dist/` — confirm compiled
4. Read `docs/superpowers/specs/2026-07-04-package-architecture-design.md` — spec approval status
5. Read plan files: 2026-07-03-destructuring-package.md, 2026-07-03-deep-reasoning-package.md
6. Output structured report per package + distribution gap analysis

## Output

- Table: all packages with state / dist-built / Opeidos-ready
- Table: distribution blockers ordered by dependency
- Recommended build sequence to reach first distributable package
- Architecture spec approval status

## Constraints

- Do not assume a package is distributable without verifying dist/ exists
- `UNLICENSED` in package.json is a commercial distribution blocker — always flag it
- Anamnesis clients cannot ship before Anamnesis backend exists — never omit this dependency
- Do not conflate "npm installed" with "npm published"
- Do not propose solutions — report state only. Recommendations go to ecosystem-orchestrator.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Saying destructuring is "complete" | src/ is complete. dist/ is NOT built. Not distributable. |
| Ignoring the monorepo migration requirement | The 2026-07-04 spec requires llm-workflows-pckg — this must be created before Opeidos listing |
| Treating token-optimizer as npm-publishable | It is a shell script package. Needs wrapper for npm distribution. |
