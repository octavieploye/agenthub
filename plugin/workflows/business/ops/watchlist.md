# MODULE: ops/watchlist
TYPE:   Operations — ongoing
OWNER:  market-researcher (maintains)
REVIEWED BY: lead-business (monthly)

## PURPOSE
Park near-signals that did not reach the evidence threshold for active use.
Prevents valid early signals from being permanently discarded before corroboration builds.
A signal on the watchlist is not rejected — it is waiting.

## WHEN TO ADD TO WATCHLIST
- Community signal (Tier 4) passes < 3 of 5 gates
- Any signal with CS < 35
- A signal that is relevant but past its decay window (Stale)
- A signal that conflicts with a higher-confidence signal (after CSL resolution:
  "Park" decision sends it here)
- A geo blind spot alert from a deactivated track

## ENTRY FORMAT
  ID:             W-[number, sequential]
  Date added:     [YYYY-MM-DD]
  Project:        [project name or "global"]
  Source:         [source name + brief description of origin]
  Tier:           [0-5]
  Gates passed:   [X of 5] — Tier 4/5 only. Leave blank for Tier 0-3.
  CS:             [current confidence score]
  Missing:        [what would increase CS or gates passed to threshold]
  Review date:    [30 / 60 / 90 days from date added — choose based on signal type decay rate]
  Auto-promote:   [condition: e.g., "when CS >= 35" or "when gates >= 3"]
  Layer context:  [which research layer this signal belongs to — F1 through R5]
  Related CSL:    [CSL item ID if this was a "Park" resolution]
  Summary:        [one sentence: what the signal says]
  Status:         Watching / Promoted / Archived

## REVIEW CADENCE
market-researcher checks the full watchlist every 30 days.

Per item at review:
  Has the signal gained new corroboration since it was added?
    Yes: re-evaluate against gate system and CS formula
         If now CS >= 35 or gates >= 3: promote to active signal-registry
    No:  update review date, keep watching

Items on watchlist > 6 months with no movement:
  Present to lead-business with options: Promote / Archive / Dismiss
  User makes the final call.

## PROMOTE PROTOCOL
When a watchlist item reaches the promotion threshold:
  1. Re-run through full signal tier check (core/signal-tiers)
  2. Assign TTA tag (core/time-to-action)
  3. Add to ops/signal-registry as Active signal
  4. Notify lead-business of the promotion
  5. Determine which layer analysis this signal belongs to
  6. If the promoted signal changes any existing finding in that layer:
     Create a CSL item for that layer — user must decide whether to update the finding

## ARCHIVE PROTOCOL
Item is archived (not deleted) when:
  - Signal is > 12 months old with zero corroboration growth
  - Source confirmed offline or defunct
  - User explicitly dismisses it (with reason recorded)
  - A higher-confidence signal supersedes it completely

Archived items remain searchable. Reason for archival recorded.
Purpose: historical pattern matching — a signal archived today may be the early
precursor to a cluster that forms 18 months later.
