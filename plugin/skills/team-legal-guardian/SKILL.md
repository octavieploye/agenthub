---
name: team-legal-guardian
description: Legal Guardian Team Orchestrator — 4-phase legal scan, risk classification (CRITICAL to INFO), policy/contract drafting, and adversarial counter-review for litigation triggers across documents, website, payments, affiliates, and creators
category: business-analysis
---

# Legal Guardian Team

Full-stack legal risk review: scans all materials → classifies severity with consequences and insurance mapping → drafts missing policies and contracts → adversarial counter-review extracts litigation triggers and money/asset loss vectors.

## When to Use

- Before launching a website, marketplace, or affiliate program
- After adding revenue streams (payments, subscriptions, creator splits, affiliate commissions)
- When reviewing existing ToS, Privacy Policy, or affiliate agreements for gaps
- Before onboarding creators, affiliates, or enterprise clients
- After a legal incident or near-miss (complaint, GDPR inquiry, dispute, chargeback)
- Periodic compliance review (annually or after major product changes)
- Before fundraising or due diligence where legal clean-up is required

## What You Need Before Starting

- Materials to review: document paths, website URLs, or process descriptions
- Description of payment/revenue flows (subscriptions, marketplace splits, affiliate commissions)
- Description of affiliate, creator, and client relationship structures
- Jurisdiction(s) where the business operates or has users (EU, US, UK, or other)
- Any existing policies, contracts, or terms already in place

## What This Team Produces

| Output | Description |
|---|---|
| `legal-scan-raw.md` | All legal issues found — unsorted, with applicable law and evidence per finding |
| `risk-register.md` | Severity-classified register (CRITICAL/HIGH/MEDIUM/LOW/INFO) with consequences, financial exposure, and insurance mapping |
| `policy-package/` | Drafted policies and contracts covering all CRITICAL and HIGH gaps |
| `counter-risk-report.md` | Adversarial extraction: litigation triggers, lawsuit vectors, money/asset loss scenarios, policy contradictions |
| `legal-guardian-report.md` | Executive summary: overall risk posture, top priority actions, open items for human counsel |

## Agent Sequence

1. **lead-legal-guardian** — Phase 0: intake, confirm materials, jurisdiction, and scope with user
2. **legal-scanner** — Phase 1: full-spectrum scan across 7 legal domains, produce raw findings
3. **risk-assessor** — Phase 2: classify findings, map consequences and insurance gaps
4. **USER APPROVAL GATE** — lead presents Risk Register, waits for user approval before drafting
5. **policy-writer** — Phase 3: draft all CRITICAL and HIGH gap documents
6. **counter-legal-advisor** — Phase 4: adversarial review of all Phase 1-3 outputs
7. **lead-legal-guardian** — synthesize final Legal Guardian Report, present to user

## Key Rules

- Lead never drafts policies — that is policy-writer's role
- Risk-assessor never drafts policies — classification and drafting are separated by design
- Counter-legal-advisor never rewrites policies — it only flags what could cause litigation or loss
- No output constitutes legal advice — all drafts require review by qualified human counsel
- Jurisdiction must be confirmed before Phase 2 — consequences and obligations vary significantly
- User approval is mandatory between Phase 2 and Phase 3 before any contracts are drafted

## Common Mistakes

| Mistake | Fix |
|---|---|
| Skipping Phase 0 intake | Always confirm jurisdiction and scope before scanning — wrong jurisdiction = wrong law |
| Running risk-assessor before scanner completes | Phases are strictly sequential |
| Treating drafted policies as deployment-ready | Every policy-package document needs human legal review before use |
| Letting counter-legal-advisor rewrite policies | It flags only; policy-writer makes changes if needed |
