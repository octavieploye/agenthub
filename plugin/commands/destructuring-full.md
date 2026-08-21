---
name: 'destructuring-full'
description: 'Run the full destructuring pipeline on a subject: competitor (micro) > business (internal) > market (mid) > dynamics (macro). Chains all four workflows in sequence, passing outputs forward. Does NOT run good-and-bad (requires multiple subjects — use /destructuring-patterns after running /destructuring-full on 2+ subjects).'
---

IT IS CRITICAL THAT YOU FOLLOW THESE INSTRUCTIONS EXACTLY.

STEP 1 — Collect the SUBJECT BRIEF:

```
DESTRUCTURING SUBJECT
=====================
Name:           [product/service/business name]
Description:    [one-sentence description]
Geographic base: [city, country — e.g. "Lyon, FR" or "digital-global"]
Geo radius:     [local | national | continental | worldwide]
Sector:         [industry/niche]
```

STEP 2 — Run /destructuring-competitor with this subject. Store the CompetitorMap.

STEP 3 — Run /destructuring-business with this subject + CompetitorMap from Step 2. Store the BusinessProfile.

STEP 4 — Run /destructuring-market with this subject + CompetitorMap + BusinessProfile. Store the MarketStrategyMap.

STEP 5 — Run /destructuring-dynamics with this subject + all prior outputs. Store the MarketDynamicsMap.

STEP 6 — Produce the FULL PIPELINE RESULT:
Summarize all four outputs. Highlight:
- Top 3 competitors by ring (from competitor-strategies)
- Market position and offer summary (from business-strategies)
- Top entry vector (from market-strategies)
- Strongest force and biggest barrier (from market-dynamics)

Note: To extract patterns, run /destructuring-full on at least one more subject, then run /destructuring-patterns.

## Output Format

### Full Pipeline Result (Step 6)

```
FULL DESTRUCTURING — [Subject Name]
====================================

CROSS-LAYER CONVERGENCE MATRIX
| Finding | Competitor (micro) | Business (internal) | Market (mid) | Dynamics (macro) | Layers confirming |
|---|---|---|---|---|---|
[findings that appear across multiple layers — minimum 3 rows]

Convergence rule: a finding is load-bearing when confirmed across ≥3 of 4 layers.

TOP 3 COMPETITORS BY RING
| # | Competitor | Ring | Key strength | Key vulnerability |
|---|---|---|---|---|
[from CompetitorMap — Ring 1 = direct, Ring 2 = adjacent, Ring 3 = potential]

MARKET POSITION SUMMARY
  Current position:       [leader | challenger | niche | entrant]
  Offer structure:        [one sentence from BusinessProfile]
  Revenue model:          [from BusinessProfile]
  Moat assessment:        [from BusinessProfile — durable / fragile / absent]

TOP ENTRY VECTOR
  Segment:                [from MarketStrategyMap]
  Channel:                [from MarketStrategyMap]
  Why this vector:        [2-3 sentences synthesizing market + dynamics evidence]

FORCE ASSESSMENT
| Force | Direction | Strength (1-5) | Evidence |
|---|---|---|---|
[from MarketDynamicsMap — Porter's forces + macro forces]

STRONGEST FORCE:    [name + why]
BIGGEST BARRIER:    [name + why]

STRATEGIC IMPLICATIONS
  1. [implication derived from cross-layer convergence]
  2. [...]
  3. [...]
```
