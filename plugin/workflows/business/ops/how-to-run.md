# MODULE: ops/how-to-run
TYPE:   Operations — read at session start by lead-business
LOAD:   Before any layer module. After manifest and core/.
TOKENS: ~900

## PURPOSE
Defines HOW, WHEN, WHY, and WHAT the business team reads and calls.
Without this, the modules are a library with no librarian.
lead-business reads this once per session before assigning any work.

---

## THREE ACCESS TYPES

LOAD
  Bring a module into active context and execute all its steps.
  Used for: layer modules (f1-f5, r1-r5), core modules, synthesis.
  One layer module loaded at a time. Unload before loading next.

REFERENCE
  Consult a module for one specific piece of information mid-session.
  Do not re-execute all steps. Pull the relevant section only.
  Used for: checking a CS threshold, looking up a TTA tag,
  verifying a decay rate, re-reading a CSL item format.

TRIGGER
  A condition fires that causes an unplanned module load.
  Not part of the sequence — caused by an event.
  Used for: upstream invalidation re-run, signal cluster alert,
  watchlist promotion changing a live finding, CSL resolution
  requiring a layer to be re-run.

---

## WHO READS WHAT

lead-business
  ALWAYS:       manifest, core/ (all 5), ops/how-to-run, synthesis/l6-synthesis
  ORCHESTRATES: mode selection, geo-track selection, agent assignments
  REVIEWS:      every CSL item before it reaches the user
  TRIGGERS:     upstream re-runs, signal cluster tasks, ceo-advisor gates

market-researcher
  PRIMARY:      f1-eagle, f1.5-lateral, f2-sector, f3-market (FORWARD)
                r2-competitive, r3-market, r4-sector, r5-eagle (REVERSE)
  ALWAYS WITH:  active geo/ modules (loaded alongside layer modules)
  MAINTAINS:    ops/watchlist entries, feeds ops/signal-registry

business-analyst
  REFERENCE:    core/confidence-scoring (applies CS to all layer findings)
  READS:        all layer outputs for corroboration checks and CS scoring
  MAINTAINS:    ops/signal-registry (status updates, freshness tracking)
  DETECTS:      cross-project signal clusters from signal-registry

strategist
  PRIMARY:      f3-market implications block, f4-competitive gap matrix
                r3-market, r4-sector implications blocks
  PRODUCES:     strategic options document from f3+f4 output

positioning-expert
  PRIMARY:      f5-niche-icp ICP Profile + Messaging Brief
                f4-competitive customer voice section
                r1-niche-icp Niche Entry Brief (REVERSE mode)
  PRODUCES:     positioning language grounded in buyer evidence

investment-curator
  PRIMARY:      f1-eagle capital flow signals
                f2-sector M&A and capital patterns
  MONITORS:     ops/signal-registry filtered for M&A / investment signal types

ceo-advisor
  GATE 1:       f3-market or r3-market output — mid-session review
  GATE 2:       synthesis/l6-synthesis — writes Strategic Situation Summary
  NEVER reads:  raw signal cards or community source data (too granular)

---

## WHEN — SESSION LIFECYCLE

### SESSION START
Trigger: user gives a task description

lead-business steps (in order):
  1. Read manifest
  2. Determine mode — ask user ONE question to confirm:
       "Do you have a specific business or niche in mind (Reverse),
        or are you scanning for opportunity (Forward),
        or both (Loop)?"
  3. Determine geo-tracks — ask user:
       "Which regions matter for this research? (FR / EU / US / CN /
        Asia / Africa / Oceania — select Primary or Watch per track)"
  4. Load core/ (all 5 modules) — keep loaded for entire session
  5. Load active geo/ modules — keep loaded for entire session
  6. Assign first layer module to market-researcher
  7. Session begins

### LAYER EXECUTION (repeats per layer)
  market-researcher (or assigned agent) loads the layer module
  Executes all PROCESS steps in order — no skipping
  business-analyst applies CS to all key findings
  lead-business reviews output for CSL items

  If CSL items found:
    Collect all items (do not present one at a time)
    Present full numbered conflict list to user
    PAUSE — wait for user decisions on every item
    Record decisions before proceeding

  If no CSL items:
    Check HANDOFF gate conditions
    If gate met: unload current module → load next
    If gate not met: identify what is missing → research more or ask user

### CSL PAUSE — THE MOST IMPORTANT OPERATIONAL MOMENT
Trigger: any agent finds conflicting data, an embedded assumption,
         a low-CS primary finding, or a projection stated as fact

Steps:
  1. Agent creates CSL item immediately (core/csl-protocol format)
  2. Stops forward motion on that finding — does not proceed
  3. lead-business collects all CSL items at end of current layer
  4. Presents full numbered list to user — not one at a time
     "Here are [N] conflicts found in this layer. Please decide each:"
  5. User records decision on every item
  6. Only after all decisions recorded: layer closes

What does NOT happen:
  Agent does not choose between conflicting sources
  Agent does not proceed past a conflict
  Agent does not bury the conflict in prose — it is always a numbered list

### UPSTREAM INVALIDATION — TRIGGERED RE-RUN
Trigger: a lower layer finding contradicts a higher layer finding
         (each module defines its own UPSTREAM INVALIDATION CHECK)

Steps:
  1. Agent creates CSL item — flagged "upstream invalidation"
  2. lead-business presents to user:
     "Layer [X] finding contradicts Layer [Y].
      [Source A] says [X finding]. [Source B] says [Y finding].
      Options: A) re-run Layer Y with updated context
               B) accept both as noted discrepancy
               C) investigate further — add to watchlist"
  3. User decides
  4. If re-run: that layer module is reloaded (TRIGGER access pattern)

### CEO-ADVISOR REVIEW GATES (two fixed points per session)
Gate 1 — after F3-market or R3-market closes:
  ceo-advisor reads the market output
  One question: "Does this market picture match reality as you understand it?"
  If yes → proceed to F4/R4
  If no → CSL item with ceo-advisor's divergent view — user decides

Gate 2 — after synthesis/l6-synthesis is written:
  ceo-advisor reads Strategic Situation Summary
  Validates strategic conclusion
  May revise "Recommended Next Action"
  Signs off → output delivered to user

### BETWEEN SESSIONS — SCHEDULED OPERATIONS
ops/watchlist review        every 30 days
  Trigger: calendar / lead-business initiates
  Agent: market-researcher loads ops/watchlist
  Action: promote signals that now meet threshold,
          archive dead signals, report to lead-business

ops/signal-registry check   every 7 days
  Trigger: calendar / business-analyst initiates
  Agent: business-analyst checks stale dates
  Action: update status of signals past decay window
          if stale signal was primary evidence in active project:
          create CSL item → notify lead-business

ops/source-audit            every 90 days
  Trigger: calendar / lead-business initiates
  Agent: market-researcher loads ops/source-audit
  Action: audit all sources in all active geo/ modules
          produce Source Audit Report
          lead-business reviews + approves geo/ module updates

Signal cluster detection    continuous (checked after each signal-registry update)
  Trigger: business-analyst detects 3+ signals:
           same type + adjacent geo + within 90 days
  Action: flag to lead-business
          lead-business decides: open new research session / monitor / dismiss

---

## WHY — DECISION LOGIC

Why Forward mode?
  User is scanning for opportunity without a specific niche.
  The market tells them where to play.

Why Reverse mode?
  User knows their business or niche.
  They want to understand forces around their current position,
  validate assumptions, or find strategic threats.

Why Loop mode?
  User wants maximum confidence.
  Runs both directions — synthesis crosschecks where they agree or disagree.
  Disagreements in LOOP = the most valuable findings in the entire session.
  Both views were informed and they still conflict = real uncertainty to resolve.

Why load a geo module?
  A signal without geographic context is incomplete.
  FR regulation ≠ EU regulation ≠ US regulation.
  Geo modules are never optional — they filter and validate every layer finding.

Why surface conflicts to the user instead of resolving internally?
  No agent has authority to choose between two conflicting data points.
  That choice belongs to the user.
  The system is a decision-support tool — not a decision-making system.
  The agent finds conflicts, surfaces them clearly, presents options.
  The user decides. Always.

---

## WHAT — MODULE SELECTION LOGIC

```
User task arrives
       ↓
Scanning for opportunity?  → FORWARD: f1 → f1.5 → f2 → f3 → f4 → f5 → l6
       ↓
Know a specific niche?     → REVERSE: r1 → r2 → r3 → r4 → r5 → l6
       ↓
Both?                      → LOOP: run FORWARD + REVERSE → l6 (with crosscheck)
       ↓
Geo-tracks selected?       → load matching geo/ modules (keep loaded throughout)
       ↓
Upstream invalidation?     → TRIGGER: reload the upstream module
       ↓
Signal cluster detected?   → TRIGGER: open new Forward or Reverse session
       ↓
30 days elapsed?           → TRIGGER: ops/watchlist
       ↓
7 days elapsed?            → TRIGGER: ops/signal-registry freshness check
       ↓
90 days elapsed?           → TRIGGER: ops/source-audit
```

---

## FAILURE STATES — WHAT STOPS THE SESSION

These conditions halt the session. lead-business reports to user before proceeding.

  Unresolved CSL item at layer close
    Session does not advance. User must decide every conflict.

  Gate condition not met after research exhausted
    lead-business reports: "We cannot meet the gate for [layer].
    Here is what is missing. Options: proceed without it (note in output)
    / expand research scope / accept lower CS on this layer."

  Integrity check red flag fires in synthesis
    Synthesis does not close. lead-business reports the flag. User decides.

  Single-source strategic conclusion
    Synthesis does not deliver output. Find corroboration or downgrade to hypothesis.

  Agent produces an assumption without a CSL item
    lead-business catches it in review. Sends back to agent. Creates CSL item.
    This is the most common failure state. Prevention: every agent runs the
    non-assumption violation scan (core/non-assumption-rule) before output.
