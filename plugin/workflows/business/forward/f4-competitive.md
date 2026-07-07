# MODULE: f4-competitive
LAYER:  F4 — Competitive / Company View
MODE:   FORWARD
TOKENS: ~650

## LOAD FIRST
core/non-assumption-rule
core/csl-protocol
core/confidence-scoring
core/signal-tiers
core/time-to-action
+ active geo/ modules
+ f3-market output (Competitive Landscape Map)

## INPUT
Required: Competitive Landscape Map from f3-market
Required: Active geo-tracks
Optional: Tier 0 intelligence (expert network calls, conference intel, OSINT)

## PROCESS
1. Select top 3-5 players from the white space segments identified in f3-market
   Priority: players competing for the same underserved buyer

2. For each player — run all steps, do not skip:
   a. Positioning: what narrative do they tell? (use their own words from website/PR)
   b. GTM motion: how do they acquire customers? (inbound / outbound / PLG / channel)
   c. ICP hypothesis: who do they appear to target? (from their own content — not assumed)
   d. Current job postings: what are they building right now?
   e. Job posting archaeology: what did they hire 12-18 months ago?
      (reveals what they are launching now — high signal technique)
   f. Wayback Machine: how has their website / pricing / positioning changed in 24 months?
   g. Review sources: G2 / Capterra / Trustpilot / App Store — exact customer language
   h. Funding / M&A status: Crunchbase or PitchBook — latest round, valuation if known
   i. Strength: one verifiable competitive advantage (sourced)
   j. Weakness: one exploitable gap in their offering (sourced — not assumed)

3. Build gap matrix:
   Rows: buyer needs identified in f3-market white space
   Columns: each player profiled
   Cells: covered / partially covered / not covered
   Empty cells = potential white space opportunity

4. Per active geo-track: are different players dominant in different regions?
   Note divergence in geo-delta.

5. UPSTREAM INVALIDATION CHECK:
   Does player map reveal a segment not captured in f3-market?
   If yes: CSL item — may need to re-run f3-market with updated segment list

6. Write Implications Block: what do these players reveal about what buyers value?

## OUTPUT: Competitive Snapshot + Gap Matrix
Per player (3-5):
  Positioning:       [one sentence — their own words, not your summary]
  GTM motion:        [how they acquire customers]
  ICP hypothesis:    [who they appear to target — sourced from their content]
  Current build:     [what job postings reveal they are building]
  Past build:        [what 12-18 month-old postings reveal launched or launching]
  Positioning shift: [what Wayback shows changed in 24 months]
  Customer voice:    [exact phrases from reviews — positive AND negative]
  Funding status:    [latest round, amount, date — or bootstrapped / unknown]
  Strength:          [one verifiable advantage CS: score]
  Weakness:          [one exploitable gap CS: score]
  Geo variant:       [if player is dominant in one geo but weak in others]

Gap matrix:          [buyer need x player coverage table]
Implications Block:  top 3 findings (full format)
Knowledge gaps:      [list]
CSL items:           [numbered list — present to user before handoff]

## UPSTREAM INVALIDATION
If player map contradicts f3-market segment picture: CSL item.
User decides: accept / re-run f3-market.

## HANDOFF
Forward feeds: f5-niche-icp
Gate before handoff:
  - >= 3 players profiled with CS >= 50 on key claims
  - Gap matrix has >= 1 uncovered cell
  - Job posting archaeology run on >= 2 players
  - All CSL items reviewed and resolved by user
