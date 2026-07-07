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
