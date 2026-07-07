# MODULE: reverse/r5-strategic-alignment
TYPE:   Reverse Layer — final reverse layer before synthesis
OWNER:  lead-marketing (with readiness-analyst + message-architect)
TOKENS: ~600

## PURPOSE
Does this campaign serve the overall business positioning?
This is the highest-level reverse check: traces campaign back to business strategy.
A campaign can perform tactically (good CTR, good CVR) and still be misaligned
with the strategic position the business team has defined.

Triggered when: full reverse audit reaches R5, or user asks "are we marketing the right thing?"

## INPUTS REQUIRED
  R1-R4 outputs (or as many as were run)
  Competitive Gap Matrix from business team (positioning, gap matrix)
  ICP Profile (buyer archetype, trust signals, trigger events)
  Macro Signal Map (timing, forces)
  If business team strategy inputs are missing: DRL items block this layer

## STEP 1 — CAMPAIGN-TO-STRATEGY TRACE

Trace what the campaign is saying back to the strategy documents.

  Question 1: Does the campaign's core claim address the gap the business team identified?
    Campaign claim: "[from R4 or R1]"
    Business team gap: "[from Competitive Gap Matrix — white space the product occupies]"
    Alignment: ALIGNED / PARTIAL / MISALIGNED
    If misaligned: describe what the campaign claims vs. what the gap says we should own

  Question 2: Does the campaign speak to the buyer the business team defined?
    Campaign implied audience: [from R1 Step 2]
    Business team ICP: [from ICP Profile buyer archetype]
    Alignment: ALIGNED / PARTIAL / MISALIGNED
    If misaligned: campaign may be targeting a different buyer than strategy intends

  Question 3: Does the campaign timing align with macro forces?
    Campaign is running: [NOW / during [timeframe]]
    Key macro forces with TTA: [from Macro Signal Map]
    Timing verdict: FAVORABLE / NEUTRAL / AGAINST TIMING
    If against timing: [which force and what the TTA says about when to move]

## STEP 2 — POSITIONING COHERENCE CHECK

Is the campaign building a consistent position, or fragmenting it?

  Check 1 — Channel-message coherence:
    Is the same core claim expressed consistently across all channels? [YES / NO]
    If NO: which channel expresses a different claim?
      [channel]: current claim "[text]" vs. core claim "[text from R4]"
      Risk: fragmented positioning dilutes brand recall

  Check 2 — Persona-message coherence:
    Does each content format serve the right stage of the buyer journey?
    [Stage mismatch if any: trying to close (decision content) on an awareness channel]

  Check 3 — Competitive coherence:
    Is any claim shared with a direct competitor? [from R4 Step 5]
    If yes: are we being outspent on that claim? [estimate from M3 ad spend data]
    Risk: sharing a claim with a higher-spending competitor makes us invisible

## STEP 3 — STRATEGIC RECOMMENDATION

Based on all reverse layers (R1-R5), produce a ranked recommendation.

  Status: ALIGNED / PARTIALLY ALIGNED / MISALIGNED

  If ALIGNED:
    Tactical improvements only (R2-R4 recommendations) — strategy holds.
    Recommend: execute R2-R4 revisions and re-measure.

  If PARTIALLY ALIGNED:
    Strategy is directionally correct but execution has drifted.
    Specific drift points: [list from R1-R4 findings]
    Recommend: targeted revision to [element] — do not overhaul campaign.

  If MISALIGNED:
    Campaign is contradicting the strategic position.
    Root cause: [persona wrong / gap wrong / timing wrong / message inverted]
    Recommend: pause or redirect campaign before further spend.
    Required before relaunch: [specific business team input or strategy clarification]
    This is a DRL item if missing business team data caused the misalignment.

## STEP 4 — LOOP CROSSCHECK (if both forward and reverse were run)

If M1-M6 forward layers AND R1-R5 reverse layers were both run in this session:

  LOOP VALIDATION TABLE:
    M1 persona / R1 implied audience:    AGREE / DISAGREE → [+15 CS or CSL item]
    M4 channel / R3 channel assessment:  AGREE / DISAGREE → [+15 CS or CSL item]
    M5 message / R4 message validation:  AGREE / DISAGREE → [+15 CS or CSL item]
    M2 LRS / campaign performance (R2):  AGREE / DISAGREE → [+15 CS or CSL item]

  AGREE: forward analysis predicted what reverse confirmed → +15 CS on both findings
  DISAGREE: forward said X, reverse shows Y → highest-priority CSL item
    "Forward analysis [predicted / assumed] [X]. Reverse data shows [Y]. User must decide which to trust."

## R5 OUTPUT FORMAT

  STRATEGIC ALIGNMENT — R5

  Campaign-to-strategy alignment:
    Gap coverage:   [ALIGNED / PARTIAL / MISALIGNED] — [detail]
    ICP match:      [ALIGNED / PARTIAL / MISALIGNED] — [detail]
    Timing:         [FAVORABLE / NEUTRAL / AGAINST] — [detail]

  Positioning coherence:
    Channel-message: [COHERENT / FRAGMENTED] — [detail if fragmented]
    Stage fit:       [CORRECT / MISMATCH] — [detail if mismatch]
    Competitive:     [DIFFERENTIATED / SHARED CLAIM] — [detail if shared]

  Strategic verdict: ALIGNED / PARTIALLY ALIGNED / MISALIGNED
  Recommendation: [one clear action — tactical revisions / targeted redirect / pause]

  LOOP crosscheck (if applicable):
    Agreements: [list with +15 CS applied]
    Disagreements (CSL items): [list]

  DRL items raised this layer: [count]
  CSL items raised this layer: [count]
  Proceed to: synthesis/l6-synthesis.md
