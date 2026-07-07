# MODULE: ops/signal-registry
TYPE:   Operations — updated after every research session
OWNER:  business-analyst (maintains), market-researcher (feeds)
REVIEWED BY: lead-business (on demand)

## PURPOSE
Central log of all active signals across all projects and all geo-tracks.
Provides: freshness tracking, cross-project pattern detection, historical record.
Enables: signal cluster detection, watchlist promotion tracking, audit trail.

## SIGNAL ENTRY FORMAT
  ID:             S-[number, sequential across all projects]
  Date captured:  [YYYY-MM-DD]
  Project:        [project name or "global" if cross-project]
  Source:         [source name and tier]
  Signal type:    M&A / Executive change / Regulatory / Technology /
                  Market trend / Community / Patent / Job posting / Other
  Geo:            [which geo-track this signal belongs to]
  Layer:          [F1 / F1.5 / F2 / F3 / F4 / F5 / R1 / R2 / R3 / R4 / R5]
  CS:             [confidence score at time of capture]
  TTA:            [Immediate / Watch / Horizon / Structural]
  Decay rate:     [days — from core/signal-tiers decay table]
  Stale date:     [date captured + decay rate = date signal becomes Stale]
  Status:         Active / Stale / Superseded / Archived
  Summary:        [one sentence — what the signal says]
  CSL linked:     [CSL item ID if this signal has an open or resolved conflict]
  Watchlist:      [W-ID if this signal was promoted from ops/watchlist]

## STATUS DEFINITIONS
  Active:       Within freshness window, CS meets threshold, usable as evidence
  Stale:        Past decay window — label as historical context if referenced
  Superseded:   A newer, higher-CS signal on the same topic has replaced this one
  Archived:     No longer relevant — kept for historical pattern matching only

## FRESHNESS MANAGEMENT
  business-analyst checks for Stale signals weekly (compare today vs. stale dates)
  When a signal goes Stale:
    Update status to Stale
    Notify lead-business if the signal was primary evidence in an active project
    If stale signal was load-bearing in a finding: create CSL item for that project
    Determine: find updated source / archive the signal / downgrade to context

## CROSS-PROJECT PATTERN DETECTION
  Condition: 3+ signals share all of:
    - Same signal type (e.g., all "Regulatory")
    - Same or adjacent geo-track
    - Captured within 90 days of each other
  Action:
    Flag to lead-business as potential signal cluster
    lead-business decides: open new research task / monitor / dismiss
  This is how the registry functions as an early warning system across projects.

## SIGNAL REGISTRY IS NOT
  A deliverable — never shared externally in raw form
  A replacement for layer analysis — it feeds layers, does not replace them
  A source of primary evidence on its own — signals must be verified per module process
  A substitute for the CSL — conflicts go in csl-protocol, not here

## AFTER EACH RESEARCH SESSION
  market-researcher adds all new signals captured during the session
  business-analyst updates status of any signals that changed (went Stale, Superseded)
  ops/watchlist is updated with near-signals
  Any signal cluster detected is reported to lead-business before session closes
