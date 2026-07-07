# MODULE: r4-sector
LAYER:  R4 — Industry / Sector (Reverse)
MODE:   REVERSE
TOKENS: ~550

## LOAD FIRST
core/non-assumption-rule
core/csl-protocol
core/confidence-scoring
core/signal-tiers
+ active geo/ modules
+ r3-market output (Market Context Map + updated knowledge gap map)

## INPUT
Required: Market Context Map from r3-market
Required: Updated knowledge gap map from r3
Required: Active geo-tracks

## PROCESS
1. Identify the sector that contains the market found in r3.
   The sector is the broader industry classification — the market is one arena within it.
   If the market spans multiple sectors: note the overlap and ask user to choose focus.

2. Per active geo-track, map the sector across 5 dimensions:
   a. Value chain — who does what, who captures the most margin
   b. Power holders — who cannot be bypassed and why
   c. M&A and capital patterns — last 24 months (PE, IPO, strategic acquisitions)
   d. Regulatory constraints — specific rules shaping this sector per geo-track
   e. Technology adoption curve position

3. Determine sector phase per active geo-track — source the claim:
   Expanding / Plateauing / Declining

4. SECTOR-COMPETITIVE CHECK:
   Does the sector structure explain the competitive dynamics found in r2?
   Example: if r2 shows fragmented competition but sector data shows
   consolidating capital, the current fragmentation is temporary — flag this.
   If mismatch: CSL item (sector / competitive mismatch)

5. Update knowledge gap map — carry remaining gaps to r5.

6. Write Implications Block: how does the sector structure affect the r1 niche?

## OUTPUT: Sector Context Map
  Sector name:          [identified from market context — with alternative names if ambiguous]
  Value chain:          [who → what → relative margin — sourced]
  Power holders:        [top 3 with reason they hold power]
  Structural tensions:  [top 3 — what is cracking in this sector right now]
  Regulatory landscape: [per active geo-track]
  Capital flow:         [entering / exiting the sector — sourced, with CS]
  Sector phase:         expanding / plateauing / declining  CS: [score]
  Sector-competitive check: [does sector structure explain r2 findings? CSL if not]
  Geo-delta:            [where active tracks diverge on sector structure or phase]
  Knowledge gaps resolved: [from r1+r2+r3 gap map]
  Knowledge gaps remaining:[carry to r5]
  CSL items:            [numbered list — present to user before handoff]

## UPSTREAM INVALIDATION
If sector findings contradict r3 market picture: CSL item.
User decides: accept / re-run r3 / investigate further.

## HANDOFF
Reverse feeds: r5-eagle
Gate before handoff:
  - Sector identified and distinguished from market
  - Value chain mapped with >= 2 sourced nodes
  - >= 1 structural tension documented
  - Sector phase stated with CS >= 50
  - Knowledge gap map updated
  - All CSL items reviewed and resolved by user
