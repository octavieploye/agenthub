# MANIFEST — Marketing & Communication Methodology
Version: 1.0
Activates: after business team delivers findings (see handoff/business-to-marketing.md)
Modes: FORWARD (Strategy→Execution) | REVERSE (Campaign→Strategy) | LOOP (both)

## SHARED MODULES (load from business system — do not duplicate)
core/non-assumption-rule    ../business/core/non-assumption-rule.md
core/csl-protocol           ../business/core/csl-protocol.md
core/confidence-scoring     ../business/core/confidence-scoring.md
core/signal-tiers           ../business/core/signal-tiers.md
core/time-to-action         ../business/core/time-to-action.md
geo/ modules                ../business/geo/ (all — load active tracks only)

## LOAD ORDER
1. Load ALL shared core/ modules first (~800 tokens)
2. lead-marketing loads ops/how-to-run (or ops/quick-start if context < 8K)
3. Load handoff/business-to-marketing.md — validate inputs before any layer begins
4. Load active geo/ modules — keep loaded throughout
5. Load one layer module at a time — unload previous before loading next
6. Load synthesis/l6-synthesis.md when all layers complete
7. Load ops/ modules only when explicitly needed

## BEFORE STARTING — MANDATORY
Load handoff/business-to-marketing.md and validate all required inputs.
If inputs are incomplete: create DRL items, notify business team, do not begin M1.
See ops/drl-protocol.md for Data Request List format.

PRE-VALIDATION GATE: If no validated market signal exists (no product, no demand data),
run ops/validation-sprint BEFORE beginning M1. Do not begin M1 until 50+ email signups
confirm demand. readiness-analyst owns the go/no-go decision.

## PRE-VALIDATION (run before M1 when no validated market signal exists)
  ops/validation-sprint   V0  Niche discovery + 9-prompt pre-sell test — gates M1

## FORWARD MODULES (Strategy → Execution)
Entry: business team has delivered findings — build campaign strategy from scratch
  forward/m1-persona              M1  Deep persona: demographics, psychographics, habits, life
  forward/m2-readiness            M2  Market risk, frictions, launch timing, readiness score
  forward/m3-competitive-marketing M3 Competitor channels, messages, ads, content gaps
  forward/m4-channel-strategy     M4  Channel selection by persona, age, habits, vertical
  forward/m5-message-architecture M5  Core message, value prop, tone, format per channel
  forward/m6-campaign-plan        M6  Campaign structure, content calendar, creative briefs, KPIs

## REVERSE MODULES (Campaign → Strategy)
Entry: existing campaign or content — audit and trace back to strategy
  reverse/r1-campaign-entry       R1  What exists? Enter here with any campaign or content
  reverse/r2-performance          R2  What is working and what is not?
  reverse/r3-channel-assessment   R3  Is the channel right for this persona and goal?
  reverse/r4-message-validation   R4  Does the message match what the persona responds to?
  reverse/r5-strategic-alignment  R5  Does this campaign serve the overall positioning?

## SYNTHESIS
  synthesis/l6-synthesis    Campaign Strategy Summary, LRS, open DRL items, first action

## OPERATIONS
  ops/how-to-run            HOW/WHEN/WHY/WHAT — read by lead-marketing at session start
  ops/quick-start           Minimal load guide for low-context LLMs (< 8K window)
  ops/drl-protocol          Data Request List — missing data protocol back to business team
  ops/validation-sprint     Pre-product market validation — L7V 9-prompt playbook (gates M1)
  ops/watchlist             Near-signal parking (shared pattern with business ops/watchlist)
  ops/source-audit          Quarterly source maintenance
  ops/signal-registry       Active signal log with freshness tags

## HANDOFF
  handoff/business-to-marketing   Required inputs from business team + format check

## KEY PROTOCOL DIFFERENCES vs BUSINESS SYSTEM
CSL  = conflict between two data sources → user resolves (same as business)
DRL  = missing data that cannot be assumed → business team provides
Both are numbered lists presented to user before the layer closes.
DRL items block marketing progress. CSL items block layer advancement.

## TOKEN BUDGET GUIDE
shared core/ total:   ~800 tokens  (always in context)
active geo/ total:    ~400 tokens per track
handoff module:       ~400 tokens  (load once at session start)
one layer module:     ~600 tokens  (load/unload as you go)
synthesis/:           ~700 tokens  (load at end only)
ops/validation-sprint: ~650 tokens (load/unload — pre-M1 only, not kept in context)
Maximum in context:   ~3,200 tokens (fits 4K+ window)
