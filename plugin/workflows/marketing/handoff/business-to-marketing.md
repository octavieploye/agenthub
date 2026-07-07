# MODULE: handoff/business-to-marketing
TYPE:   Handoff validation — load once at session start
OWNER:  lead-marketing validates, business team delivers
TOKENS: ~500

## PURPOSE
Defines exactly what the business team must deliver before marketing work begins.
The marketing team does not assume, infer, or reconstruct missing business inputs.
If inputs are incomplete: DRL items are created and business team is notified.
Marketing work does not begin until this checklist passes or DRL items are resolved.

## REQUIRED INPUTS FROM BUSINESS TEAM

INPUT 1 — ICP Profile (from f5-niche-icp or r1-niche-icp)
  Required fields:
    Buyer archetype:    [who they are — in their own words]
    Trigger events:     [what makes them look for a solution]
    Failure language:   [what has not worked for them before]
    Trust signals:      [what makes them commit to a vendor]
    Decision unit:      [who else is in the room and what they care about]
    Objection map:      [top 3 objections with source]
  If missing or incomplete: DRL item → request specific fields from business team

INPUT 2 — Messaging Brief (from f5-niche-icp)
  Required fields:
    Gap this messaging addresses: [from f4 gap matrix]
    Buyer language samples:       [exact quotes — not paraphrased]
    Competitive gap connection:   [which buyer language maps to which gap]
  If missing: DRL item — this is foundational for M5

INPUT 3 — Competitive Gap Matrix (from f4-competitive or r2-competitive)
  Required fields:
    Player profiles:    [3-5 players with positioning, GTM, strength, weakness]
    Gap matrix:         [buyer need × player coverage — empty cells = white space]
    Customer voice:     [review text — exact phrases — positive and negative]
  If missing: DRL item — required before M3 and M5

INPUT 4 — Market Context Map with sizing (from f3-market or r3-market)
  Required fields:
    Segment the target buyer sits in
    TAM / SAM / SOM per active geo-track (sourced)
    Buyer behavior patterns (self-serve vs. enterprise, etc.)
    Pricing models in use
  If missing: DRL item — required before M2 and M4

INPUT 5 — Macro Signal Map or Macro Context Map (from f1-eagle or r5-eagle)
  Required fields:
    Top 3 macro forces with TTA and CS
    Niche-specific implications of those forces
  If missing: DRL item — required for M2 risk assessment

INPUT 6 — Full CSL with all user decisions recorded
  All conflicts from the business research session must be resolved.
  An unresolved CSL item from the business team that affects marketing
  inputs is automatically a DRL item in the marketing session.

## VALIDATION CHECKLIST
lead-marketing runs this before assigning any work:

  [ ] ICP Profile received — all required fields present
  [ ] Messaging Brief received — buyer language samples present
  [ ] Competitive Gap Matrix received — >= 3 players profiled
  [ ] Market Context Map received — segment and sizing present
  [ ] Macro Signal Map received — >= 3 forces with TTA
  [ ] CSL fully resolved — no open items affecting marketing inputs

If any box is unchecked:
  Create DRL item for each missing element (ops/drl-protocol format)
  Present DRL list to user
  User decides: request from business team / waive with noted gap
  Do not begin M1 until user has resolved every DRL item

## WHAT MARKETING BUILDS ON TOP OF THESE INPUTS

Business delivers:       Marketing builds:
ICP Profile          →   Persona Map (M1) — enriched with behavioral + life data
Messaging Brief      →   Message Architecture (M5) — expanded with tone, format, channel
Gap Matrix           →   Competitive Marketing Audit (M3) — how competitors fill those gaps
Market Context       →   Channel Strategy (M4) — channel fit per segment and buyer behavior
Macro Signals        →   Market Readiness Assessment (M2) — risk and timing context
CSL resolved         →   Clean foundation — no inherited conflicts

## WHAT MARKETING NEVER DOES
Infer a persona attribute not present in the ICP Profile
Assume a market size not delivered by the business team
Fill a gap in the gap matrix with a guess
Resolve a business team CSL item on behalf of the user
Proceed past a missing input without a DRL item
