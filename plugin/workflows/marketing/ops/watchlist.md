# MODULE: ops/watchlist
TYPE:   Operations — load only when parking or reviewing near-signals
OWNER:  campaign-analyst (lead: lead-marketing)
TOKENS: ~350

## PURPOSE
Near-signals that are interesting but below threshold, or not yet actionable.
Same discipline as business/ops/watchlist.md — applied to marketing signals.
Signals parked here do not block marketing work. They are reviewed on cadence.

## WHAT GOES ON THE WATCHLIST

  A marketing signal goes on the watchlist when:
  - Performance signal is directionally interesting but < 2 consecutive periods of data
  - A competitor is showing early movement into our channel/message territory
  - A new platform or format is gaining traction in the persona demographic — not enough data yet
  - A persona attribute is partially supported (CS 35-59) — enough to track, not enough to act on
  - A DRL item was resolved as "Waive — accept unknown" — the gap is documented here

## WATCHLIST ENTRY FORMAT

  WL-[number, sequential]
  Signal:       [what was observed — one sentence, specific]
  Source:       [where it came from — platform, layer, date]
  CS:           [confidence score — must be 35-59 to be watchlist; <35 → discard; ≥60 → promote]
  TTA:          [IMMEDIATE / WATCH / HORIZON / STRUCTURAL]
  Layer origin: [which layer raised this: M1/M2/M3/M4/M5/M6/R1-R5]
  Auto-promote: [condition that would raise this to active signal]
  Review date:  [when to check again: 30d / 90d / next campaign review]
  Status:       Watching / Promoted / Archived

Example:
  WL-002
  Signal:       TikTok showing 4x higher save rate than Instagram for our content category
                in 25-34 female demographic — only 2 weeks of data
  Source:       M6 campaign analytics, first campaign review
  CS:           48 — insufficient data window
  TTA:          WATCH
  Layer origin: M6 / campaign-analyst
  Auto-promote: If TikTok save rate > 3x Instagram for 4 consecutive weeks → promote to M4 channel review
  Review date:  30 days from entry
  Status:       Watching

## REVIEW CADENCE

  Weekly (campaign-analyst):
    Scan for any watchlist item that has hit its auto-promote condition.
    Promote to active signal → feed to appropriate layer for revision.

  Monthly (lead-marketing):
    Full watchlist review. Archive items older than 90d with no auto-promote trigger.
    Check if any waived DRL item (status: Waived) now has data available.

## PROMOTE PROTOCOL

  Condition met → campaign-analyst flags to lead-marketing.
  lead-marketing decides: promote to active layer or extend watch.
  If promoted: update status to Promoted, note which layer it feeds.
  Create appropriate DRL item or layer revision task.

## ARCHIVE PROTOCOL

  Archive when:
    Signal did not develop over review period
    Signal became irrelevant (competitor withdrew, market moved)
    Data invalidated the original observation

  Archive entries are kept — they inform pattern detection.
  Never delete — mark status: Archived.
