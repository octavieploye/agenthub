# MODULE: r2-competitive
LAYER:  R2 — Competitive / Company (Reverse)
MODE:   REVERSE
TOKENS: ~600

## LOAD FIRST
core/non-assumption-rule
core/csl-protocol
core/confidence-scoring
core/signal-tiers
core/time-to-action
+ active geo/ modules
+ r1-niche-icp output (Niche Entry Brief)

## INPUT
Required: Niche Entry Brief from r1-niche-icp
Required: Active geo-tracks (from Niche Entry Brief geo scope)

## PROCESS
1. Identify direct competitors operating in the specific niche from r1
   Scope: the niche as defined — do not expand to the broader market yet

2. Identify adjacent competitors that could enter this niche from outside
   These may not call themselves competitors — look by problem, not by label

3. Profile top 3-5 players using the same method as f4-competitive:
   a. Positioning (their own words)
   b. GTM motion
   c. ICP hypothesis (from their content)
   d. Current job postings — what are they building?
   e. Job posting archaeology — what did they hire 12-18 months ago?
   f. Wayback Machine — how has their positioning changed in 24 months?
   g. Review sources — exact customer language (G2/Capterra/Trustpilot)
   h. Funding / M&A status
   i. Strength (sourced), Weakness (sourced)

4. Build gap matrix:
   Rows: buyer needs known from r1 Niche Entry Brief
   Columns: each player profiled
   Cells: covered / partially covered / not covered

5. Check: which knowledge gaps from r1 knowledge gap map does this resolve?
   Update knowledge gap map — carry remaining gaps to r3.

6. UPSTREAM INVALIDATION CHECK:
   Does any competitive finding contradict a stated fact in the r1 Niche Entry Brief?
   If yes: CSL item (this may change the focus question)
   Present to user before proceeding.

7. Write Implications Block: what do these players reveal about what this niche values?

## OUTPUT: Competitive Snapshot (Reverse)
Per player (3-5):
  [Same format as f4-competitive output]

Additional fields:
  Knowledge gaps resolved:   [list — from r1 knowledge gap map]
  Knowledge gaps remaining:  [list — these carry forward to r3]
  r1 invalidations:          [CSL items where findings contradict the Niche Entry Brief]

Gap matrix:          [buyer need x player coverage]
Implications Block:  top 3 findings (full format)
CSL items:           [numbered list — present to user before handoff]

## UPSTREAM INVALIDATION
If findings contradict r1 Niche Entry Brief: CSL item.
User decides: update Niche Entry Brief / accept discrepancy as noted / investigate further.

## HANDOFF
Reverse feeds: r3-market
Gate before handoff:
  - >= 2 players profiled with CS >= 50 on key claims
  - Gap matrix has >= 1 entry
  - Knowledge gap map updated
  - All CSL items reviewed and resolved by user
