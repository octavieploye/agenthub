---
name: team-onboarding-engine
description: Onboarding Engine Team Orchestrator — Apple-style onboarding for marketplace clients, affiliates, and creators: experience architecture, Stripe Connect deferred payments, automation triggers, and risk assessment. Outputs a full Onboarding Playbook.
category: business-venture
---

# Onboarding Engine Team

Design and implement zero-friction, Apple-quality onboarding for any marketplace persona: high-ticket clients, commission affiliates, or creators/sellers. Covers the full stack — UX journey, payment flow, automation triggers, risk assessment, and copy — and synthesizes everything into one Onboarding Playbook.

## When to Use

- Building or redesigning onboarding for a marketplace, agency, or platform
- Reducing churn at the signup or payment step
- Needing to automate 90% of the onboarding process
- Designing a Stripe Connect payment flow with minimal friction
- Creating onboarding for multiple persona types (clients + affiliates + creators)
- Assessing chargeback, refund, or fraud risk in an existing onboarding process

## What You Need Before Starting

- Persona type(s) in scope: client / affiliate / creator (one or all three)
- Platform type: marketplace, agency/coaching, SaaS, or hybrid
- Current tech stack (or intent): Stripe, GoHighLevel, Notion, WhatsApp, n8n, Make.com
- What already exists (if anything): existing flow to audit, or blank canvas
- Any known pain points (high churn step, manual bottleneck, disputed charges)

## What This Team Produces

1. **Journey Map** — per-persona emotional arc with friction flags and wow-moment opportunities
2. **Payment Flow Spec** — Stripe Connect deferred account architecture, KYC gates, payout timelines
3. **Automation Blueprint** — trigger map, CRM sequence architecture, webhook event list, tech stack recommendation
4. **Risk Report** — fraud scoring matrix, chargeback prevention, refund policy, affiliate/creator risk gates
5. **Full Copy Pack** — per-persona welcome emails, group chat scripts, form copy, dashboard naming
6. **Onboarding Playbook** — unified synthesis document ready for implementation handoff

## Agent Sequence (5 Phases + Synthesis)

**Phase 0 (Lead alone):** intake — persona type, platform type, tech stack, scope

**Phase 1 (Lead + experience-architect + payment-flow-designer):**
- experience-architect: Journey Map + Friction Report per persona
- payment-flow-designer: Payment Flow Spec (Stripe deferred + KYC + payout + chargeback windows)

**Phase 2 (Lead + automation-blueprint + onboarding-risk-analyst):**
- automation-blueprint: Automation Blueprint (trigger map, webhook logic, CRM sequences)
- onboarding-risk-analyst: Risk Report (fraud scoring, chargeback prevention, refund policy)

**Phase 3 (Lead + onboarding-copywriter):**
- onboarding-copywriter: Full Copy Pack (emails, group chat, in-product copy, form copy)

**Phase 4 (Lead):** synthesis → Onboarding Playbook → user approval gate

## Key Rules

- Never skip Phase 0 intake — persona type determines every downstream decision
- Maximum 3 agents active at once (lead counts as 1)
- Never ask for banking/identity details at signup — always deferred to the withdrawal gate
- Automation blueprint must be checked against risk gates before finalizing
- User approves after intake and before final playbook is written
- If legal policy language is needed (refund policy, affiliate ToS clauses), escalate to team-legal-guardian

## Common Mistakes

| Mistake | Fix |
|---|---|
| Sending sellers to Stripe KYC at signup | Use deferred account — KYC at withdrawal gate only |
| Treating clients and creators the same | Separate journey maps — emotional needs are completely different |
| Automating everything including first payout | First affiliate payout requires manual human review |
| Copy that sounds like a template | Use merge fields, reference their product/goal/niche |
| Building automation before risk gates | Always design risk gates first, then wrap automation around them |
