# MODULE: f1-eagle
LAYER:  F1 — Eagle View (Macro)
MODE:   FORWARD
TOKENS: ~600

## LOAD FIRST
core/non-assumption-rule
core/csl-protocol
core/confidence-scoring
core/signal-tiers
core/time-to-action
+ all active geo/ modules

## SKIP IF
User already knows their niche or business — use REVERSE mode starting at r1-niche-icp.

## INPUT
Required: project brief (1-3 sentences: what are we researching and why?)
Required: active geo-tracks (from manifest geo selection)
Optional: known macro themes to investigate

## PROCESS
1. Per active geo-track, scan for macro forces across 5 categories:
   a. Capital flows — where is institutional money actually moving?
   b. Technology threshold — what is crossing from R&D to deployment?
   c. Regulatory shift — what is about to create or destroy value?
   d. Demographic / behavioral change — what is becoming irreversible?
   e. Geopolitical realignment — what is redrawing supply chains or talent access?

2. For each force found: assign CS (core/confidence-scoring) + TTA (core/time-to-action)

3. Check each force across all active geo-tracks — note divergence in geo-delta

4. INTEGRITY CHECK — run before writing output:
   Red flag A: zero contradictions found across all sources
               Action: flag echo chamber risk — actively seek a contrarian source
   Red flag B: synthesis conclusion matches opening hypothesis exactly
               Action: flag confirmation bias — check whether disconfirming sources
               were filtered out

5. Write Implications Block for top 3 forces:
   Finding:   [factual statement — only what the data shows]
   So what:   [what this means for strategy or positioning]
   If true:   [what to do or watch for]
   If wrong:  [what changes if this finding is incorrect]
   CS:        [score]
   TTA:       [tag]

6. Collect all conflicts, low-CS forces, geo divergences → CSL items
   Present full conflict list to user BEFORE proceeding

## OUTPUT: Macro Signal Map
Format per force (max 8 forces, no force without CS):
  Force [ID]:
    Name:       [descriptive label]
    Direction:  creating / destroying / transforming
    Geos:       [active tracks where this applies]
    Geo-delta:  [where tracks diverge and why]
    CS:         [score]
    TTA:        [tag]
    So what:    [one-line implication]

Then:
  Implications Block: top 3 forces (full format above)
  Knowledge gaps:     [list — do not fill with assumptions]
  CSL items:          [numbered list — present to user before handoff]

## UPSTREAM INVALIDATION
Not applicable — this is the first layer.

## HANDOFF
Forward feeds: f1.5-lateral (optional) OR f2-sector (if lateral skipped)
Gate before handoff:
  - >= 3 forces identified with CS >= 50
  - Implications Block written for top 3
  - All CSL items reviewed and resolved by user
  - Knowledge gap map complete
