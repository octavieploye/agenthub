# MODULE: forward/m6-campaign-plan
TYPE:   Forward Layer — load after M5 is complete. Final forward layer before synthesis.
OWNER:  content-creator + campaign-analyst (lead: lead-marketing)
TOKENS: ~700

## PURPOSE
Translate the message architecture and channel strategy into a concrete campaign structure:
phased plan, content calendar, creative briefs per channel, KPI framework, and launch
sequencing. This is the execution blueprint — not strategy (that was M1-M5).
Nothing is created without an approved message framework (M5) and channel strategy (M4).

## INPUTS REQUIRED
  M4 Channel Strategy (selected channels, pre/post-launch phasing, media mix)
  M5 Message Architecture (core message, format map, landing page spec)
  M2 LRS (determines pre-launch requirement and phase timing)
  M1 Persona (buyer journey entry stage, daily schedule — for timing optimization)

## STEP 1 — CAMPAIGN STRUCTURE

Define the overall campaign architecture before writing any brief.

  Campaign name: [product/initiative name + campaign goal]
  Campaign goal: [one primary goal — awareness / leads / signups / revenue]
  Campaign duration: [N weeks / months]
  LRS-gated phases:
    If LRS < 60: Phase 0 (pre-launch build) is mandatory before Phase 1
    If LRS ≥ 60: Phase 0 is optional — can go direct to Phase 1

  PHASE 0 — Pre-launch (if applicable):
    Duration:   [N weeks]
    Goal:       [waitlist size / community members / press placements]
    Channels:   [from M4 pre-launch activities]
    Success metric: [specific number]

  PHASE 1 — Launch:
    Duration:   [N weeks — typically 2-4 weeks]
    Goal:       [first conversions / press / trial activations]
    Channels:   [primary channels from M4]
    Success metric: [specific number + conversion event]

  PHASE 2 — Growth:
    Duration:   [N months]
    Goal:       [CAC target / MoM growth / case study production]
    Channels:   [primary + secondary channels from M4]
    Success metric: [CAC / LTV signal / retention]

## STEP 2 — CONTENT CALENDAR SKELETON

4-week rolling calendar. Specific content titles are placeholders — replaced by
message-architect content when production begins.

  Week 1 — [Phase 1 launch week]:
    Monday:    [Channel] — [content type] — [message pillar: problem/solution/proof/objection]
    Wednesday: [Channel] — [content type] — [message pillar]
    Friday:    [Channel] — [content type] — [message pillar]
    Email:     [trigger: launch announcement] — [subject line formula from M5]

  Week 2:
    [Same structure — alternate message pillars, do not repeat same pillar twice in a row]

  Week 3:
    [Add secondary channel if Phase 1 metric is on track]

  Week 4:
    [Review week — content type: social proof / case study / behind-the-scenes]
    Email: [re-engagement or nurture sequence trigger]

  Content pillar rotation rule: never publish the same message pillar two days in a row.
  Pillars: Problem awareness / Solution education / Social proof / Objection counter / CTA

## STEP 3 — CREATIVE BRIEFS (one per selected channel)

  BRIEF — [Channel name]
  Campaign phase: [0 / 1 / 2]
  Goal: [awareness / leads / signups / engagement]
  Format: [post / video / article / ad / email]

  Message: [which element of M5 message framework this brief executes]
  Hook: [first line or first 3 seconds — from M5 Step 4 hook formula]
  Body guidance: [structure — not script: problem → solution → proof → CTA]
  CTA: [exact text — from M5 format map for this channel]
  Tone: [from M5 Step 3 — channel-specific modifier]

  Visual direction:
    Style: [photography / illustration / screen recording / talking head]
    Color: [brand colors or persona-aligned mood]
    Text on visual: [YES/NO — percentage of frame]

  Success metric for this brief:
    Primary: [impressions / CTR / conversion / saves]
    Threshold: [what makes this a success?]

  Do not write the actual content in this brief.
  The brief is the instruction set — content-creator executes from it.

## STEP 4 — KPI FRAMEWORK

Define KPIs per phase — not a single global metric.

  PHASE 0 KPIs (pre-launch):
    Email signups:     [target — based on waitlist goal]
    Community members: [target]
    Content engagement rate: [benchmark: >3% for organic social]
    PR placements:     [target count]

  PHASE 1 KPIs (launch):
    New trial/signups: [target for week 1, week 2, week 4]
    Landing page CVR:  [benchmark: 2-5% for cold traffic, 8-15% for warm]
    CAC estimate:      [from media mix — paid vs. organic blend]
    Email open rate:   [benchmark: 25-35% for B2B, 15-25% for B2C]

  PHASE 2 KPIs (growth):
    Month-over-month growth: [% target]
    CAC trend:         [improving / stable / flag if rising]
    LTV signal:        [30-day retention, upgrade rate, referral rate]
    Channel ROI:       [which channel delivers lowest CAC — inform budget reallocation]

  Review cadence:
    Weekly: [channel engagement metrics]
    Monthly: [CAC, CVR, growth rate, DRL items triggered by performance data]

  Rule: if a KPI misses by >50% for 2 consecutive weeks → campaign-analyst flags for review.
  A performance miss is a DRL trigger if it reveals a persona or channel assumption was wrong.

## STEP 5 — BUDGET ALLOCATION FRAMEWORK

Not a fixed budget — a proportional guide based on media mix from M4.

  Budget split principle (early stage):
    Owned media build: 40% of time (not cash)
    Earned media pursuit: 30% of time
    Paid media: 30% of budget (cash) — allocated to highest-score channel from M4

  Paid media allocation:
    Primary channel: 60% of paid budget
    Secondary channel: 30% of paid budget
    Testing reserve: 10% (one new channel or format experiment per month)

  Budget trigger rule:
    Do not increase paid spend until:
      1. CVR on landing page is ≥ 2% (cold traffic)
      2. CAC is below [target — set by business team pricing data, not marketing assumption]
    If CVR < 2%: fix message first (M5 revision) before increasing traffic.

## M6 OUTPUT FORMAT

  CAMPAIGN PLAN — M6

  Campaign: [name] — Goal: [goal] — Duration: [N weeks/months]
  LRS: [N]/100 — Phase 0 required: [YES/NO]

  Phase structure:
    Phase 0: [goal, channels, metric] — [if applicable]
    Phase 1: [goal, channels, metric, weeks]
    Phase 2: [goal, channels, metric, months]

  4-week content calendar: [attached]
  Creative briefs: [N briefs — one per channel]

  KPIs:
    Phase 0: [metrics]
    Phase 1: [metrics]
    Phase 2: [metrics]

  Budget split: Owned [%] / Earned [%] / Paid [%]
  Paid channel allocation: [Primary channel] [N]% / [Secondary] [N]% / Testing [N]%

  Paid spend trigger conditions: [CVR threshold / CAC threshold]

  DRL items raised this layer: [count]
  CSL items raised this layer: [count]

## HANDOFF TO SYNTHESIS
  → L6: full campaign plan, LRS, all open DRL items, all CSL decisions
  Feed synthesis with: M1 persona, M2 LRS, M3 gaps, M4 channel rationale,
                       M5 core message, M6 phases + KPIs
