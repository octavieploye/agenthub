# MODULE: forward/m1-persona
TYPE:   Forward Layer — load after handoff/business-to-marketing.md passes
OWNER:  persona-profiler (lead: lead-marketing)
TOKENS: ~750

## PURPOSE
Build a complete buyer persona from the ICP Profile delivered by the business team.
Goes beyond role and industry — maps real human life: demographics, family, habits,
schedule, communication preferences, social media, hobbies, buying triggers.
Never invents attributes. Missing data → DRL item → request back to business team.

## INPUTS REQUIRED
From business team handoff (validate all before starting):
  ICP Profile:     buyer archetype, trigger events, failure language, trust signals
  Messaging Brief: buyer language samples (exact quotes)

If any required field is missing: create DRL item, do not proceed on that attribute.

## STEP 1 — DEMOGRAPHIC MAP

Build from ICP Profile data only. Flag every attribute sourced from assumption.

  Gender distribution:
    Source: ICP Profile or GWI / Pew Research if buyer archetype maps to traceable segment
    If unknown: DR item — "What is the gender distribution of your target buyer?"

  Age range and peak age band:
    Source: ICP Profile or platform audience data (LinkedIn Insights, Meta Audience Insights)
    Required for M4 channel selection — do not skip

  Family status (critical for channel and scheduling):
    Options: with children under 18 / without children / unknown
    Source: ICP Profile or Pew Research demographic reports for the archetype
    If unknown: DR item — "Does your target buyer typically have children under 18?"

  Relationship status (affects tone and content framing):
    Options: partnered / single / mixed / unknown
    Source: ICP Profile if stated; otherwise mark unknown — do not infer

  Geographic concentration:
    Source: business team geo-tracks (from f3-market or r3-market output)
    Map to active geo tracks from the geo/ module system

  Income bracket and employment type:
    Source: ICP Profile or GWI data for the archetype
    Required for pricing message calibration in M5

## STEP 2 — PSYCHOGRAPHIC MAP

Build from ICP buyer language samples (exact quotes from Messaging Brief).
Quote-source every claim. If no quotes available: DR item.

  Core values and worldview:
    What do they believe about their industry / profession / life?
    Derived from: failure language ("what has not worked"), trust signals ("what makes them commit")

  Identity markers:
    How do they describe themselves? What community do they belong to?
    Source: Reddit threads, LinkedIn bios in the target niche, community forums

  Pain identity:
    The problem they have tried to solve and failed. Use exact failure language from brief.
    Do not paraphrase. Do not infer beyond what is stated.

  Aspiration:
    What does success look like for them? Derived from trigger events and trust signals.

## STEP 3 — DAILY LIFE MAP

Maps where and when to reach the buyer. Required input for M4 (channel selection).

  Daily schedule archetype:
    Working hours: standard / flexible / shift / entrepreneur / unknown
    Morning routine: commute / home office / unknown
    Evening pattern: family obligations / social / solo / unknown
    Source: ICP archetype + family status from Step 1. Mark unknown if not derivable.

  Hobbies and leisure (shapes content format and tone):
    Sports, outdoor, fitness / Creative / Social / Digital entertainment / Unknown
    Source: GWI hobby data for the income + age + gender segment if ICP does not specify
    If sourced from GWI: note as Tier 3, CS 55

  Content consumption patterns:
    Long-form reader / Short-form / Audio-first / Video-first / Mixed
    Source: ICP quotes (if they mention what they read/watch) or platform usage data

## STEP 4 — COMMUNICATION PREFERENCES

Required for M4 channel selection and M5 message format decisions.

  Primary contact mode:
    Phone call / Text / Video call / Email / In-app messaging
    Source: ICP Profile trust signals, failure language ("they don't answer emails")
    If unknown: DR item — "How does your buyer prefer to be contacted initially?"

  Content format preference:
    Written / Short video (<3 min) / Long video (>10 min) / Podcast / Interactive
    Source: content consumption patterns from Step 3 + platform behavior data

  Meeting / decision style:
    Fast decision / Research-heavy / Committee-driven / Trial-first
    Source: trust signals + decision unit from ICP Profile

## STEP 5 — SOCIAL MEDIA PLATFORM MAP

Maps which platforms the buyer uses and how — required for M4 channel selection.

  Platform usage grid (score each: Primary / Secondary / Passive / Not used):
    LinkedIn:   B2B professional content, decision-makers, thought leadership
    Instagram:  Visual, lifestyle, DTC brands, aspirational products
    Facebook:   Parents, 35-55 age band, community groups, local business
    TikTok:     18-34 primary, short-form education, B2C products
    YouTube:    Tutorial, review, long-form education — all demographics
    X/Twitter:  Tech, media, finance professionals — real-time commentary
    Reddit:     Research phase, niche communities, skeptical buyers
    WhatsApp:   Direct communication, LATAM/EU/Africa concentrated

  Source hierarchy for platform map:
    1. ICP Profile if platform preference stated
    2. Meta Audience Insights / LinkedIn demographic data for the archetype
    3. GWI platform usage by age + gender + income segment
    4. If no source: unknown — do not assign a platform without evidence

## STEP 6 — BUYING TRIGGER AND OBJECTION PROFILE

  Trigger events (from ICP Profile — required field):
    List each trigger event exactly as stated. CS from business team output.
    Map trigger to TTA: what TTA tag does this trigger carry?

  Primary objections (from ICP Profile objection map — required):
    Objection 1: [text] — root cause: [fear / experience / knowledge gap / trust]
    Objection 2: [text]
    Objection 3: [text]

  Trust-building sequence:
    What must happen before they commit? (from trust signals field)
    Sequence: [event 1] → [event 2] → [decision]

## M1 OUTPUT FORMAT

  PERSONA MAP — M1 — [Buyer Archetype Name]

  Demographics:
    Gender:           [value or UNKNOWN — DR-00N pending]
    Age range:        [value]
    Family status:    [value or UNKNOWN — DR-00N pending]
    Relationship:     [value or UNKNOWN]
    Geography:        [active geo tracks]
    Income:           [value or UNKNOWN]

  Psychographics:
    Values:           [1-2 sentences, sourced]
    Pain identity:    [exact quote from failure language]
    Aspiration:       [1 sentence, sourced]

  Daily life:
    Schedule:         [archetype]
    Hobbies:          [list, sourced]
    Content mode:     [format preference]

  Communication:
    Primary contact:  [mode]
    Format:           [content format]
    Decision style:   [type]

  Platform map:
    Primary:          [platform] — [reason, sourced]
    Secondary:        [platform]
    Passive:          [platforms]

  Buying triggers:    [list with TTA]
  Top objections:     [list with root cause]
  Trust sequence:     [step 1 → step 2 → decision]

  DRL items raised this layer: [count] — see DRL list below
  CSL items raised this layer: [count] — see CSL list below

## HANDOFF TO NEXT LAYERS
  → M2 (readiness): persona schedule, geography, objection profile
  → M3 (competitive): persona platform map, content format preference
  → M4 (channel): full demographic + platform + communication preference map
  → M5 (message): pain identity, aspiration, exact buyer language quotes, objections
