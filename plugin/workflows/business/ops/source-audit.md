# MODULE: ops/source-audit
TYPE:   Operations — quarterly
OWNER:  market-researcher
REVIEWED BY: lead-business

## PURPOSE
The source list is a living asset. It degrades without maintenance.
Sources go offline, change editorial direction, get acquired, add paywalls,
or get replaced by better alternatives.
An unaudited source list is a silent confidence score inflation risk.

## AUDIT FREQUENCY
Full audit: every 90 days
Spot check: any time a source produces a signal that fails independent corroboration

## AUDIT SCOPE
Every source referenced across all geo/ modules and all layer modules.
Geo modules are the primary source list — audit those first.
Layer modules may reference additional sources — include those too.

## AUDIT CHECKLIST (run per source)
  1. Availability check
     Is the source still live and accessible without login or paywall?
     If now paywalled: note access cost — is it justified by signal value?

  2. Quality check
     Has content quality changed since last audit?
     Watch for: ownership change, editorial direction shift, increased PR content,
     bot-generated or AI-generated content increase, reduced update frequency.
     Downgrade tier if quality has degraded.

  3. Tier review
     Does this source still belong in its assigned tier?
     Reasons to upgrade: improved editorial standards, verified track record.
     Reasons to downgrade: quality degradation, conflict of interest discovered,
     consistent inaccuracy in this domain.

  4. Coverage review
     Are there new sources in this category that outperform this one?
     New sources to evaluate: add them, run them for 30 days, then decide.

  5. Geo accuracy review
     Is the geographic coverage of this source still as claimed?
     Sources that claim to cover a geo but actually focus on one country
     should have their coverage scope corrected in the geo module.

  6. Access and sustainability review
     Is continued access to this source reliable?
     Risk: source is a single person's newsletter — what if they stop?
     Mitigation: maintain 2+ sources per signal category per geo.

## ACTIONS PER SOURCE
  No change needed       Mark as: Verified [YYYY-MM-DD]
  Quality degraded       Downgrade tier + note reason in geo module
  Better source found    Add new source to geo module, flag old as Superseded
  Gone offline           Mark as: Defunct [YYYY-MM-DD], remove from active use
                         Flag any signals in ops/signal-registry that used this source
                         Those signals' CS scores may need recalculation
  Now paywalled          Mark as: Restricted [cost per access or subscription]
                         lead-business decides: pay / find alternative / remove
  Conflict of interest   Downgrade tier, add conflict-of-interest note
  discovered

## AUDIT OUTPUT: Source Audit Report
  Date:                   [YYYY-MM-DD]
  Sources reviewed:       [count]
  Changes made:
    Added:      [list with reason]
    Removed:    [list with reason]
    Downgraded: [list with reason and new tier]
    Upgraded:   [list with reason and new tier]
    Paywalled:  [list with access cost and lead-business decision]
  Signals affected:       [any active signals in signal-registry using changed sources
                           that may need CS recalculation]
  Source gaps identified: [categories or geos where coverage is thin]
  Reviewed by:            lead-business [sign-off date]

## SOURCE COVERAGE MINIMUM STANDARD
Per active geo-track: at least 2 independent Tier 1-2 sources per signal category.
Single-source categories = audit finding = recommendation to find second source.
