# SIGNAL TIERS

## Tier 0 — Private Intelligence
Sources: expert network calls (GLG, Tegus, Dialectica, AlphaSights), conference
intelligence, trade association member publications, OSINT techniques
(Wayback Machine, job posting archaeology, DNS records).
Trust: near 100%. Cannot always be cited publicly.
Flag in output as: "Tier 0 — not publicly citable"

## Tier 1 — Hard Evidence
Sources: SEC filings (EDGAR), official gazettes (EUR-Lex, Legifrance,
Federal Register, Journal Officiel), patent filings (USPTO, EPO, INPI, WIPO),
court records, stock exchange announcements, central bank decisions.
Trust: near 100%. Verifiable. Cite directly with URL or filing reference.

## Tier 2 — Verified Publication
Sources: major financial media (Reuters, Bloomberg, FT, WSJ, Les Echos,
Nikkei Asia, Caixin), official press releases, established analyst firm
reports (McKinsey, Gartner, Euromonitor, Forrester).
Trust: high. Check for PR spin vs. factual claim. Cross-reference when possible.

## Tier 3 — Expert Opinion
Sources: named practitioners with verifiable credentials, domain newsletter
authors, peer-reviewed academic papers, recognised industry analysts on record.
Trust: medium-high. Verify credentials. Check for conflict of interest.
Do not cite anonymous expert opinion as Tier 3.

## Tier 4 — Community Signal
Sources: Reddit (specific subreddits), Hacker News, LinkedIn comments,
Blind, Discord niche servers, Quora (evergreen topics only).
Trust: low individually. Must pass 3 of 5 community gates before use.
See core/confidence-scoring for gate definitions.

## Tier 5 — Raw Social
Sources: Twitter/X, TikTok, general forums, anonymous posts, comment sections.
Trust: very low. Use for sentiment direction only. Never cite as evidence.
Never use as a primary source for any finding.

## Signal Decay Rates (freshness window before signal goes Stale)
Executive / board change:     30 days
M&A announcement:             60 days
Funding round:                60 days
Community sentiment:          30 days
Regulatory proposal:          90 days
Regulatory enforcement:       180 days (active until superseded)
Market sizing (TAM/SAM):      365 days
Technology trend:             180 days
Buyer psychology:             730 days
Patent filing cluster:        365 days
Competitive pricing:          90 days
Conference intelligence:      90 days
Expert network call:          180 days
Job posting signal:           60 days

After decay window: signal status = Stale.
Stale signals cannot be primary evidence. Label as historical context if used.
