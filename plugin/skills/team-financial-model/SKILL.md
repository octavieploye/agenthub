---
name: team-financial-model
description: Business Financial Model Builder — 12-month revenue model, break-even analysis, and 3-scenario forecast from your pricing, conversion, and cost inputs
category: business-intelligence
---

# Team Financial Model

3-phase team that turns your pricing, conversion assumptions, and cost structure into a 12-month financial model. Produces a revenue forecast across three scenarios (conservative / base / aggressive), a break-even analysis, and a plain-English narrative that any investor, banker, or advisor can read. No spreadsheet experience required — you answer questions, the team builds the numbers.

## When to Use

- You are preparing for a bank meeting, investor conversation, or grant application and need a financial model
- You want to know how many customers you need to break even or reach a specific revenue target
- You are setting a revenue goal for the year and need to back into the activities required
- You are raising prices or launching a new offer tier and want to model the impact
- Use AFTER `team-pricing-strategy` if pricing is not yet confirmed

## What You Need Before Starting

- Your price (or price tiers if you have multiple offers)
- Your estimated conversion rate (even a rough guess — "about 1 in 10 proposals closes")
- Your monthly fixed costs (rent, tools, salaries, subscriptions — rough total is fine)
- Your monthly variable costs per client or sale (if any)
- Your current monthly revenue or customer count (even 0)

## What This Team Produces

1. **Assumptions Sheet** — all inputs documented and validated: price, conversion rate, cost structure, growth rate assumptions, seasonality flags. User-confirmed before any modeling begins.
2. **12-Month Revenue Model** — month-by-month forecast across 3 scenarios (conservative / base / aggressive): revenue, costs, gross margin, net margin, and cumulative cash position
3. **Break-Even Report** — the exact customer count and revenue level at which the business covers its costs, with a timeline estimate for reaching break-even under each scenario
4. **Executive Narrative** — a plain-English 1-page summary of the model: key assumptions, what the numbers say, what has to go right for the base case, and what the biggest risk to the aggressive case is

## Agent Sequence

1. `business-analyst` — Phase 1: structured intake of all financial inputs, documents the Assumptions Sheet, flags any inputs that are missing or unrealistic (user confirmation required before Phase 2)
2. `quant-analyst` — Phase 2: builds the 12-month model and break-even analysis from the confirmed Assumptions Sheet. Runs 3 scenarios with sensitivity notes.
3. `decision-modeler` — Phase 3: synthesizes Phase 2 output into the Executive Narrative — plain-English, no jargon, structured for a non-finance reader (blocked until Phase 2 delivers)

Max 2 agents active at once. Phase 2 is blocked until user confirms the Assumptions Sheet.

## Key Rules

- Phase 1 requires explicit user confirmation on all inputs before any modeling begins — a financial model is only as good as its assumptions
- All assumptions must be documented with their source (user-provided, industry benchmark, or flagged as estimated)
- If an assumption is missing and cannot be estimated with confidence, block and ask — never invent a number
- Scenarios must be genuinely distinct: conservative assumes something goes wrong, aggressive assumes something goes right. Do not present three versions of the same number.
- Break-even must account for both fixed and variable costs — contribution margin must be explicitly stated
- Executive Narrative must name the single biggest risk to the model — honest models are more useful than optimistic ones
- If the model shows the business cannot break even at current pricing or volume assumptions, flag it clearly — this is the most valuable output the team can produce

## How to Invoke

Tell lead-financial-model what you are modeling and pass your pricing, cost structure, and any conversion estimates you have. Rough numbers are fine — Phase 1 will structure and validate them before any modeling begins.
