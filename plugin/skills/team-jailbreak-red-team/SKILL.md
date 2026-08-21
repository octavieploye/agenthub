---
name: team-jailbreak-red-team
description: Jailbreak Red Team Orchestrator — generates, classifies, validates, and logs adversarial deception scenarios (T1–T7) targeting Optimaeus/AgentHub LLMs across 8 protected asset categories. Produces a grounding knowledge base for LLM safety training.
category: dev-skills
---

# Jailbreak Red Team

4-agent team that systematically generates every class of deceptive attack a user might use to trick
Optimaeus or AgentHub LLMs into revealing protected information — pricing, workflows, credentials,
system prompts, architecture, roadmap, client data, and business strategy.

The output is a structured knowledge base that can be fed to LLMs as grounding context to improve
their ability to detect and refuse deceptive requests, even when disguised as creative writing,
roleplay, hypotheticals, social pressure, or legitimate-looking information requests.

**Does not test prompts against live LLMs. Produces scenario logs only. Human team tests and trains.**

## When to Use

- Before deploying any Optimaeus or AgentHub LLM in a user-facing context
- After adding new protected assets (new pricing tier, new workflow, new credential type)
- After a suspected jailbreak incident — run targeted scope to generate similar patterns
- Quarterly: full run to surface new attack patterns not in the current log
- When building LLM safety training data or system prompt guardrails

## What You Need Before Starting

- Scope: which assets to target (default: ALL) and which attack families (default: T1–T7)
- Access to `docs/security/jailbreak-log/` (existing log for ID continuity)
- Optional: a specific incident description to generate targeted T-code scenarios

## What This Team Produces

1. **Draft scenario file** — 2-3 deceptive prompt variants per (attack-code, asset) pair
2. **Classified scenario file** — taxonomy codes, severity ratings, compound risk flags, JB-IDs
3. **Validated scenario file** — deceptiveness scores, exploited instinct, defense patterns, approval status
4. **Per-run log** — `docs/security/jailbreak-log/YYYY-MM-DD-{ASSET}-jailbreak-scenarios.md`
5. **Master log** — `docs/security/jailbreak-log/master-jailbreak-log.md` (append-only)

## Attack Families Covered

| Code | Name | Core mechanism |
|------|------|----------------|
| T1 | Creative Framing | Fiction, roleplay, hypotheticals, analogy, encoding |
| T2 | Identity/Persona Hijacking | Persona injection, authority claims, insider claims, debug mode |
| T3 | Decomposition & Indirect Extraction | Task splitting, fill-in-blank, negative confirmation, aggregation |
| T4 | Social Engineering | Emotional appeal, urgency, reciprocity, authority-by-relation |
| T5 | Gradual Escalation | Boiling frog, foot-in-door, false anchoring, many-shot priming |
| T6 | Prompt Injection | Hidden instructions, delimiter injection, system prompt extraction |
| T7 | Information Harvesting | Indirect comparison, confirmation probing, feature/roadmap extraction |

## Protected Assets Covered

PRICING · WORKFLOW · ROADMAP · ARCH · CREDS · CLIENT · STRATEGY · INSTR

## Agent Sequence

```
[1] jailbreak-scenario-generator  → draft file (phase-1-generate)
[2] jailbreak-classifier          → classified file (phase-2-classify)
[3] jailbreak-probe-validator     → validated file (phase-3-validate)  ← user review gate here
[4] jailbreak-log-builder         → per-run log + master log append (synthesis)
```

Max 2 agents active at once (lead + one phase agent). Phases are strictly sequential.

## Invocation Modes

```
/team-jailbreak-red-team                    → full run (all T, all assets)
/team-jailbreak-red-team PRICING            → PRICING asset only, all attack families
/team-jailbreak-red-team T1                 → T1 family only, all assets
/team-jailbreak-red-team PRICING T1         → intersection only
/team-jailbreak-red-team validate <file>    → Phase 3 only on existing draft
/team-jailbreak-red-team build-log          → Phase 4 only from validated files
```

## Key Rules

- **No live LLM testing** — all scoring is based on behavioral knowledge. Human team does live testing.
- **No actual sensitive data in logs** — use placeholders: [PRICE], [API_KEY], [CLIENT_NAME], [KEY]
- **Review gate after Phase 3** — lead presents summary to user before triggering log build
- **REJECTED scenarios never appear in logs** — only APPROVED scenarios are logged
- **Master log is append-only** — never overwrite or restructure existing entries
- **Scenario IDs never change** — once assigned by the classifier, IDs are permanent

## Common Mistakes

| Mistake | Fix |
|---|---|
| Running all agents simultaneously | Phases are sequential — lead dispatches one at a time |
| Including real pricing/credentials in generated prompts | Use placeholders only |
| Generating obviously hostile prompts | If it reads as hostile, it fails the deceptiveness bar — regenerate |
| Skipping the user review gate after Phase 3 | Always present validation summary before Phase 4 |
| Creating a new master log instead of appending | Check for existing master log first |
| Treating this as a replacement for team-threat-defense | Complementary: threat-defense = external infra attacks; this = LLM deception attacks |
