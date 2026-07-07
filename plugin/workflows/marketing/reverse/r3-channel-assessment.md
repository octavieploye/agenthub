# MODULE: reverse/r3-channel-assessment
TYPE:   Reverse Layer — load when R2 flags channel mismatch or on targeted audit
OWNER:  channel-strategist (lead: lead-marketing)
TOKENS: ~600

## PURPOSE
Assess whether the channel(s) in use are the right ones for this persona and goal.
Triggered when: R2 flags channel underperformance, or user requests standalone channel audit.
Uses the M4 channel scoring framework applied to existing channel choices rather than
prospective ones. The question is: does the current channel match the current buyer?

## INPUTS REQUIRED
  R1 Campaign Entry (channels in use, implied target audience)
  R2 Performance (if available — channel-level data)
  M1 Persona Map (if available — platform map, demographics, communication preferences)
  If M1 is not available: run mini-persona from available ICP Profile data
    If ICP Profile is also missing: DRL item before full R3 can execute

## STEP 1 — CURRENT CHANNEL AUDIT

For each channel currently in use:

  Channel: [name]
  Current use: [organic / paid / both]
  Volume: [N posts/ads per week]
  Performance from R2: [metric + benchmark + delta]

  Validation against persona (apply M4 framework):
    Buyer presence on this channel: [HIGH / MEDIUM / LOW / UNKNOWN]
      Source: [M1 platform map / persona demographic / platform audience data]
    Format match to persona preference: [MATCH / PARTIAL / MISMATCH]
      Source: [M1 communication preference]
    Stage fit (awareness/consideration/decision): [MATCH / MISMATCH]
      Source: [R1 implied buyer journey stage + R2 performance signal]
    Competitor presence: [HIGH / MEDIUM / LOW / UNKNOWN]
      Source: [M3 competitive audit / available platform data]

  Channel verdict: KEEP / ADJUST / REPLACE / ADD
    Rationale: [one sentence tied to above scoring]

## STEP 2 — MISSING CHANNEL ASSESSMENT

Are there channels the persona uses that are not in use?

  Run abbreviated M4 Step 2 (channel scoring table):
    For each channel NOT currently in use, score buyer presence (0-10) and format fit (0-10)
    Flag any channel with combined score ≥ 14 that is absent

  Missing channel opportunity:
    Channel: [name]
    Buyer presence: [score] — Source: [M1 or benchmark data]
    Format fit: [score]
    Why it was likely missed: [saturation fear / lack of content resource / wrong stage assumption]
    Recommendation: [Add as primary / Add as test / Monitor]

## STEP 3 — CHANNEL MIX ASSESSMENT

Evaluate the balance of owned / earned / paid from R1.

  Current mix: [% owned / % earned / % paid effort]
  Recommended mix from M4: [if M4 was run] or [benchmark for this ICP type]

  Risk flags:
    ALL PAID, NO OWNED: fragile — audience is rented, not owned. Recommend email/community build.
    ALL ORGANIC, NO PAID: if LRS ≥ 60 and budget exists, paid test may accelerate traction.
    SINGLE CHANNEL: concentration risk. If this channel changes algorithm, all reach disappears.

  Recommendation: [adjust mix or maintain — with rationale]

## STEP 4 — GEO-CHANNEL FIT CHECK

Are the channels appropriate for the geos where the campaign runs?

  For each active geo (from R1 or active geo tracks):
    [Geo] + [Channel]: [fit level: HIGH / MEDIUM / LOW]
    Reason: [from geo/ module norms — e.g., LinkedIn underperforms in FR, WhatsApp in Africa]

  If geo-channel mismatch found:
    Flag as channel assumption → DRL item if geo data was missing from business team inputs

## R3 OUTPUT FORMAT

  CHANNEL ASSESSMENT — R3

  Channels in use: [list]

  Per-channel verdict:
    [Channel]: [KEEP / ADJUST / REPLACE] — [one-sentence rationale]
    [Channel]: [verdict] — [rationale]

  Missing channel opportunities:
    [Channel]: opportunity score [N] — [why add / why test]

  Mix assessment: [owned/earned/paid current vs. recommended]
  Risk flags: [list if any]

  Geo-channel fits: [flags if any]

  Channel strategy recommendation:
    Keep: [list]
    Replace: [list + suggested alternative]
    Add: [list + priority: immediate / phase 2]
    Test: [list + format to test]

  DRL items raised this layer: [count]
  Next layer: [R4 message validation / R5 strategic alignment / synthesis if channel was the only issue]
