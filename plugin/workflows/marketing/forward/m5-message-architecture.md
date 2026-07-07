# MODULE: forward/m5-message-architecture
TYPE:   Forward Layer — load after M4 is complete
OWNER:  message-architect (lead: lead-marketing)
TOKENS: ~700

## PURPOSE
Build the core message framework: exactly what problem we solve, how we solve it,
why we are better than alternatives. Define tone and voice per channel and per persona.
Map content format per platform. Anchor every message element to buyer language from
the business team's Messaging Brief. Never invent language that is not evidenced.

## INPUTS REQUIRED
  Messaging Brief from business team (buyer language samples — exact quotes required)
  M1 Persona Map (pain identity, aspirations, objections, communication preferences)
  M3 Competitive Audit (competitor claims, customer complaint language)
  M4 Channel Strategy (selected channels drive format requirements)
  If buyer language samples are missing from Messaging Brief: DRL item before M5 proceeds

## THE MESSAGE ARCHITECTURE RULE
Every message element must connect to one of:
  A) Exact buyer language from the Messaging Brief (Tier 0 — strongest signal)
  B) Customer review text from M3 Step 3 (Tier 2 — own words, specific)
  C) Sourced persona attribute from M1 (Tier 2-3 — behavioral data)

A message element built on an inference or pattern match — not a buyer quote — is a
candidate, not a core message. Mark it CS < 60 and flag for validation.

## STEP 1 — CORE MESSAGE FRAMEWORK

The message framework is a hierarchy. Every downstream message must connect to it.

  PROBLEM STATEMENT (what we solve):
    In the buyer's own words: "[exact quote from Messaging Brief]"
    Translation to marketing language: [brief reframe — maximum 1 sentence]
    Source: [Messaging Brief field: failure language / trigger events]
    CS: [score from business team output — do not re-score]

  SOLUTION STATEMENT (how we solve it):
    What we do, in concrete terms — not abstract: [1 sentence max]
    Must answer: what happens, for who, with what result
    Do not use: "empower", "leverage", "transform", "revolutionize"
    Language must be available at the reading level of the persona

  DIFFERENTIATION STATEMENT (why us, not them):
    Built from: M3 competitor claims (what they own) vs. customer complaints (what they fail)
    Our position: [what we claim that no competitor owns + buyer evidence exists for it]
    Source: [competitor claim we are NOT making] + [customer complaint we address]
    CS: [score]

  VALUE PROOF ELEMENT (what makes the claim credible):
    Options: number (outcome metric), name (customer logo), word (certification/award),
             experience (free trial/demo), social (review count and score)
    Selected proof: [type + content]
    If no proof available yet: DRL item or pre-launch plan item — note gap

## STEP 2 — OBJECTION COUNTER-MESSAGE MAP

For each objection from M1 Step 6:

  Objection: "[text from ICP Profile]"
  Root cause: [fear / bad experience / knowledge gap / trust gap]
  Counter-message: [exact message that resolves this root cause]
  Format: [best format for this counter-message: testimonial / case study / demo / data point]
  Placement: [where in buyer journey does this counter-message appear?]
  Source for counter-message: [buyer language or customer proof — not invented]

  Rule: do not write a counter-message without a source. A counter-message built on
  "we are better" without evidence is a liability, not an asset.

## STEP 3 — TONE AND VOICE DEFINITION

Tone follows the persona — not the brand's preference.
Source: M1 psychographic map (values, identity markers) + communication preference.

  Primary tone: [choose one — formal / conversational / technical / aspirational / peer-to-peer]
  Rationale: [1 sentence from M1 persona data]

  Voice parameters:
    Vocabulary level:  [simple / professional / technical / mixed]
    Sentence length:   [short (<12 words) / medium / long — match to content format]
    Use of humor:      [YES / NO / situational — source from persona identity]
    Use of data:       [data-first / story-first / mixed]
    Pronoun stance:    [we / you-first / they (third-person social proof first)]

  Tone-per-channel adjustments:
    [Selected channel 1]: [tone modifier — e.g., LinkedIn is more formal than Instagram]
    [Selected channel 2]: [tone modifier]
    Email: [formal-to-conversational arc over nurture sequence]

  What the voice is NOT:
    [3 anti-patterns to avoid — based on what competitors sound like or what persona rejects]

## STEP 4 — MESSAGE-TO-CHANNEL FORMAT MAP

Each selected channel from M4 requires a specific format and length.
Build the format spec per channel.

  [Primary Channel 1 — e.g., LinkedIn]:
    Content types:  [post / article / carousel / video / ad]
    Optimal length: [post: 150-300 words / article: 800-1500 words]
    Hook formula:   [first line must achieve: open loop / question / contrast / stat]
    CTA:            [one action only — what do we want them to do?]
    Frequency:      [N times per week/month]

  [Primary Channel 2 — e.g., YouTube]:
    Content types:  [educational / case study / demo / testimonial]
    Optimal length: [short-form <3min / mid-form 5-10min / long-form >15min]
    Hook formula:   [first 30 seconds structure]
    CTA:            [subscribe / click link / book call]
    Frequency:      [N per month]

  [Email]:
    Types:          [welcome sequence / nurture / product update / re-engagement]
    Subject line:   [formula: [outcome] + [specificity] — not generic]
    Body length:    [short: 100-150 words for early touch / longer for education phase]
    CTA:            [single — no two CTAs in one email]

  Rule: format is channel-native. LinkedIn article format does not work on Instagram.
  Each channel gets its own spec — do not copy-paste across channels.

## STEP 5 — LANDING PAGE MESSAGE HIERARCHY

For any destination page (waitlist, product, pricing):

  Above the fold (0.5 seconds to capture):
    H1: [problem statement — buyer's own language]
    H2: [solution statement — one concrete sentence]
    CTA: [one action — verb + outcome: "Start free" / "See how it works" / "Join waitlist"]

  Trust section:
    Proof element: [from Step 1 value proof — number / logo / review]
    Social proof: [count + source — e.g., "200 teams in [vertical]"]

  Objection section:
    Address top 2 objections with counter-messages from Step 2
    Format: [FAQ / feature list / testimonial pull quote]

  Secondary CTA:
    Lower-commitment: [Book a call / Watch demo / Read case study]

## M5 OUTPUT FORMAT

  MESSAGE ARCHITECTURE — M5

  Core message framework:
    Problem:          "[exact buyer language]"
    Solution:         [one sentence]
    Differentiation:  [our position vs. competitors]
    Proof:            [type + content]

  Objection counter-map: [N objections addressed]

  Voice:
    Tone:             [primary tone]
    Voice parameters: [vocabulary / length / data vs. story]
    Anti-patterns:    [3 items to avoid]

  Format map:
    [Channel]: [content type, length, hook, CTA, frequency]
    [Channel]: [same]

  Landing page H1/H2/CTA:
    H1: "[text]"
    H2: "[text]"
    CTA: "[text]"

  Message elements below CS 60 (validation needed):
    [element] — CS [score] — validation method: [A/B test / buyer interview / pilot]

  DRL items raised this layer: [count]
  CSL items raised this layer: [count]

## HANDOFF TO NEXT LAYERS
  → M6 (campaign): message framework + format map + landing page spec → campaign briefs
