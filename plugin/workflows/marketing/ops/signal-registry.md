# MODULE: ops/signal-registry
TYPE:   Operations — load when logging new signals or reviewing signal history
OWNER:  campaign-analyst (lead: lead-marketing)
TOKENS: ~350

## PURPOSE
Active log of all marketing signals across campaigns and sessions.
Parallel to business/ops/signal-registry.md — applies same discipline to marketing signals.
Captures: persona discoveries, channel performance signals, message response patterns,
competitive movement, and platform behavior changes.

## WHAT IS A MARKETING SIGNAL

A signal is an observed data point (with a source) that informs a marketing decision.

  Types:
    PERSONA       — new information about buyer behavior, demographics, or preferences
    CHANNEL       — platform performance data, algorithm change, audience shift
    MESSAGE       — copy or creative performance data (CTR, CVR, engagement)
    COMPETITIVE   — competitor campaign launch, channel entry, message change
    MARKET        — consumer sentiment shift, pricing change, review pattern change
    PLATFORM      — policy change, ad format change, reach algorithm update

  A signal is NOT:
    An opinion or inference without a data source
    A news article summary without performance implication
    A competitor's product change (that belongs in business team signal registry)

## SIGNAL ENTRY FORMAT

  SIG-[number, sequential]
  Type:         [PERSONA / CHANNEL / MESSAGE / COMPETITIVE / MARKET / PLATFORM]
  Signal:       [observed fact — one sentence, specific and measurable]
  Source:       [platform + date + link or access method]
  CS:           [confidence score — from ../business/core/confidence-scoring.md]
  Tier:         [signal tier — from ../business/core/signal-tiers.md]
  Layer:        [which marketing layer this informs: M1 / M2 / M3 / M4 / M5 / M6 / R1-R5]
  Freshness:    [when this signal expires or should be re-verified]
  Status:       Active / Watchlist / Superseded / Archived

Example:
  SIG-007
  Type:         MESSAGE
  Signal:       Subject line "[outcome in numbers]" achieved 38% open rate vs. 24% category
                benchmark — tested over 4 email sends to 1,200 recipients
  Source:       Mailchimp campaign report, 2026-06-15
  CS:           72 — 4 data points, sufficient volume, consistent pattern
  Tier:         Tier 1 (first-party campaign data)
  Layer:        M5 — strengthens subject line formula using outcome specificity
  Freshness:    Re-verify at 6 months (buyer behavior shift may change response)
  Status:       Active

## FRESHNESS MANAGEMENT

  Signal type freshness windows:
    Platform performance data (CTR, CVR):    30 days — algorithms change fast
    Competitor ad creative:                  60 days — campaigns rotate
    Persona platform behavior:               6 months — habits shift slowly
    Demographic data (GWI, Pew):             12 months — panel refreshes annually
    Message response pattern:                6 months — market saturation changes

  Freshness review: campaign-analyst checks registry monthly.
  Stale signals → downgrade CS by 10 per review period until archived.

## CROSS-PROJECT PATTERN DETECTION

  After 3+ signals of the same type with consistent direction → flag as pattern.

  PATTERN: [name]
  Signals: SIG-[N], SIG-[M], SIG-[P]
  Direction: [what consistent pattern they share]
  Confidence: [average CS of contributing signals]
  Layer impact: [which marketing layer this strengthens or revises]
  Action: [update layer output / create DRL item / promote to M1/M4/M5 revision]

  Patterns are the highest-value output of the signal registry.
  They represent earned knowledge about what works for this audience.
  Feed patterns to lead-marketing for session briefing.

## SIGNAL REGISTRY MAINTENANCE

  Add signals: campaign-analyst adds after every campaign review (weekly)
  Review freshness: monthly
  Pattern detection: monthly — flag to lead-marketing if pattern forms
  Archive: signals superseded by newer data or outside freshness window
