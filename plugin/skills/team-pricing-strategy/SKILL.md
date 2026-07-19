---
name: team-pricing-strategy
description: Pricing Strategy Team — researches comparable products, models price sensitivity, and produces a recommended pricing ladder with rationale
category: business-intelligence
---

# Team Pricing Strategy

4-phase team that turns an existing product or service into a defensible pricing structure. Researches what comparable products charge, maps buyer willingness-to-pay by segment, models revenue at different price points, and delivers a pricing ladder with a justified recommendation. Never guesses — every input is sourced.

## When to Use

- You have a product or service and do not know what to charge
- You are repositioning an existing offer and need to validate a price change
- You want to know if your current price is leaving money on the table
- You need to build a tiered pricing structure (Starter / Professional / Advanced)
- Use AFTER `team-business` or `team-offer-packaging` if positioning is not yet confirmed

## What You Need Before Starting

- Product or service description (what it does, who it serves, what outcome it delivers)
- Current price (if any) or target price range (even a rough one)
- Optionally: competitor names or comparable products you are aware of

## What This Team Produces

1. **Comparable Pricing Map** — 5–10 reference products with their pricing structures, feature tiers, and positioning notes
2. **Willingness-to-Pay Analysis** — price sensitivity by buyer segment, anchoring benchmarks, psychological price thresholds
3. **Revenue Scenario Model** — 3 scenarios (conservative / base / aggressive) at 3 candidate price points
4. **Pricing Ladder Recommendation** — recommended price per tier (Starter / Professional / Advanced), rationale, and one-paragraph justification the user can share with stakeholders

## Agent Sequence

1. `market-researcher` — Phase 1: finds 5–10 comparable products, extracts pricing structures, documents tier features and positioning
2. `behavioral-analyst` — Phase 2: buyer psychology, anchoring effects, price sensitivity by segment, psychological thresholds (€9/€19/€49/€99/€199/€499 bands)
3. `quant-analyst` — Phase 3: revenue scenarios at 3 candidate price points × 3 volume assumptions (blocked until Phase 2 delivers)
4. `decision-modeler` — Phase 4: synthesizes Phases 1–3 into a pricing ladder with confidence-scored recommendation

Max 3 agents active at once. Phase 3 is blocked until behavioral-analyst delivers.

## Key Rules

- All comparable products must come from real sources — never invented examples
- Price recommendations must be grounded in the revenue model, not intuition
- If comparable products are absent (genuinely novel category), flag this explicitly — do not fabricate benchmarks
- Willingness-to-pay analysis must name the buyer segment — "buyers" is not a segment
- trustworthy-sources skill required before citing any pricing data
- If the current price is already optimal, say so — this team does not always recommend changing the price

## How to Invoke

Tell lead-pricing-strategy what you are pricing and who buys it. Pass any competitor names you know. Lead will run Phase 1 first and present the Comparable Pricing Map for user review before proceeding to modeling.
