# CONFLICT SURFACE LIST (CSL) PROTOCOL

## When to Create a CSL Item
- Two sources contradict each other on a factual claim
- A finding depends on a signal with CS < 40
- A "so what" implication requires an assumption to hold
- Two agents interpret the same data differently
- A trend is projected more than 6 months beyond the data
- A geo-track diverges significantly from the global finding
- A layer finding contradicts a finding from a higher layer (upstream invalidation)
- User input contains a statement of fact that cannot be verified

## CSL Item Format

ID:        [C-number, sequential per session]
Layer:     [F1 / F2 / ... / R1 / ... / L6]
Source A:  [name + what it says]
Source B:  [name + what it says]
Impact:    [why this conflict matters to the analysis]
Options:
  A) [specific investigative action to resolve]
  B) [alternative interpretation that accepts both sources]
  C) Park — add to watchlist, proceed without this signal
  D) [other user-defined resolution]
User decision: ___

## Presenting Conflicts to the User
All CSL items are presented as a numbered list BEFORE handoff to the next module.
Format: plain list, one item per line, each with its options.
Do not bury conflicts in prose paragraphs.
Do not present one conflict at a time — show the full list so the user
can decide whether to investigate further or see similar patterns across items.

Example presentation:
  CONFLICTS TO RESOLVE — Layer F2 — 3 items

  C01 [F2] Euromonitor: sector growing 15% YoY vs. Reddit (12 threads): buyers
       leaving category. Impact: TAM assumption may be wrong.
       A) Dig deeper into L5 buyer signals  B) Accept both (different timeframes)
       C) Park  D) ___
       Decision: ___

  C02 [F2] Crunchbase: Competitor X raised $50M vs. LinkedIn: 3 senior PMs
       departed in 60 days. Impact: growth signal vs. talent signal conflict.
       A) Check Blind for internal signal  B) Accept both (chaos common post-raise)
       C) Park  D) ___
       Decision: ___

  C03 ...

## CSL Rules
- No layer output is valid with unresolved CSL items
- User must record a decision on every item before the layer closes
- CSL is cumulative — items carry forward to synthesis
- At synthesis (l6): all open CSL items listed in Strategic Situation Summary
- Resolved items are kept in the record (not deleted) — they are part of the audit trail

## What Is NOT a CSL Item
- Normal uncertainty (all research has uncertainty — this is expected)
- Two sources covering different time windows (note the difference, do not conflict-flag)
- Two sources covering different geographies (note the geo-delta, do not conflict-flag)
- Differences in framing that do not change the strategic conclusion
- A finding with CS 40-59 used as supporting context (label it, do not CSL it)
