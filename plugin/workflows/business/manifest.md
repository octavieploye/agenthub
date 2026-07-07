# MANIFEST — Business Research Methodology
Version: 1.0
Modes: FORWARD (Eagle→Focus) | REVERSE (Focus→Eagle) | LOOP (both)

## LOAD ORDER
1. Always load ALL core/ modules first (5 files, ~800 tokens total)
2. lead-business loads ops/how-to-run (or ops/quick-start if context < 8K)
3. Load geo/ modules for active tracks only — keep in context throughout
4. Load one layer module at a time — unload previous before loading next
5. Load synthesis/ when all layers complete
6. Load ops/watchlist, ops/source-audit, ops/signal-registry only when explicitly needed

## CORE (always load — all 5)
core/non-assumption-rule    The one rule above all others
core/csl-protocol           How to surface conflicts to the user
core/confidence-scoring     How to score signal confidence (0-100)
core/signal-tiers           Source trust hierarchy (Tier 0-5)
core/time-to-action         Signal urgency classification

## FORWARD MODULES (Eagle → Focus)
Entry: no prior knowledge of niche — scanning for opportunity
  forward/f1-eagle        L1   Macro forces, structural shifts
  forward/f1.5-lateral    L1.5 Adjacent market scan (optional)
  forward/f2-sector       L2   Industry structure, value chain
  forward/f3-market       L3   Segment map, TAM, white space
  forward/f4-competitive  L4   Player profiles, gap matrix
  forward/f5-niche-icp    L5   Buyer psychology, ICP language

## REVERSE MODULES (Focus → Eagle)
Entry: known business/niche — understand forces around it
  reverse/r1-niche-icp    R1   What do we know about this niche? (start here)
  reverse/r2-competitive  R2   Who are the players?
  reverse/r3-market       R3   What market contains this niche?
  reverse/r4-sector       R4   What sector contains this market?
  reverse/r5-eagle        R5   What macro forces shape this sector?

## GEO MODULES (load only activated tracks)
  geo/fr        France
  geo/eu        European Union
  geo/us        United States
  geo/cn        China
  geo/asia      Broader Asia (JP, KR, IN, SG, SE Asia)
  geo/africa    Africa (Pan-African + sub-regional)
  geo/oceania   Australia, New Zealand, Pacific

## SYNTHESIS
  synthesis/l6-synthesis    Cross-layer synthesis, integrity check, final output

## OPERATIONS
  ops/how-to-run        HOW/WHEN/WHY/WHAT — read by lead-business at session start
  ops/quick-start       Minimal load guide for low-context LLMs (< 8K window)
  ops/watchlist         Near-signal parking and review (load when needed)
  ops/source-audit      Quarterly source maintenance (load when needed)
  ops/signal-registry   Active signal log with freshness tags (load when needed)

## GEO TRACK SELECTION
At task start, user selects per track:
  Primary:  deep analysis — all layers, all sources
  Watch:    geo blind spot alerts only — no deep dive
  Excluded: explicitly out of scope — no alerts

Minimum: Global context (always on) + 1 Primary track
Maximum: all tracks active simultaneously

GEO BLIND SPOT ALERT
When a signal originates from a deactivated track:
  Flag: "Signal detected in [geo] — track not active"
  Options: Activate track / Acknowledge and proceed / Add to watchlist

## LOOP MODE
Run FORWARD then REVERSE, then load synthesis/l6-synthesis with both outputs.
Synthesis crosschecks:
  F1/R5  macro forces      — agreement: +15 CS | disagreement: CSL item
  F3/R3  market picture    — agreement: +15 CS | disagreement: CSL item
  F5/R1  ICP / niche view  — agreement: +15 CS | disagreement: CSL item (highest priority)

## TOKEN BUDGET GUIDE
core/ total:          ~800 tokens  (always in context)
active geo/ total:    ~400 tokens per track
one layer module:     ~600 tokens  (load/unload as you go)
synthesis/:           ~700 tokens  (load at end only)
Maximum in context at any point: ~3,000 tokens (fits 4K+ context window)
