# MODULE: ops/how-to-run
TYPE:   Operations — read by lead-marketing at session start
OWNER:  lead-marketing
TOKENS: ~600

## PURPOSE
Operational guide for running a marketing session: who reads what, when, why, and how.
Companion to business/ops/how-to-run.md — same discipline, marketing-specific constraints.

## THREE ACCESS TYPES

  LOAD    — Module enters active context and is followed for the current layer
  REFERENCE — Module is consulted for a specific decision, not kept in context
  TRIGGER — Module is loaded only when a specific condition fires

## WHO READS WHAT

  lead-marketing:
    LOAD at session start:     manifest.md + handoff/business-to-marketing.md
    LOAD at each layer:        one layer module at a time (unload previous)
    REFERENCE as needed:       ops/drl-protocol.md when DR items are created
    LOAD at session end:       synthesis/l6-synthesis.md
    REFERENCE shared modules:  ../business/core/ (all 5) + active geo/ tracks

  persona-profiler:
    LOAD for M1 or R4 (message validation persona check)
    REFERENCE: ../business/core/confidence-scoring.md for CS on persona data
    TRIGGER: ops/drl-protocol.md — fires when any persona attribute is missing

  readiness-analyst:
    LOAD for V0 (validation sprint gate decision) or M2 or standalone risk assessment
    TRIGGER: ops/validation-sprint — fires when no validated market signal exists for the product
    REFERENCE: ../business/core/time-to-action.md for TTA tags
    REFERENCE: active geo/ modules for geo-adjusted TTA

  competitive-intel-marketing:
    LOAD for M3 or R3 (channel assessment) and R5 (strategic alignment check)
    Sources to use: Meta Ad Library, LinkedIn Ad Library, SEMrush, SimilarWeb, Wayback Machine
    TRIGGER: ops/drl-protocol.md — fires when competitor player profiles are missing

  channel-strategist:
    LOAD for M4 or R3
    REFERENCE: M1 output (persona platform map, demographics) — must be in context

  message-architect:
    LOAD for M5 or R4
    REFERENCE: M1 output (buyer language, pain identity, objections)
    REFERENCE: M3 output (competitor claims, customer complaint language)
    TRIGGER: ops/drl-protocol.md — fires when buyer language samples are missing

  content-creator:
    LOAD for M6 only
    NEVER begins until M5 message architecture is approved
    REFERENCE: M4 channel format specs while writing M6 creative briefs

  campaign-analyst:
    LOAD for V0 self-improving loop (P9 — runs every 1–3 days) or M6 (KPI) or R2 (performance)
    TRIGGER: ops/drl-protocol.md — fires when performance reveals an unverified assumption
    Owns: signal-registry.md updates + validation sprint P9 loop execution

## SESSION LIFECYCLE

  0. PRE-VALIDATION GATE (fires before session start if no validated market signal):
     load ops/validation-sprint.md — readiness-analyst runs 3-filter check.
     If no validated signal: run 9-prompt sprint. Do NOT begin M1 until 50+ signups.
     If validated signal exists (50+ signups or existing product with demand data): skip V0.

  1. SESSION START:
     lead-marketing loads manifest.md and ops/how-to-run.md (this file).
     load handoff/business-to-marketing.md — run validation checklist.
     If checklist fails: create DRL items, notify business team, do not begin M1.
     load shared core/ modules from business system (5 files, ~800 tokens).
     load active geo/ modules for this project.

  2. LAYER EXECUTION (forward mode):
     load M1 → complete → unload → load M2 → complete → unload → ...
     Never have two layer modules loaded simultaneously.
     lead-marketing assigns each layer to the appropriate agent.
     CSL items collected in-layer are presented to user before layer closes.
     DRL items raised in-layer are logged to DRL list before layer closes.

  3. LAYER EXECUTION (reverse mode):
     load R1 → user selects scope → load indicated R layers in sequence.
     R5 includes LOOP crosscheck if forward layers were also run.

  4. DRL PROTOCOL (fires any time a data gap is found):
     load ops/drl-protocol.md.
     create DR item in standard format.
     present to user with resolution options (A/B/C/D).
     record user decision before continuing.
     do not proceed on the blocked item until resolved.

  5. CSL PROTOCOL (fires at end of each layer):
     collect all conflicts found during the layer.
     present numbered list to user before closing layer.
     user records decision on every item.
     no layer closes with open CSL items.

  6. GEO BLIND SPOT ALERT (fires when signal is from inactive geo track):
     "Signal detected in [geo] — track not active."
     Options: activate track / acknowledge and proceed / add to watchlist.
     Do not proceed on the signal without user decision.

  7. SESSION END:
     load synthesis/l6-synthesis.md.
     run integrity check (5 red flags).
     resolve any remaining CSL items.
     present open DRL items for final user decision.
     produce Campaign Strategy Summary in user-selected format (A/B/C).
     unload all layer modules.
     lead-marketing updates signal-registry.md with any new signals.

## WHY / WHAT DECISION LOGIC

  WHY load ops/drl-protocol.md now?
    Any time a data point is needed for a persona, channel, or message decision
    and that data is not in the business team handoff. DRL protocol fires immediately.

  WHAT blocks marketing from proceeding?
    1. handoff/business-to-marketing.md checklist fails (any box unchecked)
    2. A DRL item is created and user has not yet resolved it for the blocked decision
    3. A CSL item is open at layer close — layer does not close until user decides
    4. Synthesis integrity check fails on any of the 5 red flags

  WHAT does not block marketing?
    Low-CS findings — proceed with CS score noted, uncertainty visible in output
    Watch-list signals — parked in ops/watchlist.md, do not block current layer
    Geo tracks that are inactive — geo blind spot alert fires, user decides

## FAILURE STATES

  FAILURE: business team handoff is incomplete
    Resolution: DRL items created, business team notified, marketing pauses until resolved

  FAILURE: persona attribute assumed without data
    Resolution: integrity check catches it — revise M1 before synthesis

  FAILURE: CSL item unresolved at layer close
    Resolution: re-present to user, mandatory decision before layer advances

  FAILURE: performance data reveals an assumption in forward layers
    Resolution: create DRL item, feed back to affected layer, note reduced CS on findings
    If assumption was structural: may require M1 or M4 revision before campaign restarts

## TOKEN MANAGEMENT

  Always in context (~1,600 tokens):
    shared core/ modules (5 files, ~800 tokens)
    active geo/ modules (~400 tokens per active track)

  Loaded one at a time, unloaded after use (~600-700 tokens each):
    one layer module (M1-M6 / R1-R5)

  Loaded at session start and end only:
    handoff module (~400 tokens) — unload after validation passes
    synthesis module (~700 tokens) — load only at end

  ops/ modules: REFERENCE only — load, use, unload
  Maximum total context at any point: ~3,200 tokens
