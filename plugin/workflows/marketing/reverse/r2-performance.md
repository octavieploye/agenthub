# MODULE: reverse/r2-performance
TYPE:   Reverse Layer — load after R1 is complete
OWNER:  campaign-analyst (lead: lead-marketing)
TOKENS: ~650

## PURPOSE
Evaluate whether the existing campaign is working. Define "working" before measuring.
Identify what is performing, what is not, and what data is missing.
Performance gaps that reveal persona or channel assumptions → DRL items.
Performance data is the highest-quality signal in reverse mode — it is real buyer behavior.

## INPUTS REQUIRED
  R1 Campaign Entry (asset inventory, implied strategy)
  Performance data — user provides from: platform analytics, CRM, email platform, etc.
  If no performance data available: R2 cannot complete — DRL item to business/ops team

## STEP 1 — DEFINE SUCCESS BEFORE MEASURING

Before reading any number, establish what success meant for this campaign.

  What was the campaign goal? [from R1 implied strategy or user-stated]
    Options: awareness / leads / signups / revenue / retention / press
    If no stated goal: note "goal undefined — evaluation limited to activity metrics"

  What were the KPIs?
    Primary KPI: [from campaign brief if available / from user]
    Secondary KPI: [if any]
    If no KPIs were set: note as a structural gap — every finding is relative to
    industry benchmarks rather than campaign intent

  Benchmark sources:
    CTR benchmark: industry-specific (B2B paid LinkedIn: 0.4-0.6%, Meta: 1-2%)
    CVR benchmark: cold traffic landing page: 2-5%, warm: 8-15%
    Email open: B2B 25-35%, B2C 15-25%
    Engagement rate: organic social 1-3% is neutral, >3% is strong

## STEP 2 — PERFORMANCE DATA INTAKE

User provides raw numbers. campaign-analyst structures and interprets.

  CHANNEL: [channel name]
  Period: [date range]

  Metric                 Actual    Benchmark    Delta    Signal
  Impressions/Reach      [N]       [ref]        [+/-]    [above/below/on-track]
  CTR                    [%]       [ref]        [+/-]    [signal]
  CVR (if applicable)    [%]       [ref]        [+/-]    [signal]
  Cost per result        [€/$]     [ref]        [+/-]    [signal]
  Top performing asset:  [describe — which ad/post/email outperformed]
  Bottom performer:      [describe]

  [Repeat for each channel in use]

  Email-specific metrics (if email in use):
    Open rate:       [%] vs. benchmark [%]
    Click rate:      [%] vs. benchmark [%]
    Unsubscribe:     [%] — threshold: >0.5% is a message/targeting problem
    Subject lines that overperformed: [list]
    Subject lines that underperformed: [list]

## STEP 3 — WHAT IS WORKING

Only flag as "working" when data clearly exceeds benchmark or campaign goal.
Do not infer success from directionally positive data that is still below benchmark.

  WORKING — [metric / asset / channel]:
    Performance: [specific number vs. benchmark]
    Hypothesis (what may explain this):
      [must be connected to: persona match / message clarity / timing / format]
    Confidence: [HIGH if 3+ weeks of data / MEDIUM if <3 weeks / LOW if <1 week]

  WORKING PATTERN: [if multiple "working" items share a characteristic — name the pattern]
    Example: "Short-form video outperforms static across 3 channels — format match to persona"

## STEP 4 — WHAT IS NOT WORKING

Flag as "not working" when data is below benchmark for 2+ consecutive measurement periods.
One bad week is noise. Two consecutive bad weeks is a signal.

  NOT WORKING — [metric / asset / channel]:
    Performance: [specific number vs. benchmark]
    Root cause hypotheses (rank by likelihood):
      1. [persona mismatch — wrong audience]
      2. [message mismatch — claim does not match buyer need]
      3. [channel mismatch — buyer not active here]
      4. [format mismatch — content type wrong for channel]
      5. [timing — too early / too late in buyer journey]
    Evidence for top hypothesis: [what data points to it]
    Experiment to test: [what one change would confirm or deny the hypothesis]

  IF ROOT CAUSE = persona assumption:
    → Create DRL item: the assumption is missing from the ICP Profile
    → Feed to R4 (message validation) for deeper analysis

## STEP 5 — SIGNAL EXTRACTION FOR REVERSE LAYERS

Performance data reveals what the business team's research may have missed.
Flag any discovery that implies a persona, market, or positioning assumption.

  PERSONA ASSUMPTION FOUND:
    Example: "Campaign targeting 35-45 age band underperforms vs. 25-34 segment"
    Implication: M1 persona age range may need revision
    DRL item: "Does the core ICP skew younger than initially profiled?"
    → Feed to R4 (message validation) and may require M1 revision

  CHANNEL ASSUMPTION FOUND:
    Example: "LinkedIn underperforms. Reddit community posts drive 3x more signups"
    Implication: M4 channel selection may need revision
    → Feed to R3 (channel assessment)

  MESSAGE ASSUMPTION FOUND:
    Example: "Pain-point headline outperforms aspirational headline 4:1"
    Implication: M5 tone or message pillar may need revision
    → Feed to R4 (message validation)

## R2 OUTPUT FORMAT

  PERFORMANCE ASSESSMENT — R2

  Goal: [stated or inferred]
  Period assessed: [date range]
  Channels assessed: [list]

  What is working:
    [item]: [metric vs. benchmark] — confidence: [HIGH/MED/LOW]
    [pattern if applicable]

  What is not working:
    [item]: [metric vs. benchmark] — top hypothesis: [cause]
    Experiment to test: [one change]

  Assumptions surfaced:
    [assumption] → DRL item DR-00N → feeds R[N]

  Performance verdict:
    Campaign is: PERFORMING / UNDERPERFORMING / MIXED
    Primary underperformance driver (if applicable): [persona / message / channel / format / timing]

  DRL items raised this layer: [count]
  Next reverse layers recommended: [R3 / R4 / R5 based on underperformance driver]
