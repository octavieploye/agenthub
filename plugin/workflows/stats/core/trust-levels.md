# TRUST LEVELS — Statistical Source Hierarchy

## Tier Definitions

### T0 — Primary / Private Data
User-provided raw data, proprietary databases, internal surveys, direct measurements.
Base CS: 90
Decay: None — user owns the data, freshness is user's responsibility.
Examples: company internal data, client-provided datasets, custom surveys.

### T1 — Official Statistics (Highest external trust)
National statistics offices, central banks, international governmental organizations.
Base CS: 85
Decay: 5 years for most macro data. Annual releases update — verify edition year.
Examples:
  - National: INSEE (FR), ONS (UK), Destatis (DE), BLS (US), Statistics Canada, ABS (AU)
  - International: Eurostat, World Bank, IMF, OECD, WHO, ILO, UN Statistics Division
  - Financial: ECB, Federal Reserve, BIS (Bank for International Settlements)
  - Trade: WTO, UNCTAD

### T2 — Peer-Reviewed Academic Research
Published journal articles, systematic reviews, meta-analyses — indexed and refereed.
Base CS: 70
Decay: 3 years. Replicated studies: +5 CS. Single non-replicated study: -10 CS.
Examples: Nature, Science, NEJM, JAMA, Journal of Finance, Review of Economic Studies,
          American Economic Review, Management Science.
Quality gate: DOI present + indexed in Scopus / Web of Science / PubMed.

### T3 — Institutional Research
Reports from established think tanks, professional bodies, major consulting research arms.
Base CS: 55
Decay: 18 months. No proprietary methodology disclosure: -10 CS.
Examples:
  - Think tanks: RAND Corporation, Brookings Institution, NBER, CEPR, Peterson Institute
  - Professional: CFA Institute, SOA (Society of Actuaries), GARP, ISDA
  - Consulting research: McKinsey Global Institute, BCG Henderson Institute, Bain (research)
  - Note: consulting reports with disclosed methodology score higher than unsupported claims.

### T4 — Industry Reports and Market Research Firms
Established market research and data providers — methodology varies, sampling often opaque.
Base CS: gates_passed × 10  (max 50)
Decay: 12 months.
Examples: Euromonitor, Statista, IBISWorld, Nielsen, GfK, Forrester, Gartner, IDC.

T4 Quality Gates:
  Gate 1 — Methodology disclosed (sample size, period, geography)
  Gate 2 — Publisher is a named, established firm (not anonymous report)
  Gate 3 — Data corroborated by a T1 or T2 source on the same metric
  Gate 4 — Published within decay window (12 months)
  Gate 5 — Cross-tier: data matches direction of a T1/T2 finding
T4 base CS = number of gates passed × 10

### T5 — Expert Opinion, White Papers, Press
Expert commentary, interviews, white papers without peer review, news-cited statistics.
Base CS: gates_passed × 6  (max 30)
Decay: 6 months.
Examples: industry conference presentations, vendor white papers, news interviews,
          LinkedIn expert posts, pre-print papers (not yet peer-reviewed).

T5 Quality Gates:
  Gate 1 — Named expert with verifiable credentials
  Gate 2 — Specific claim (not vague assertion)
  Gate 3 — No financial conflict of interest declared or none evident
  Gate 4 — Cross-tier: corroborated by any T1–T3 source
  Gate 5 — Account credibility verifiable (affiliation, publication history)

---

## CS Modifiers (apply to base score)

+15   Corroborated by a source from a different tier (cross-tier agreement)
+10   Source has a verified historical accuracy track record in this domain
+10   Finding replicated in multiple independent studies (for T2)
+5    Signal matches a confirmed pattern found in prior analysis session
-10   Single source only — no corroboration available
-15   Contradicted by a source of equal or higher tier (also flag as conflict item)
-20   Source has shown prior inaccuracy in this specific domain
-25   Data is past its decay window by more than 50%
-30   Methodology undisclosed and unverifiable

Score floor: 0.   Score ceiling: 100.

---

## Threshold Rules

>= 70   Primary evidence. Cite directly. Must show source + tier + CS.
50–69   Supporting context. Label: "Supporting (T[x] CS: [score])"
35–49   Weak signal. Flag: "Low confidence — treat as directional only (CS: [score])"
< 35    Watchlist only. Never cite as evidence. Never use as basis for conclusions.

A conclusion built on a finding with CS < 50 = automatic conflict item (flag for user review).
A synthesis conclusion with average input CS < 60 = flag as "Low Confidence Synthesis".

---

## Conflict Protocol

When T1/T2 source contradicts T4/T5 source on the same metric:
  1. Show both figures side by side with their tiers and CS scores.
  2. Do NOT silently choose one — always surface the conflict.
  3. Label: "DATA CONFLICT — [Metric]: T[x] says [A] (CS: [n]) vs T[y] says [B] (CS: [n])"
  4. If gap is material (>15% relative difference), flag for user decision before proceeding.

When two T1 sources disagree:
  1. Show both with methodology notes.
  2. Identify if different time periods, geographies, or definitions explain the gap.
  3. If not explainable: assign lower CS to both and flag as unresolved.
