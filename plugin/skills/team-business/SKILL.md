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
