# ops/quick-start
TYPE:   Operations — minimal load guide for low-context LLMs
TOKENS: ~300

## USE THIS WHEN
Context window is limited (< 8K tokens).
You need to know the minimum required to begin a valid session.
You cannot load ops/how-to-run in full.

---

## MINIMUM LOAD — SESSION START
Step 1: Load core/non-assumption-rule        (~150 tokens)
Step 2: Load core/csl-protocol               (~200 tokens)
Step 3: Load core/confidence-scoring         (~200 tokens)
Step 4: Load core/signal-tiers               (~150 tokens)
Step 5: Load core/time-to-action             (~100 tokens)
Step 6: Load active geo/ modules             (~400 tokens each, load only selected)
Total core load: ~800-1,200 tokens

## MODE SELECTION (ask user if unclear)
Scanning for opportunity, no known niche? → FORWARD → load forward/f1-eagle first
Know a specific business or niche?        → REVERSE → load reverse/r1-niche-icp first
Both?                                     → LOOP    → run FORWARD then REVERSE

## LAYER LOAD ORDER
FORWARD: f1-eagle → [f1.5-lateral optional] → f2-sector → f3-market
         → f4-competitive → f5-niche-icp → synthesis/l6-synthesis

REVERSE: r1-niche-icp → r2-competitive → r3-market → r4-sector
         → r5-eagle → synthesis/l6-synthesis

Load one layer at a time. Unload previous before loading next.
Geo modules and core modules stay loaded throughout.

## THE ONE RULE THAT CANNOT BE SKIPPED
Never resolve a conflict internally. Never fill a gap with a guess.
Surface every conflict as a numbered list to the user.
User decides every item. Session pauses until they do.

## IF YOU GET STUCK
Cannot meet a layer's gate conditions:
  Report to user: what is missing, what the options are.
  Do not proceed past a failed gate without user decision.

CSL item created mid-layer:
  Stop forward motion on that finding.
  Collect all CSL items at layer end.
  Present full list to user before loading next module.

Upstream invalidation detected:
  Create CSL item flagged "upstream invalidation".
  User decides whether to re-run the upstream layer.

## SYNTHESIS — ALWAYS LAST
Load synthesis/l6-synthesis only after all layer modules complete.
ceo-advisor writes Strategic Situation Summary.
User approves before any output is delivered.

## SCHEDULED OPS (between sessions, not during)
30 days: ops/watchlist
7 days:  ops/signal-registry (freshness check)
90 days: ops/source-audit
