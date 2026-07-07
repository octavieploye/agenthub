# MODULE: forward/m4-channel-strategy
TYPE:   Forward Layer — load after M3 is complete
OWNER:  channel-strategist (lead: lead-marketing)
TOKENS: ~700

## PURPOSE
Select channels based on verified persona data — not convention or gut feel.
Every channel selected must be tied to at least one of: age range, industry vertical,
daily habits, communication preferences, or social platform usage from M1.
Every channel rejected must also have a reason. No channel is assigned by assumption.
Missing persona data → DRL item before channel is assigned.

## INPUTS REQUIRED
  M1 Persona Map (complete — demographics, platform map, communication preferences)
  M2 Readiness (pre-launch viability, timing recommendation)
  M3 Competitive Audit (competitor channel gaps, persona-channel alignment)
  Market Context Map from business team (buyer behavior: self-serve vs. enterprise)
  If persona demographic or platform data is missing: DRL item before assigning channel

## THE CHANNEL SELECTION RULE
A channel is selected ONLY when:
  1. Persona age + vertical + habits confirm buyer presence on this channel
  2. Content format persona prefers is available on this channel
  3. Channel serves the right stage of the buyer journey (awareness / consideration / decision)
  4. Investment (time or budget) is proportional to buyer concentration on this channel

A channel is rejected when:
  1. Persona data shows buyer is not active on this channel
  2. Channel format does not match persona content preference
  3. Competitor saturation is high AND our differentiation angle has no channel-specific fit
  4. Stage mismatch: channel is awareness-only for a buyer ready to decide

## STEP 1 — BUYER JOURNEY STAGE MAP

Before selecting channels, map what stage the buyer is at when they enter our funnel.

  Stage 1 — Awareness: Buyer does not know us or does not know they have the problem
  Stage 2 — Education: Buyer knows the problem, researching solutions
  Stage 3 — Consideration: Buyer is comparing us against alternatives
  Stage 4 — Decision: Buyer is ready to commit — trust must be established
  Stage 5 — Retention/Expansion: Buyer is a customer — deepening relationship

  Entry stage for this ICP: [Stage N]
  Source: trigger events (M1 Step 6) + trust sequence (M1 Step 6)
  If entry stage unknown: DRL item — "At what stage does your buyer typically first encounter a solution like ours?"

## STEP 2 — CHANNEL SCORING BY PERSONA FIT

Score each channel against the persona. Use M1 data.

  Framework — score each channel 0-10 on:
    Buyer presence:   Is the persona demonstrably active here? (from M1 Step 5)
    Format fit:       Does channel format match persona content preference? (from M1 Step 4)
    Stage fit:        Does this channel serve the buyer's entry stage? (from Step 1)
    Competitor gap:   Is there a channel gap competitors are not filling? (from M3 Step 5)

  Total score: average of 4 dimensions (0-10)

  CHANNEL SCORING TABLE:

  Channel       Presence  Format  Stage  Gap    Total  Decision
  LinkedIn      [0-10]    [0-10]  [0-10] [0-10] [avg]  [Select/Reject/Watch]
  Instagram     [0-10]    [0-10]  [0-10] [0-10] [avg]  [decision]
  Facebook      [0-10]    [0-10]  [0-10] [0-10] [avg]  [decision]
  TikTok        [0-10]    [0-10]  [0-10] [0-10] [avg]  [decision]
  YouTube       [0-10]    [0-10]  [0-10] [0-10] [avg]  [decision]
  X/Twitter     [0-10]    [0-10]  [0-10] [0-10] [avg]  [decision]
  Reddit        [0-10]    [0-10]  [0-10] [0-10] [avg]  [decision]
  Email         [0-10]    [0-10]  [0-10] [0-10] [avg]  [decision]
  SEO/Blog      [0-10]    [0-10]  [0-10] [0-10] [avg]  [decision]
  Podcast       [0-10]    [0-10]  [0-10] [0-10] [avg]  [decision]
  Events/IRL    [0-10]    [0-10]  [0-10] [0-10] [avg]  [decision]
  PR/Media      [0-10]    [0-10]  [0-10] [0-10] [avg]  [decision]
  Partnership   [0-10]    [0-10]  [0-10] [0-10] [avg]  [decision]

  Selection threshold: Total ≥ 7.0 = Primary | 5.0-6.9 = Secondary | <5.0 = Reject
  Maximum primary channels for early stage: 2
  Maximum secondary channels: 3

## STEP 3 — OWNED / EARNED / PAID MIX

Map selected channels to media type:

  Owned (we control the asset):
    [channel] — asset type: [website / email list / community / podcast]
    Build timeline: [immediate / 1-3 months / 3-6 months]

  Earned (third-party amplification, zero media cost):
    [channel] — mechanism: [PR / partnership / SEO / community mention]
    Dependency: [what must be built first to earn this coverage?]

  Paid (requires budget — ad spend or sponsorship):
    [channel] — format: [ad type]
    Minimum viable budget threshold: [LOW <$500/mo / MEDIUM $500-2K/mo / HIGH >$2K/mo]
    If no budget: note as aspirational — owned/earned first

  Rule: never assign paid as the primary strategy without an owned foundation.
  Exception: if buyer journey entry is Stage 4 (ready to decide) and ICP is hyper-targeted,
  paid search or LinkedIn targeting may be appropriate at launch.

## STEP 4 — PRE-LAUNCH vs. POST-LAUNCH CHANNEL SEQUENCING

  Pre-launch (before product ships — from M2 viability check):
    Phase 0 (pre-launch, 0-N months out):
      Goal: build audience / waitlist / community
      Channels: [from M2 viable pre-launch activities, matched against channel scores]
      Metric: [email signups / community members / social followers]

  Launch:
    Phase 1 (weeks 1-4):
      Goal: [awareness / first customers / press]
      Primary channel: [selected channel]
      Content type: [format]
      One campaign action: [specific — not vague]

  Post-launch:
    Phase 2 (months 2-3):
      Goal: [retention / case studies / expansion]
      Add channel: [secondary channel]
      Metric: [conversion / CAC / LTV signal]

  Rule: sequence serves the LRS from M2. If LRS < 60, pre-launch phase is mandatory.

## STEP 5 — VERTICAL AND GEO CHANNEL ADJUSTMENTS

Some channels perform differently by vertical and geography.
Apply active geo-track modifiers:

  B2B vertical adjustments:
    Enterprise (>500 employees): LinkedIn primary, events secondary, cold email viable
    Mid-market (50-500): LinkedIn + SEO + partner
    SMB (<50): Facebook Groups, YouTube tutorials, community-led

  B2C vertical adjustments:
    High-consideration purchase: YouTube + SEO + email nurture
    Impulse / low-ticket: TikTok + Instagram + paid retargeting
    Subscription: email + community + content

  Geo adjustments (from active geo tracks):
    FR: LinkedIn lower than US, word-of-mouth and press stronger, WhatsApp for SMB
    EU (non-FR): LinkedIn for B2B, local language content reduces CAC
    US: paid channels scale faster, LinkedIn + Google primary for B2B
    CN: WeChat / Weibo / Douyin — only if CN geo track is active
    Africa: WhatsApp primary, mobile-first, local language, voice content viable
    Asia (IN/SG): WhatsApp + YouTube + LinkedIn; UPI payment = trust signal

## M4 OUTPUT FORMAT

  CHANNEL STRATEGY — M4

  Selected channels:
    PRIMARY:    [channel] — score [N] — rationale: [1 sentence from persona data]
    PRIMARY:    [channel] — score [N] — rationale: [1 sentence]
    SECONDARY:  [channel] — score [N] — rationale: [1 sentence]
    SECONDARY:  [channel] — score [N] — rationale: [1 sentence]
    REJECTED:   [channel] — reason: [persona mismatch / format mismatch / saturated]

  Media mix:
    Owned:  [assets and build timeline]
    Earned: [channels and dependencies]
    Paid:   [channels and budget threshold, or "not recommended at this stage"]

  Launch sequencing:
    Pre-launch: [channels and goal]
    Phase 1:    [channels, goal, one metric]
    Phase 2:    [channels, goal, one metric]

  Vertical/geo adjustments: [if applicable]

  DRL items raised this layer: [count]
  CSL items raised this layer: [count]

## HANDOFF TO NEXT LAYERS
  → M5 (message): selected channels drive format and tone requirements
  → M6 (campaign): channel sequencing becomes campaign calendar skeleton
