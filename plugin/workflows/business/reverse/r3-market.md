# MODULE: r3-market
LAYER:  R3 — Market / Segment (Reverse)
MODE:   REVERSE
TOKENS: ~550

## LOAD FIRST
core/non-assumption-rule
core/csl-protocol
core/confidence-scoring
core/signal-tiers
+ active geo/ modules
+ r2-competitive output (Competitive Snapshot + updated knowledge gap map)

## INPUT
Required: Competitive Snapshot from r2-competitive
Required: Updated knowledge gap map from r2
Required: Active geo-tracks

## PROCESS
1. From the competitive landscape found in r2, identify which market segment
   the r1 niche sits within.
   The segment is defined by the competitive landscape — not assumed from the niche label.

2. Size the segment per active geo-track:
   TAM / SAM / SOM — source every number.
   No unsourced sizing. Flag growth rate as projection beyond 12 months.

3. Identify all other segments that exist within this same market
   (the niche's segment is one of several — map the others)

4. TAM VALIDATION CHECK:
   Does the data-sourced TAM match any TAM assumption in the r1 Niche Entry Brief?
   If not: CSL item (TAM assumption mismatch — this changes investment or sizing logic)

5. Map competitive density across all segments in this market
   (not just the niche's segment — the full picture)

6. Identify pricing models in use across the market

7. Identify buyer behavior patterns per active geo-track

8. Check: are any adjacent competitors from r2 entering a different segment
   of the same market? If yes: note in geo-delta or competitive dynamics.

9. UPSTREAM INVALIDATION CHECK:
   Does the market picture contradict the r2 competitive snapshot?
   (e.g., r2 shows 5 players but market data shows a consolidated duopoly)
   If yes: CSL item

10. Update knowledge gap map — carry remaining gaps to r4.

## OUTPUT: Market Context Map
  Niche segment:          [where the r1 business sits within this market — sourced]
  Segment sizing:         [TAM/SAM/SOM per active geo-track — all sourced with CS]
  All market segments:    [full list — the niche segment + adjacent segments]
  TAM validation:         [does data match r1 assumption? CSL item if not]
  Competitive density:    [per segment — fragmented / mixed / consolidated]
  Pricing models:         [in use across the market]
  Buyer behavior:         [patterns per active geo-track]
  Geo-delta:              [market size or structure divergence by geo-track]
  Knowledge gaps resolved: [from r1+r2 gap map]
  Knowledge gaps remaining:[carry to r4]
  CSL items:              [numbered list — present to user before handoff]

## UPSTREAM INVALIDATION
If market data contradicts r2 competitive snapshot: CSL item.
User decides: accept / re-run r2 / investigate further.

## HANDOFF
Reverse feeds: r4-sector
Gate before handoff:
  - Niche segment identified and sized with sourced numbers
  - TAM validated against r1 assumption or CSL item created
  - All market segments listed
  - Knowledge gap map updated
  - All CSL items reviewed and resolved by user
