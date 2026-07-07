# CONFIDENCE SCORING

## Base Score by Tier
Tier 0 (private intelligence):   85
Tier 1 (hard evidence):          90
Tier 2 (verified publication):   70
Tier 3 (expert opinion):         50
Tier 4 (community signal):       gates_passed x 10  (max 50)
Tier 5 (raw social):             gates_passed x 6   (max 30)

## Modifiers (apply after base score)
+15  Corroborated by LOOP mode — forward and reverse agree on this finding
+10  Corroborated by a different tier
+10  Source has a verified historical accuracy track record
+5   Signal matches a confirmed pattern found in another layer
-10  Single source only — no corroboration available
-15  Contradicted by another signal (also create CSL item)
-20  Source has shown prior inaccuracy in this domain
-25  Signal is more than 50% past its decay window (see signal-tiers for decay rates)

Score floor: 0. Score ceiling: 100.

## Thresholds
>= 60   Use as primary evidence. Cite directly in output.
35-59   Use as supporting context only. Label: "Supporting (CS: [score])"
< 35    Watchlist only. Never cite in output. Never use as evidence.

## Usage Rules
Every key finding in every layer output must show its CS.
Format: CS: [score]
Example: "Sector growing 15% YoY (Euromonitor 2025) CS: 70"

A finding with CS < 60 used as primary evidence = automatic CSL item.
A synthesis conclusion built on a finding with CS < 50 = automatic CSL item.

## Community Gate Reference (for Tier 4 base score)
Gate 1 — Specificity:       names a specific product, company, or process
Gate 2 — Reproducibility:   same complaint in 3+ independent threads
Gate 3 — Account credibility: age >6 months, karma >500 (Reddit) or verified profile
Gate 4 — Emotion-to-fact:   low emotion + high specifics (not venting)
Gate 5 — Cross-tier:        signal corroborated by a Tier 1-3 source
Tier 4 base = number of gates passed x 10
