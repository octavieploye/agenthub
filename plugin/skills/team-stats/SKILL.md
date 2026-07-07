---
name: team-stats
description: Stats Team Orchestrator — statistical analysis, risk modeling, market research, and decision support
---

# Team Stats

## When to Use

Invoke when the user needs quantitative market data gathered and validated, statistical modeling with confidence scores, risk scenario construction, behavioral economics analysis, or a structured decision frame built from validated data. This team operates on external reference data only — never on the user's own business metrics unless explicitly provided.

## What You Need Before Starting

- A data brief: what market or domain, what quantitative metrics are needed, what decision context
- For decision-modeler: outputs from quant-analyst and risk-modeler (both required)

## What This Team Produces

- Quantitative market data with trust tiers T0–T5, CS scores 0–100, and mandatory uncertainty ranges
- 3-scenario risk matrix (base / downside / tail) with probability estimates and stress-test triggers
- Behavioral pattern map from research literature (documented patterns only, cited sources)
- Structured decision frame: scenario table, trade-offs, data confidence summary, decision trigger conditions

## Agent Sequence (select per scope)

1. `market-stats-researcher` — gather external market data with citations and trust tier ratings
2. `quant-analyst` — validate, score (CS 0–100), and add uncertainty ranges to all metrics
3. `risk-modeler` — build 3-scenario risk matrix from validated data
4. `behavioral-analyst` — map buyer psychology patterns from research literature
5. `decision-modeler` — synthesize all above into a structured decision frame (runs last)

Not all agents are required for every session — tell lead-stats which outputs you need.

## Key Rules

- Every numeric claim must carry a CS score + uncertainty range — no bare point estimates
- T4/T5 sources are flagged explicitly — never presented at T0–T2 weight
- Contradictions between sources are logged verbatim — never averaged or resolved silently
- Scope rule: external reference data only — never analyze the user's own business metrics without explicit instruction
- trustworthy-sources skill required before citing any source as evidence
- decision-modeler never recommends a decision — presents trade-offs only
- BMAD is user-request-only — never invoked proactively

## How to Invoke

Tell lead-stats what you need: data gathering, validation, risk modeling, behavioral analysis, or a full decision package. Lead-stats sequences the relevant agents and assembles the output package.
