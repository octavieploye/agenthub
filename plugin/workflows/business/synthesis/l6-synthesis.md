# MODULE: l6-synthesis
LAYER:  L6 — Strategic Synthesis
MODE:   BOTH (FORWARD, REVERSE, LOOP)
TOKENS: ~700

## LOAD FIRST
core/non-assumption-rule
core/csl-protocol
core/confidence-scoring
+ ALL completed layer outputs
+ FULL CSL (all items, all layers, all user decisions recorded)

## INPUT
Required: All layer outputs (F1-F5 for FORWARD, R1-R5 for REVERSE, both for LOOP)
Required: Complete CSL with all user decisions recorded on every item
Required: Active geo-tracks

## PROCESS

### Step 1 — Cross-Layer Consistency Check
Lay all layer outputs side by side and check for internal consistency:

  Macro vs. Sector (F1/R5 ↔ F2/R4):
    Does the sector structure align with the macro forces identified?
    Mismatch: CSL item

  Sector vs. Market (F2/R4 ↔ F3/R3):
    Does the market map align with the sector value chain and power holders?
    Mismatch: CSL item

  Market vs. Competitive (F3/R3 ↔ F4/R2):
    Does the player landscape align with the segment map?
    Does the gap matrix match the white space identified in market sizing?
    Mismatch: CSL item

  Competitive vs. ICP (F4/R2 ↔ F5/R1):
    Does the buyer reality from L5/R1 validate the gap matrix from L4/R2?
    This is the highest-priority consistency check.
    Mismatch: CSL item — flag as highest priority open conflict

### Step 2 — LOOP VALIDATION TABLE (LOOP MODE only)
  Layer pair    Forward finding    Reverse finding    Match?    Action
  F1 / R5       [macro forces]     [macro forces]     Y / N     Y: +15 CS | N: CSL
  F3 / R3       [market picture]   [market picture]   Y / N     Y: +15 CS | N: CSL
  F5 / R1       [ICP / niche]      [ICP / niche]      Y / N     Y: +15 CS | N: CSL (highest)

Apply +15 CS modifier to all signals where LOOP confirms alignment.

### Step 3 — Integrity Check (run all 5 flags)
  Flag A — Echo chamber:
    All sources across all layers agree. Zero contradictions found.
    Action: do not close synthesis. Seek one contrarian source before proceeding.

  Flag B — Confirmation bias:
    The strategic conclusion matches the opening hypothesis exactly (from r1 or brief).
    Action: explicitly ask — "Did we find this or did we look for it?"
    Requires user to confirm before proceeding.

  Flag C — Layer mismatch:
    L5/R1 buyer language does not match L3/R3 market assumptions.
    Action: CSL item — highest priority. User must resolve before synthesis closes.

  Flag D — Missed event:
    A significant market event appears in a later layer that should have been
    caught in an earlier one.
    Action: identify source gap. Note in output. Do not silently ignore.

  Flag E — Single-source conclusion:
    The strategic conclusion rests on one primary source.
    Action: do not publish synthesis. Find corroboration or downgrade to hypothesis on CSL.

### Step 4 — Write Strategic Situation Summary (1 page max)
  ceo-advisor writes this section. lead-business reviews before delivery.

### Step 5 — User Review Gate
  Present full synthesis to user. User must approve before any output is delivered.
  If user requests changes: make them, re-run Steps 1-3, re-present.

## OUTPUT: Strategic Situation Summary

THE WORLD AS IT IS  (from F1+F2 or R4+R5)
  [2-3 sentences: the macro force and the sector it reshapes]

THE MARKET AS IT IS  (from F3+F4 or R2+R3)
  [2-3 sentences: the competitive arena, who is winning, the exploitable gap]

THE BUYER AS THEY ARE  (from F5 or R1)
  [2-3 sentences: what the real buyer needs — in their words, not analyst words]

THE STRATEGIC CONCLUSION
  [1 sentence only: the single most important thing this research tells us to do]
  [If you cannot write this in one sentence, the synthesis is not complete]

OPEN CONFLICTS  (unresolved CSL items — user must decide each)
  C[ID]: [one-line summary] — awaiting user decision
  [list all open items]

OVERALL CONFIDENCE
  Weighted CS: [average of all primary finding CS scores]
  Lowest-confidence input: [which finding, CS score, and why it matters to the conclusion]
  If weighted CS < 50: synthesis is advisory only — flag explicitly

RECOMMENDED NEXT ACTION
  [One concrete action — not a list, not options, one action]
  [With one-line rationale]

## THEN: Deliver in User-Selected Output Format
Format A — Executive Brief (1 page): 3 headline findings, 1 implication, 1 action
Format B — Working Document (5-10 pages): full findings, CSL, sources, implications [DEFAULT]
Format C — Deep Dive (full): all data, all sources, all signals, all methodology notes

## AFTER SYNTHESIS: Update Operations
Update ops/watchlist: add all near-signals from all layers that did not reach CS >= 35
Update ops/signal-registry: log all active signals with freshness tags
Note source gaps discovered during research: queue for next ops/source-audit

## TERMINAL STATE
l6-synthesis is the final module. No further modules load after this.
