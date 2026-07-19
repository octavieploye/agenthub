---
name: team-production-readiness
description: Production Readiness Team Orchestrator — 6-phase audit covering DB architecture, auth security, infrastructure, payments, scale performance, and migration hygiene. Outputs Production Readiness Report with CRITICAL/HIGH/MEDIUM/LOW findings + P0/P1/P2 remediation plan.
category: security
---

# Production Readiness Team

6-agent team that audits a project from DB schema integrity to live infrastructure readiness. Covers everything between "works with 1 user in dev" and "safe at 10k users with real payments, real SSL, real backups, and visible monitoring".

**Does not fix code. Produces reports and remediation plan only. Human approves all actions.**
**AI must never modify DB schema directly — only via migrations. Direct schema changes are flagged CRITICAL.**

## When to Use

- Before launching to production for the first time
- Before switching payment mode from Stripe test to live
- Before opening to real users at scale
- After major DB schema changes or new auth flows
- When moving from dev to prod environment setup
- Quarterly production health audit

## What You Need Before Starting

- Scope: target repo full path — Repo Gate required before any agent reads a file
- Access to `docs/superpowers/security/security-log.md` (prior open findings)
- Access to `.claire/sec-devops.md` (accepted risks + false positives to skip)
- Tech stack info: DB type (PostgreSQL/SQLite), payment provider, email provider, hosting setup

## What This Team Produces

1. **DB Architecture Report** — schema design, N+1 queries, missing indexes, migration hygiene, data breach risk, scale readiness
2. **Security & Auth Report** — login/password-reset flows, input validation, rate limiting, bot protection, fake account/spam defenses, email verification
3. **Infrastructure & DevOps Report** — SSL/TLS on real domain, dev/prod env separation, API key exposure, DB backup verification, error monitoring coverage
4. **Payment Compliance Report** — test vs. live mode status, Stripe/payment provider config, webhook signing, PCI surface area
5. **Scale & Performance Report** — 1→10k user load simulation, pagination, background task audit, slow synchronous ops in request hot paths
6. **Production Readiness Report** — unified findings table (CRITICAL/HIGH/MEDIUM/LOW), P0/P1/P2 remediation plan

## Step 0 — Repo Gate (mandatory, blocks all other steps)

State the full target path and confirm with the user before dispatching any agent or reading any file. CWD is not confirmation. STOP AND ASK if the target repo is not explicit in the user's message.

## Agent Sequence

```
[1] db-schema-auditor              → DB Architecture Report           (alone — first)
[2] security-hardening-analyst  \  → Security & Auth Report           (parallel — max 2 active)
[2] infra-devops-auditor         /  → Infrastructure & DevOps Report
[3] payment-compliance-analyst  \  → Payment Compliance Report        (parallel — max 2 active)
[3] scale-performance-analyst   /  → Scale & Performance Report       (requires db report from step 1)
[4] lead-production-readiness      → Synthesize → Production Readiness Report
```

Max 3 agents active at once. Lead waits for db-schema-auditor before dispatching scale-performance-analyst.

## Invocation Modes

```
/team-production-readiness               → full audit (all 5 phases)
/team-production-readiness db            → db-schema-auditor only
/team-production-readiness security      → security-hardening-analyst only
/team-production-readiness infra         → infra-devops-auditor only
/team-production-readiness payments      → payment-compliance-analyst only
/team-production-readiness scale         → scale-performance-analyst only
/team-production-readiness report        → synthesis only (requires prior phase outputs)
```

## Key Rules

- **No code fixes** — all agents report only. Devs fix. Human approves CRITICAL items.
- **Migrations only** — any DB schema change must go through migration files. AI direct schema modification = CRITICAL finding.
- **CRITICAL findings shown inline immediately** — do not wait for the full report to surface them.
- **Gate before commit** — no git-ops commit while open CRITICALs exist from this team.
- **Accepted risks require human sign-off** — log to `.claire/sec-devops.md` under Accepted Risks.
- **Complements sec-devops + team-threat-defense** — this team focuses on production-launch readiness; sec-devops covers OWASP + architecture; threat-defense covers live attack surface.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Running all 6 agents simultaneously | Max 3 active — follow the sequence above |
| Suggesting direct DB schema changes | Flag as CRITICAL — always use migrations |
| Skipping db-schema-auditor before scale-performance-analyst | Scale audit needs the DB report to assess index-level risks |
| Testing performance with 1 dev user as the baseline | Simulate 10k concurrent users — test pagination, indexes, connection pool exhaustion |
| Treating Stripe test mode as production-ready | Stripe test keys ≠ production. Verify live key setup + webhook signing + payout routing |
| Assuming SSL works because the browser shows a lock | Verify cert chain, renewal automation, HSTS headers, and mixed content |
| Skipping error monitoring | Unmonitored production errors = invisible incidents — flag missing Sentry/Datadog/similar |
| Not auditing background task queues | Slow ops in request handlers block all users — must be offloaded to async workers |
