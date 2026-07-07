# MODULE: f2-sector
LAYER:  F2 — Industry / Sector View
MODE:   FORWARD
TOKENS: ~600

## LOAD FIRST
core/non-assumption-rule
core/csl-protocol
core/confidence-scoring
core/signal-tiers
+ active geo/ modules
+ f1-eagle output (Macro Signal Map)
+ f1.5-lateral output if run (Adjacent Threat Map)

## INPUT
Required: Macro Signal Map from f1-eagle
Required: Active geo-tracks
Optional: Adjacent Threat Map from f1.5-lateral

## PROCESS
1. Identify the sector(s) where the top macro forces from f1-eagle land hardest

2. Per active geo-track, map the sector across 5 dimensions:
   a. Value chain — who does what, who captures the most margin
   b. Power holders — who cannot be bypassed and why (distribution, IP, regulation, network)
   c. M&A and capital patterns — last 24 months of deals, PE buyouts, IPOs
   d. Regulatory constraints — specific rules shaping this sector in each active geo
   e. Technology adoption curve — where is this sector on the curve (laggard / early majority / leading)

3. Determine sector phase per active geo-track — source the claim:
   Expanding / Plateauing / Declining

4. UPSTREAM INVALIDATION CHECK:
   Do any sector findings contradict a macro force from f1-eagle?
   If yes: create CSL item + flag that f1-eagle may need re-run
   Do not silently accept the contradiction — surface it

5. Write Implications Block for top 3 sector findings

6. Collect all conflicts, geo divergences, low-CS findings → CSL items
   Present full conflict list to user BEFORE proceeding

## OUTPUT: Sector Intelligence Brief
  Value chain map:      [who → what → relative margin — sourced]
  Power holders:        [top 3 with reason they hold power]
  Structural tensions:  [top 3 — what is cracking and why]
  Regulatory landscape: [per active geo-track]
  Capital flow:         [where money is entering / exiting this sector — sourced]
  Sector phase:         expanding / plateauing / declining  CS: [score]
  Geo-delta:            [where active tracks diverge on structure or phase]
  Implications Block:   top 3 findings (full format)
  Knowledge gaps:       [list]
  CSL items:            [numbered list — present to user before handoff]

## UPSTREAM INVALIDATION
If sector findings contradict f1-eagle macro: CSL item created.
User decides: accept contradiction as noted / re-run f1-eagle with updated context.

## HANDOFF
Forward feeds: f3-market
Gate before handoff:
  - Value chain mapped with >= 2 sourced nodes
  - Power holders identified (>= 2)
  - >= 1 structural tension documented
  - Sector phase stated with CS >= 50
  - All CSL items reviewed and resolved by user
