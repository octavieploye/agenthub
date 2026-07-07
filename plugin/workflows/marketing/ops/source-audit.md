# MODULE: ops/source-audit
TYPE:   Operations — load quarterly or when a source produces anomalous data
OWNER:  competitive-intel-marketing + campaign-analyst (lead: lead-marketing)
TOKENS: ~350

## PURPOSE
Marketing sources degrade over time. Ad libraries add friction. Social platforms change
their algorithms. Demographic tools update their panels. This module runs a quarterly
check on all active marketing sources to ensure the data pipeline is healthy.

## MARKETING-SPECIFIC SOURCE LIST

  Platform audience and ad intelligence:
    Meta Ad Library           — ad creative and copy of competitors
    LinkedIn Ad Library       — B2B competitor ads, audience targeting estimates
    Meta Audience Insights    — demographic data for persona platform map
    LinkedIn Campaign Manager — B2B audience size estimates (requires account)

  SEO and traffic intelligence:
    SEMrush                   — keyword rankings, competitor organic strategy
    Ahrefs                    — backlink data, content gap analysis
    SimilarWeb                — traffic estimates, channel mix, audience behavior
    SpyFu                     — competitor paid keyword strategy

  Consumer research:
    GWI (Global Web Index)    — demographic + psychographic panel data
    Pew Research              — demographic reports, platform usage studies
    Statista                  — aggregate market stats (Tier 3 — use for direction only)

  Review and customer voice:
    G2                        — software reviews with role/company-size metadata
    Capterra                  — SMB software reviews
    Trustpilot                — B2C reviews
    App Store / Google Play   — mobile app reviews with version data

  Social listening:
    Reddit (niche subreddits)  — unfiltered buyer language, community pain
    Wayback Machine            — historical competitor messaging and website evolution

## QUARTERLY AUDIT CHECKLIST

  For each source, verify:
    [ ] Access intact (no login wall, paywall change, or account suspension)
    [ ] Data is current (last update timestamp is within expected freshness window)
    [ ] Methodology has not changed (panel updates, algorithm changes affect comparability)
    [ ] No known bias introduced (panel composition shift, coverage gaps)
    [ ] Alternative available if this source degrades

  Source-specific freshness windows:
    Ad libraries:              Check monthly — ads rotate fast
    SEMrush / SimilarWeb:      Quarterly — traffic data lags 4-6 weeks by default
    GWI:                       Annual panel refresh — check for wave release notes
    Pew Research:              Annual — note study date in every citation
    G2 / Capterra:             Check quarterly — platform scoring methodology changes

## AUDIT REPORT FORMAT

  SOURCE AUDIT — [Date]
  Conducted by: [agent]

  Source: [name]
  Status: HEALTHY / DEGRADED / REPLACED / INACCESSIBLE
  Last verified: [date]
  Freshness: [within window / stale — last update: date]
  Issues: [none / describe]
  Action: [none / update citations / flag signals sourced from this / replace with: alternative]

  If DEGRADED or INACCESSIBLE:
    All findings in the signal registry sourced from this → downgrade CS by 10
    Notify lead-marketing
    Propose alternative source

## WHEN TO RUN OUTSIDE OF QUARTERLY CADENCE

  Source audit fires immediately when:
  - A source produces a signal that contradicts 3+ other sources (anomaly flag)
  - A campaign based on sourced data dramatically underperforms expectations
  - A platform announces a methodology or algorithm change
  - A competitor's ad data disappears from an ad library (may indicate platform policy change)
