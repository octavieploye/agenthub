# MODULE: f5-niche-icp
LAYER:  F5 — Niche / ICP / Expert View
MODE:   FORWARD
TOKENS: ~650

## LOAD FIRST
core/non-assumption-rule
core/csl-protocol
core/confidence-scoring
core/signal-tiers
+ active geo/ modules
+ f4-competitive output (Competitive Snapshot + Gap Matrix)

## INPUT
Required: Competitive Snapshot + Gap Matrix from f4-competitive
Required: Active geo-tracks
Optional: Sales call transcripts, win/loss interview data, expert network call notes (Tier 0)

## PROCESS
1. Source raw buyer language — only their words, not analyst paraphrases:
   - Reddit: specific subreddits for this buyer type (apply community gates)
   - Hacker News: if buyer is technical
   - LinkedIn: comments by verified practitioners (Tier 3 — check account credibility)
   - Niche newsletters: what practitioners read and share (high signal, low noise)
   - Review text from G2/Capterra (already collected in f4 — reuse for language extraction)
   - Expert network calls (Tier 0 if available)

2. Apply community gate filter (core/confidence-scoring) to every Tier 4-5 source
   Only sources passing >= 3 gates proceed to findings

3. Extract trigger events — what made buyers start looking for a solution?
   Use their exact words. Do not paraphrase into professional language.

4. Extract failure language — what did they try that did not work?
   Use their exact words. This reveals unsolved pain, not solved pain.

5. Extract trust signals — what made them commit to a vendor?
   Use their exact words. This reveals what positioning language actually converts.

6. Map the decision unit:
   Who else is in the room when the purchase decision is made?
   What does each person in the room care about?

7. Apply geo filter: does buyer language, trigger, or trust signal differ by active geo-track?
   If yes: note geo-delta. Do not assume one geo's buyer = all geos' buyer.

8. UPSTREAM INVALIDATION CHECK — highest priority:
   Does buyer reality from Layer 5 contradict the gap matrix from f4-competitive?
   If yes: CSL item (this means the white space identified in f4 may not be real)
   This is the most important invalidation check in the entire methodology.

9. Write Implications Block connecting buyer language to competitive gaps:
   Finding:  [what buyers actually say — in their words]
   So what:  [what this means for positioning against the gap matrix]
   If true:  [what messaging or product angle this supports]
   If wrong: [what changes if this buyer pattern is not representative]
   CS:       [score]
   TTA:      [tag]

## OUTPUT: ICP Profile + Messaging Brief
  Buyer archetype:    [who they are — sourced from their own words, not assumed]
  Trigger events:     [what makes them look — in their words, with source]
  Failure language:   [what did not work — in their words, with source]
  Trust signals:      [what made them commit — in their words, with source]
  Decision unit:      [who is in the room + what each person cares about]
  Objection map:      [top 3 objections with source and CS]
  Geo-delta:          [where buyer language differs by active geo-track]
  Messaging brief:    [connects buyer language from L5 to gap matrix from L4:
                       for each gap — here is the buyer language that names it]
  Implications Block: top 3 findings (full format)
  Knowledge gaps:     [list — especially note if buyer primary research is missing]
  CSL items:          [numbered list — include any f4 gap matrix invalidations]

## UPSTREAM INVALIDATION
If buyer language contradicts f4 gap matrix: CSL item — highest priority in session.
User decides: re-run f4 / accept buyer data as more current than player data / investigate further.

## HANDOFF
Forward feeds: synthesis/l6-synthesis
Gate before handoff:
  - >= 3 trigger events sourced with CS >= 35
  - Failure language documented from >= 2 independent sources
  - Messaging brief written connecting L5 language to L4 gap matrix
  - All CSL items reviewed and resolved by user
  - Near-signals below threshold queued for ops/watchlist
