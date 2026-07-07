---
name: team-marketing
description: Marketing Team Orchestrator — persona, channel strategy, messaging, and campaign planning
---

# Team Marketing

## When to Use

Invoke when the user wants to build a persona, design a channel strategy, create a message framework, plan a campaign, or validate market readiness before launch. Requires prior business team output (FORWARD session) as input — do NOT invoke without it.

## What You Need Before Starting

- FORWARD session output from the business team (or lead-business confirmation it is available in memory)
- A product or offer to market (not a hypothesis — must have business-team-validated positioning)
- V0 pre-validation gate status: NOT started / PASSED / FAILED

## What This Team Produces

**Pre-launch:** V0 gate pass/fail → Persona brief → Channel strategy → Message framework → Content calendar → Campaign brief
**Post-launch (REVERSE):** Performance audit → Attribution analysis → Self-improving ad loop report

## Agent Sequence

1. `readiness-analyst` — V0 3-filter gate (category heat, blue ocean gap, virality). Blocks M1 until 50+ email signups if any filter fails.
2. `persona-profiler` — deep buyer mapping with DRL protocol for missing attributes
3. `competitive-intel-marketing` — competitor channels, messaging, ad audit
4. `channel-strategist` — channel selection grounded in persona data
5. `message-architect` — core message framework (no copywriting)
6. `content-creator` — campaign structure, content calendar, creative briefs (blocked until message-architect + channel-strategist deliver)
7. `campaign-analyst` — KPI definition, attribution model, self-improving ad loop

Max 3 agents active at once. Lead orchestrates sequencing.

## Key Rules

- V0 gate must run first — no marketing work proceeds if the market signal is absent
- DRL protocol: every persona attribute without a source becomes a DRL item — never assumed
- trustworthy-sources skill required before citing any market data
- Verbatim ICP language from persona-profiler only — never invent buyer language
- BMAD is user-request-only — never invoked proactively
- After session completes, route output to data team for archiving

## How to Invoke

Tell lead-marketing the mode (pre-launch or REVERSE) and pass the business team output. Lead runs the V0 gate first, then sequences remaining agents.
