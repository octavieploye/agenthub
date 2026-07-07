# MODULE: forward/m2-readiness
TYPE:   Forward Layer — load after M1 Persona Map is complete
OWNER:  readiness-analyst (lead: lead-marketing)
TOKENS: ~700

## PURPOSE
Assess whether the product can be marketed now, whether pre-launch marketing is viable,
what the niche risks and frictions are, and produce a Launch Readiness Score (LRS).
Uses macro forces from the business team + persona from M1 + market context.
Gives a clear recommendation: launch now / pre-launch build / wait / do not launch.

## INPUTS REQUIRED
  M1 Persona Map (completed)
  Macro Signal Map or Macro Context Map (from business team — INPUT 5)
  Market Context Map (from business team — INPUT 4)
  Competitive Gap Matrix (from business team — INPUT 3)
  If any missing: DRL item, do not proceed on those dimensions

## STEP 1 — MACRO RISK SCAN

Review the top 3 macro forces from the business team's macro signal map.
For each force, assess the marketing implication:

  Force: [name]
  TTA:   [IMMEDIATE / WATCH / HORIZON / STRUCTURAL]
  Niche impact for marketing: [what does this mean for launch timing or messaging?]
  Marketing risk level: HIGH / MEDIUM / LOW
  Action: Accelerate / Delay / Hedge / No change

  Rule: If any force has TTA: IMMEDIATE and marketing risk HIGH → flag as launch risk.
  Do not reassign TTA from business team output. Use as delivered.

## STEP 2 — NICHE FRICTION AUDIT

Frictions are specific reasons why buyers in this niche resist purchasing.
Source from: M1 objection profile + competitor reviews (negative sentiment) + buyer forums.

  Friction 1: [name]
    What it is:   [exact behavior or barrier]
    Source:       [ICP objection / review text / forum quote]
    CS:           [score]
    Marketing response: [how do we address this in positioning or channel]

  Friction 2: [same format]
  Friction 3: [same format]

  Friction severity score per item: HIGH / MEDIUM / LOW
  Aggregate friction level: HIGH / MEDIUM / LOW
  (HIGH = 2+ HIGH-severity frictions present)

## STEP 3 — PRE-LAUNCH MARKETING VIABILITY

Can we build audience / signal / waitlist before the product ships?
This is a binary + conditional question:

  Can this product be marketed before launch?
    YES — if: buyer problem is understood, trigger events are present, ICP is defined
    CONDITIONAL — if: product category is unfamiliar (education needed first)
    NO — if: product requires demo/trial to be understood, or competitive trust requires live proof

  Pre-launch activities that are viable (check each):
    [ ] Waitlist / early access signup — requires: landing page, trigger event clear
    [ ] Content / thought leadership — requires: buyer community identified, content format known
    [ ] Partnership / co-marketing — requires: complementary player identified
    [ ] PR / media — requires: newsworthy angle, press relationships in niche
    [ ] Community seeding — requires: community identified (from M1 social map)
    [ ] Paid acquisition pre-launch — requires: landing page, conversion goal defined

  For each viable activity: note what is still missing (→ DRL or M4/M5 dependency).

## STEP 4 — COMPETITIVE TIMING ASSESSMENT

Should we go to market now, before or after a competitor move?
Source: Competitive Gap Matrix from business team + macro forces.

  Competitive timing signal:
    Is any competitor about to occupy our target position? [YES / NO / UNKNOWN]
    Source: [job postings, funding announcement, product launch signal from f4/r2]

  First-mover advantage in this niche:
    HIGH: be first matters (network effects, switching costs, SEO)
    MEDIUM: speed helps but quality matters more
    LOW: late entrant can win on quality/price

  Timing recommendation: Launch now / Launch in [timeframe] / Wait for [condition]

## STEP 5 — PROBABILITY OF SUCCESS ASSESSMENT

Honest assessment of pre-conditions. Not a guarantee — a risk-adjusted estimate.

  Conditions met (check each):
    [ ] ICP is defined and sourced (from M1)
    [ ] Buyer trigger events are identified
    [ ] Competitive white space exists (from gap matrix)
    [ ] At least one channel is matched to buyer habits (from M1 + M4 preview)
    [ ] Macro timing is neutral or favorable
    [ ] No HIGH-severity friction that product cannot address

  Conditions at risk:
    [ ] Missing data items count: [N DRL items open]
    [ ] HIGH frictions unaddressed: [list]
    [ ] Macro forces working against us: [list]
    [ ] Competitor moving into our space: [YES / NO]

  Probability range: HIGH (>65%) / MEDIUM (40-65%) / LOW (<40%)
  Rationale: [2-3 sentences, evidence-based, no extrapolation]

  Note: this is a marketing viability probability, not a business success guarantee.
  Confidence score applies: CS [score] based on data completeness.

## STEP 6 — LAUNCH READINESS SCORE (LRS)

Quantitative readiness score across 5 dimensions. Each scored 0-20. Total: 0-100.

  Dimension 1 — ICP Clarity (0-20)
    20: Full persona map, all fields sourced, no open DRL items
    10: Partial — 2+ DRL items open, core attributes present
     0: ICP undefined or missing critical fields

  Dimension 2 — Macro Timing (0-20)
    20: No IMMEDIATE threats, WATCH forces manageable, macro neutral or favorable
    10: 1 IMMEDIATE force — manageable with messaging adjustment
     0: 2+ IMMEDIATE forces working against launch

  Dimension 3 — Competitive White Space (0-20)
    20: Clear gap, no direct competitor occupying target position
    10: Gap exists but competitor is moving toward it
     0: Position is occupied, differentiation not established

  Dimension 4 — Channel Readiness (0-20)
    20: Primary channel matched to persona, pre-launch channel viable
    10: Channel direction known but not validated
     0: No channel clarity

  Dimension 5 — Friction Profile (0-20)
    20: No HIGH frictions, medium frictions addressable in messaging
    10: 1 HIGH friction, product can address
     0: 2+ HIGH frictions, product cannot address

  LRS = sum of 5 dimensions

  LRS INTERPRETATION:
    80-100: Launch now — conditions favorable, proceed to M3-M6
    60-79:  Launch with conditions — address flagged gaps before full spend
    40-59:  Pre-launch build recommended — educate market, build audience first
    20-39:  Wait — resolve [specific conditions] before marketing investment
    0-19:   Do not launch — [critical missing element] must be resolved first

## M2 OUTPUT FORMAT

  MARKET READINESS ASSESSMENT — M2

  Macro risk:           [aggregate: HIGH / MEDIUM / LOW]
  Key risk:             [top force with TTA and marketing impact]
  Friction level:       [aggregate: HIGH / MEDIUM / LOW]
  Key friction:         [friction 1 — marketing response]
  Pre-launch viable:    [YES / CONDITIONAL / NO]
  Pre-launch options:   [list of viable activities]
  Timing:               [recommendation]
  P(success):           [HIGH / MEDIUM / LOW — CS score]

  LAUNCH READINESS SCORE: [N] / 100
    ICP Clarity:         [N]/20
    Macro Timing:        [N]/20
    Competitive Space:   [N]/20
    Channel Readiness:   [N]/20
    Friction Profile:    [N]/20

  Recommendation:       [one of the 5 LRS interpretations]
  Conditions to address before proceeding: [list if LRS < 80]

  DRL items raised this layer: [count]
  CSL items raised this layer: [count]

## HANDOFF TO NEXT LAYERS
  → M3 (competitive): friction profile, timing flag
  → M4 (channel): pre-launch channel viability, persona schedule from M1
  → M5 (message): friction audit for counter-messaging, probability framing
  → M6 (campaign): LRS, pre-launch vs. post-launch sequencing decision
