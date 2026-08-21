---
name: team-business
description: Business Team Orchestrator — market research, strategy, and competitive intelligence
---

# Team Business

## When to Use

Invoke when the user wants to research a market, validate a business opportunity, analyze competitors, develop GTM strategy, or produce an investment brief. This team runs the FORWARD / REVERSE / LOOP research workflow.

## What You Need Before Starting

- A clear input brief: product or market context, target geography, research objective
- Confirmation that no other business session is in progress for this topic (check memory/index.md via data team first if context is unclear)

## What This Team Produces

**FORWARD mode (F1→F5):** Market research brief → Competitive analysis → Strategy options → Positioning → Investment brief
**REVERSE mode (R1→R5):** Performance audit → Channel analysis → Competitive repositioning → Messaging audit → Research refresh
**LOOP mode:** Continuous monitoring — defined triggers, not time-based

## Agent Sequence

1. `market-researcher` — landscape, TAM/SAM/SOM, competitor map
2. `business-analyst` — metrics validation, CS scoring, DRL protocol
3. `strategist` — GTM options, moats, assumption stress-test
4. `positioning-expert` — differentiation, ICP narrative, messaging architecture
5. `investment-curator` — ROI structure, opportunity brief (if applicable)
6. `ceo-advisor` — final review (last, only for external-facing deliverables)

Max 3 agents active at once. Lead orchestrates sequencing.

## Key Rules

- Every factual market claim must pass the `trustworthy-sources` skill before inclusion
- DRL protocol: missing data becomes a DRL item — never filled with assumption
- Non-assumption rule: when two data sources conflict, log both — never average
- BMAD is user-request-only — never invoked proactively
- After session completes, route output to data team for archiving

## How to Invoke

Tell lead-business the mode (FORWARD/REVERSE/LOOP) and the input brief. Lead spawns agents in sequence, enforces the 3-agent cap, and delivers the session synthesis to lead-data for deposit.

## Output Format

Every session produces a structured deliverable. Format varies by mode.

### FORWARD Mode — Final Deliverable

```
EXECUTIVE SUMMARY
=================
Opportunity:      [one sentence]
Confidence:       [HIGH | MEDIUM | LOW] — based on source convergence
Key risk:         [one sentence]
Recommendation:   [one sentence]

F1 — MARKET LANDSCAPE
  TAM / SAM / SOM:       [figures with source + year]
  Growth rate:            [CAGR% with source]
  Market stage:           [emerging | growing | mature | declining]
  Regulatory signals:     [list]

F2 — COMPETITIVE MAP
  | Competitor | Ring | Strengths | Weaknesses | Threat level |
  |---|---|---|---|---|
  [6+ rows minimum]

  Ring definitions: Ring 1 = direct substitute, Ring 2 = adjacent, Ring 3 = potential entrant

F3 — STRATEGY OPTIONS
  | Option | CPM score | Pros | Cons | Assumption risk |
  |---|---|---|---|---|
  [3+ options minimum]

  CPM = Confidence × Payoff × Maneuverability (each 1-5, product = score)

F4 — POSITIONING
  ICP narrative:          [2-3 sentences, buyer's language]
  Differentiation axis:   [what you do that competitors structurally cannot]
  Messaging architecture: [headline → subhead → proof points]

F5 — INVESTMENT BRIEF (if applicable)
  Unit economics:         [CAC, LTV, payback period]
  ROI structure:          [scenario table: pessimistic / base / optimistic]
  Capital requirement:    [amount + runway]

ATTRIBUTION
  [Every factual claim must cite: source name, date, URL or DOI]
  [DRL items listed separately with reason for missing data]
```

### REVERSE Mode — Final Deliverable

Same structure as FORWARD but sections are: R1 Performance Audit, R2 Channel Analysis, R3 Competitive Repositioning, R4 Messaging Audit, R5 Research Refresh.

### Scoring

- CPM scoring (Confidence × Payoff × Maneuverability, each 1-5) required for every strategy option
- CS (Confidence Score) required for every data point — scale: 0.0-1.0 with source count
- DRL (Data Request List) — every missing data point logged, never filled with assumption
