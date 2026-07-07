# MODULE: synthesis/l6-synthesis
TYPE:   Synthesis — load only after all active layers complete
OWNER:  lead-marketing
TOKENS: ~700

## PURPOSE
Cross-layer integrity check, final CSL and DRL resolution, and Campaign Strategy Summary.
This module closes the marketing session. Nothing leaves the session without passing
this synthesis. The output is the document the business team, user, and content team
can act from.

## WHEN TO LOAD
Load AFTER:
  Forward: M1 → M2 → M3 → M4 → M5 → M6 all complete
  Reverse: R1 → [active layers] → R5 complete
  LOOP: both forward and reverse complete, R5 LOOP crosscheck done

Do NOT load during layer execution. This is the closing module only.

## STEP 1 — CROSS-LAYER CONSISTENCY CHECK

Check that outputs from each layer are coherent with each other.
Inconsistencies found here → CSL items (user resolves — marketing team does not).

  M1 ↔ M4 consistency:
    Does the primary channel match the persona's platform map and age range?
    CONSISTENT: [state what aligns]
    INCONSISTENT: CSL item → "[M1 says buyer is on X, M4 selected Y — which takes priority?]"

  M1 ↔ M5 consistency:
    Does the core message use buyer language from the Messaging Brief?
    Does the tone match M1 persona communication preference?
    CONSISTENT: [state]
    INCONSISTENT: CSL item

  M2 ↔ M6 consistency:
    Does the campaign phase sequencing reflect the LRS?
    If LRS < 60, is Phase 0 (pre-launch) in the campaign plan?
    CONSISTENT: [state]
    INCONSISTENT: CSL item → "[LRS is 45 but M6 goes straight to launch spend — resolve]"

  M3 ↔ M4 ↔ M5 consistency:
    Does the message occupy a gap competitors are not filling?
    Is the channel one competitors are NOT dominating (or if they are, is our angle differentiated)?
    CONSISTENT: [state]
    INCONSISTENT: CSL item

  LOOP crosscheck (if both modes run):
    Forward M1 / Reverse R1 audience: [AGREE +15 CS / DISAGREE → CSL]
    Forward M4 / Reverse R3 channel:  [AGREE +15 CS / DISAGREE → CSL]
    Forward M5 / Reverse R4 message:  [AGREE +15 CS / DISAGREE → CSL]
    Forward M2 / Reverse R2 readiness: [AGREE +15 CS / DISAGREE → CSL]

## STEP 2 — INTEGRITY CHECK (5 RED FLAGS)

Fail any of these → stop synthesis, resolve before output.

  RED FLAG 1 — Missing business team handoff:
    Are all 6 required inputs from handoff/business-to-marketing.md present?
    If NO: which is missing? Was a DRL item created? If not, create now.
    Fail: [YES/NO]

  RED FLAG 2 — Assumed persona attributes:
    Does any layer output contain an unverified persona claim without a DRL item?
    Scan for: "likely", "probably", "typically" in M1-M5 findings not backed by data
    Fail: [YES/NO — list violations]

  RED FLAG 3 — Unresolved CSL items:
    Are there any CSL items from any layer that have not been resolved by the user?
    Fail: [YES/NO — list open items]

  RED FLAG 4 — Channel without persona evidence:
    Is any selected channel in M4 assigned without a buyer presence score from M1?
    Fail: [YES/NO]

  RED FLAG 5 — Message without buyer language anchor:
    Is any core message element in M5 built without a buyer quote or sourced data point?
    Fail: [YES/NO — list message elements below CS 60 with no validation plan]

  ALL FLAGS PASS: proceed to Campaign Strategy Summary.
  ANY FLAG FAILS: resolve before output. Do not produce summary with open integrity failures.

## STEP 3 — OPEN DRL ITEMS

List all DRL items created across all layers, sorted by status.

  DATA REQUESTS SUMMARY — Marketing Session

  Pending (business team has not responded):
    DR-00N [Layer]: [Missing data] — [blocked layer or decision]
    ...

  Resolved:
    DR-00N [Layer]: [what was received / decision made]
    ...

  Waived:
    DR-00N [Layer]: [what was waived — note the gap it leaves in findings]
    ...

  Total open: [N]
  Impact of open items: [which findings are at reduced CS or blocked]

## STEP 4 — CAMPAIGN STRATEGY SUMMARY

Maximum 1 page. This is the output the team acts from.

  CAMPAIGN STRATEGY SUMMARY — [Product/Campaign Name]
  Session type: [FORWARD / REVERSE / LOOP]
  Date: [session date]

  PERSONA:
    [Buyer archetype name] — [age range], [gender if sourced], [family status if sourced]
    Pain: "[exact buyer quote from Messaging Brief]"
    Trigger: [trigger event]
    Platform: [primary channel from M1]

  MARKET READINESS:
    LRS: [N]/100 — [interpretation: LAUNCH NOW / PRE-LAUNCH BUILD / WAIT]
    Key risk: [top macro force or friction]
    Pre-launch required: [YES / NO]

  COMPETITIVE POSITION:
    We own: [message/angle]
    Competitors claim: [what they say] — we differentiate on: [what we say]
    Channel gap: [where competitors are absent that our buyer is active]

  CHANNEL STRATEGY:
    Primary: [channel 1] — [reason in one phrase]
    Primary: [channel 2] — [reason in one phrase]
    Media mix: [owned/earned/paid allocation]

  CORE MESSAGE:
    H1: "[text]"
    H2: "[text]"
    CTA: "[text]"
    Proof: [type + content]

  CAMPAIGN PHASES:
    Phase 0: [if required — goal, channel, metric]
    Phase 1: [goal, channel, metric, timeline]
    Phase 2: [goal, channel, metric, timeline]

  OPEN GAPS (DRL items not yet resolved):
    [N items — [highest priority gap]]
    Findings dependent on open items are marked with reduced CS.

  FIRST ACTION:
    [Single most important thing to do next — specific, assigned, with a definition of done]

## OUTPUT FORMATS

  Format A — Executive Brief (this summary only — 1 page)
  Format B — Working Document (summary + all layer outputs — 5-10 pages)
  Format C — Full Session Record (all layers, all CSL/DRL items, all sources — complete)

User selects format before synthesis closes.
