# MODULE: f3-market
LAYER:  F3 — Market / Segment View
MODE:   FORWARD
TOKENS: ~600

## LOAD FIRST
core/non-assumption-rule
core/csl-protocol
core/confidence-scoring
core/signal-tiers
+ active geo/ modules
+ f2-sector output (Sector Intelligence Brief)
+ f1.5-lateral output if run (Adjacent Threat Map)

## INPUT
Required: Sector Intelligence Brief from f2-sector
Required: Active geo-tracks
Optional: Adjacent Threat Map from f1.5-lateral

## PROCESS
1. Identify all meaningful market segments within the sector

2. Size each segment per active geo-track:
   TAM (Total Addressable Market)
   SAM (Serviceable Addressable Market)
   SOM (Serviceable Obtainable Market)
   RULE: source every number. No unsourced sizing. Flag growth rate as
   projection if it extends beyond 12 months of actual data.

3. Map competitive density per segment:
   Fragmented (many small players) / Mixed / Consolidated (few dominant players)

4. Identify pricing models in use across the market:
   Subscription / Usage-based / Seat-based / Outcome-based / One-time / Hybrid

5. Identify buyer behavior patterns per active geo-track:
   Self-serve vs. enterprise-led
   Product-led growth vs. sales-led
   Direct vs. channel / distribution partner

6. Identify white space — where are buyers underserved?
   Source the claim. A white space unsupported by buyer evidence is a CSL item.

7. Incorporate adjacent threats from f1.5-lateral as "non-obvious competitors" column

8. UPSTREAM INVALIDATION CHECK:
   Does segment picture contradict f2-sector value chain or power holder map?
   If yes: CSL item

9. Write Implications Block for top 3 market findings

## OUTPUT: Competitive Landscape Map
  Segment breakdown:     [list of segments with sizing per active geo-track — all sourced]
  TAM / SAM / SOM table: [per active geo-track]
  Competitive density:   [per segment]
  Pricing models:        [in use across the market]
  Buyer behavior:        [patterns per active geo-track]
  White space:           [where no one is winning — sourced, not assumed]
  Non-obvious competitors: [from adjacent threat map, labeled as adjacent]
  Geo-delta:             [market size or structure divergence by geo-track]
  Implications Block:    top 3 findings (full format)
  Knowledge gaps:        [list]
  CSL items:             [numbered list — present to user before handoff]

## UPSTREAM INVALIDATION
If market findings contradict f2-sector: CSL item.
User decides: accept / re-run f2-sector.

## HANDOFF
Forward feeds: f4-competitive
Gate before handoff:
  - >= 2 segments identified and sized with sourced numbers
  - >= 1 white space finding with sourced evidence
  - Buyer behavior mapped for >= 1 active geo-track
  - All CSL items reviewed and resolved by user
