# MODULE: reverse/r4-message-validation
TYPE:   Reverse Layer — load when R2 flags message mismatch or on targeted audit
OWNER:  message-architect + persona-profiler (lead: lead-marketing)
TOKENS: ~650

## PURPOSE
Validate whether the existing message matches what the persona actually responds to.
Triggered when: R2 flags message underperformance, CTR is low, CVR is low, or
A/B data shows message elements diverging in performance.
Uses M5 framework applied in reverse: audit existing message against sourced buyer language.

## INPUTS REQUIRED
  R1 Campaign Entry (existing copy, headlines, CTAs)
  R2 Performance (message-level performance signals if available)
  M1 Persona Map (buyer language, pain identity, aspiration, objections)
  Messaging Brief from business team (exact buyer quotes)
  If buyer language samples missing: DRL item before validation can be completed

## STEP 1 — MESSAGE EXTRACTION

Extract the exact message from the current campaign (do not paraphrase):

  HEADLINE / H1: "[exact text]"
  SUBHEADLINE / H2: "[exact text]"
  CTA: "[exact text]"
  Key claim in body: "[extract the main promise]"
  Proof used: [type: number / logo / review / none]

  Ad headline (primary): "[exact text]"
  Ad copy: "[extract first sentence and CTA]"
  Email subject line: "[exact text]"

  Message inventory complete — no interpretation yet.

## STEP 2 — BUYER LANGUAGE MATCH TEST

Compare existing message to buyer language from the Messaging Brief and M1.

  For each message element:

    Current text: "[element]"
    Buyer language from brief: "[closest matching buyer quote]"
    Match level: DIRECT / CLOSE / DISTANT / MISMATCH

    DIRECT: current text uses the buyer's own words or very close paraphrase
    CLOSE: captures the idea but uses different vocabulary
    DISTANT: same topic area but different framing
    MISMATCH: message addresses a different problem than buyer language indicates

  Match summary:
    DIRECT matches: [N]
    MISMATCH items: [N] — highest priority for revision

  Rule: a MISMATCH between the headline and buyer's failure language is the most
  common reason for low CTR on well-targeted campaigns. Fix headline before creative.

## STEP 3 — TONE MATCH TEST

Does the current tone match what the persona responds to?
Source: M1 psychographic map + communication preferences.

  Current tone: [formal / conversational / technical / aspirational / fear-based]
    Basis: [inferred from vocabulary, sentence length, pronoun use in current copy]

  Persona expected tone: [from M1 Step 3 tone and voice definition]

  Tone match: MATCH / MISMATCH
  If mismatch:
    Current: [tone + evidence from copy]
    Expected: [tone from M1 + rationale]
    Impact: [where mismatch damages performance — headline / body / CTA]

## STEP 4 — OBJECTION COVERAGE TEST

Does the current campaign address the top objections from M1 Step 6?

  Objection 1: "[text from ICP]" — Addressed in campaign: [YES / NO / PARTIALLY]
  Objection 2: "[text]" — Addressed: [YES / NO / PARTIALLY]
  Objection 3: "[text]" — Addressed: [YES / NO / PARTIALLY]

  Unaddressed objections: [list]
  Where they should be addressed: [landing page FAQ / ad copy / email sequence / retargeting]

  If an objection is unaddressed and R2 shows high bounce rate or low CVR:
    High probability link — flag for immediate copy revision.

## STEP 5 — DIFFERENTIATION VALIDITY CHECK

Does the current differentiation claim hold against the competitive landscape?

  Current differentiation claim: "[what we say makes us different]"
  Is any competitor making the same claim? [YES / NO — source from M3 or R1 competitive data]

  If yes (claim is shared):
    Our claim is a category claim, not a differentiation claim.
    Recommend: shift to a sub-claim that is ours alone — or add specificity that competitors cannot match.

  Is our differentiation anchored to a buyer-valued outcome?
    Source: trust signals from ICP Profile
    If not: differentiation exists for us, not for the buyer. Revise.

## STEP 6 — MESSAGE REVISION RECOMMENDATIONS

Prioritized list of message changes with evidence for each.

  PRIORITY 1 (highest impact — fix first):
    Element: [headline / CTA / proof / differentiation]
    Current: "[exact text]"
    Problem: [specific mismatch — buyer language / tone / objection]
    Suggested direction: [not final copy — direction only]
    Source for direction: [buyer quote / M1 attribute / M3 customer complaint]

  PRIORITY 2:
    Same structure.

  PRIORITY 3:
    Same structure.

  Rule: only recommend changes supported by evidence. A message that "sounds better"
  without evidence is an opinion, not a recommendation.

  Validation method for each recommendation:
    A/B test: [element to test + variable to change]
    Buyer interview: [question to ask — 3-5 real buyers]
    Pilot: [small-scale paid test on primary channel]

## R4 OUTPUT FORMAT

  MESSAGE VALIDATION — R4

  Message extracted: [H1 / CTA / core claim]

  Match test results:
    Buyer language match: [N DIRECT / N CLOSE / N MISMATCH]
    Tone match: [MATCH / MISMATCH + evidence]
    Objection coverage: [N/3 addressed]
    Differentiation: [UNIQUE / SHARED — detail if shared]

  Revision recommendations:
    P1: [element] — current: "[text]" — direction: [evidence-based direction]
    P2: [element] — [same]
    P3: [element] — [same]

  Validation method for each: [A/B / interview / pilot]

  Persona assumption surfaced (if any):
    [assumption found in current message] → DRL item DR-00N
    Feeds M1 revision if persona data was wrong

  DRL items raised this layer: [count]
  Next layer: [R5 strategic alignment / synthesis if message was the primary issue]
