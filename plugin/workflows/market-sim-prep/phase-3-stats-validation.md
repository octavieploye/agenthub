# Phase 3 — Statistical Validation
Lead: lead-stats
Teammates: market-stats-researcher → [quant-analyst + risk-modeler in parallel] → behavioral-analyst → decision-modeler
Input: PHASE-2-OUTPUT from lead-data
Gate output: PHASE-3-STATS package → Phase 4 (simulation)

---

## OBJECTIVE

Convert Phase 1–2's qualitative intelligence into statistically validated, confidence-scored claims with probability bounds. Every market size estimate, every growth projection, every adoption assumption, every behavioral driver — must exit this phase with a trust tier, a confidence score, and an uncertainty range. No plain numbers. No unqualified projections.

**The scope rule applies throughout this phase:** Phase 3 does not evaluate the user's product or business directly. It provides statistical reference frameworks — the market, the buyers, the competitive dynamics — which the simulation then applies to the specific product context.

---

## STEP 1 — STATS BRIEF (lead-stats)

Before assigning any teammate, lead-stats reads the PHASE-2-OUTPUT and the list of Open Questions (item 5 from Phase 2). Then produces:

```
STATS BRIEF
===========
Priority questions:     [ordered list of the open questions by importance]
Module assignment:
  market-stats-researcher → runs m5 for: [specific market/segment questions]
  quant-analyst → runs [m1/m2/m3] for: [specific modeling questions]
  risk-modeler → runs m4 for: [specific risk quantification questions]
  behavioral-analyst → runs m6 for: [specific buyer psychology questions]
  decision-modeler → runs m7 for: [specific scenario modeling questions]
Sources to prioritize:  [specific sources the team should prioritize for this market]
Trust level target:     [minimum T2 for all primary claims; flag any T3-only findings]
```

---

## STEP 2 — MARKET RESEARCH (market-stats-researcher, loads m5)

**Task:** Source and validate all market quantitative claims from Phase 1. Every claim from Phase 2's opportunity and risk signals that includes a number must be traced to a source with a trust tier.

For each market/segment covered in Phase 1:
```
MARKET DATA POINT
=================
Claim from Phase 1:    [the claim being validated]
Source:                [name, organization, year, URL or publication]
Trust tier:            [T0–T5]
Confidence score:      [0–100]
Validated value:       [the number as sourced — not the Phase 1 estimate]
Uncertainty range:     [± or low–high]
Divergence flag:       [if sourced number differs from Phase 1 estimate by >20%, flag it]
Corroborating source:  [T1/T2 required for CS ≥ 70; T3 acceptable if no T1/T2 exists for this market]
```

Key data points that MUST be sourced for every market in scope:
1. Total addressable market (TAM) — global and geo-specific
2. Market growth rate (CAGR, last 3 years + projected 3 years)
3. Adoption curve stage (where is this category on the diffusion curve: early adopter / early majority / late majority)
4. Competitive concentration (number of players, market share distribution if available)
5. Average revenue per user / contract value benchmarks in this category
6. Churn rate benchmarks for comparable SaaS/software categories (if applicable)
7. Geographic market distribution (what % of global TAM sits in FR / EU / US / other)

**Trusted sources for AI/software market data (this domain):**
- IDC market forecasts (T3 — commercial, but widely cited; CS ceiling: 65)
- Gartner Hype Cycle reports (T3 — CS ceiling: 60; useful for maturity stage)
- Statista aggregations (T4 — only acceptable with original source cited; CS ceiling: 50)
- MarketsandMarkets, Grand View Research (T4 — treat as directional only; CS ceiling: 45)
- Eurostat for EU-specific data (T1 — CS ceiling: 90)
- OECD Digital Economy Outlook (T2 — CS ceiling: 80)
- Anthropic / OpenAI / Mistral published usage data (T3 — primary but proprietary; CS ceiling: 65)
- Academic research on AI adoption (T2 — CS ceiling: 85; require peer-reviewed source)

Flag explicitly: "The AI/software market research sector has an excess of T4/T5 sources claiming large numbers. Where no T1/T2 source exists, produce a bottom-up estimate using component data (e.g., number of Claude Code users × conversion rate) and label it `[bottom-up estimate, CS: 40–55]`."

---

## STEP 3A — QUANTITATIVE MODELING (quant-analyst, loads m1 + m2)

**Task:** Build probability distributions for the key market scenarios identified in Phase 2's opportunity signals.

For each major opportunity signal (OSS-001 through OSS-N, prioritized by CS from Phase 2):
```
PROBABILITY MODEL
=================
Opportunity signal:    [OSS-ID and description]
Model type:            [Bayesian update / Monte Carlo / frequency distribution]
Base rate:             [what is the historical success rate for market entry in similar contexts?]
P(opportunity real):   [probability that this opportunity exists as described — with CI]
P(accessible):         [probability that the product as-built can access this opportunity]
P(first-mover viable): [probability that timing allows meaningful entry before saturation]
Combined P:            [P(real) × P(accessible) × P(first-mover viable) = P(entry success)]
Uncertainty range:     [95% CI for the combined estimate]
Sensitivity:           [which assumption, if wrong, changes the estimate most?]
```

Produce this model for the top 5 OSS signals by Phase 2 confidence score.

---

## STEP 3B — RISK QUANTIFICATION (risk-modeler, loads m4)

**Task:** Apply FMEA and risk probability modeling to the risk signals (RSS-001 through RSS-N) from Phase 2.

For each risk signal:
```
RISK QUANTIFICATION
====================
Risk signal:           [RSS-ID and description]
Severity (1–10):       [impact if this risk materializes]
Occurrence (1–10):     [probability of this risk materializing in 24 months]
Detectability (1–10):  [how early can this risk be detected before full impact?]
RPN:                   [Severity × Occurrence × Detectability]
P(materialize, 12mo):  [probability within 12 months — with CI]
P(materialize, 36mo):  [probability within 36 months — with CI]
Correlated risks:      [any other RSS signals that amplify this one if both occur]
```

Specific risk to always model for this domain: **competitive saturation risk** — what is the probability that a well-funded competitor introduces a directly competing product within 18 months? Source: VC investment data in this category, product launch frequency in the last 24 months.

---

## STEP 4 — BEHAVIORAL VALIDATION (behavioral-analyst, loads m6)

**Task:** Validate the buyer psychology maps from Phase 1 (F5 outputs) against established behavioral economics research.

For each buyer psychology map in Phase 2:
```
BEHAVIORAL VALIDATION
======================
Persona:               [from Phase 1 F5 work]
Claimed emotional trigger: [what Phase 1 identified]
Behavioral pattern match:  [which established cognitive pattern or bias this aligns with]
Source:                [peer-reviewed behavioral economics source for this pattern]
Evidence strength:     [strong / moderate / weak — with explanation]
Domain applicability:  [does the research apply to B2B software buyers specifically, or only broader?]
Caveat:                [any condition under which this pattern does NOT apply to this persona]
```

Key behavioral patterns to always check for this domain:
- **Status quo bias**: how strong is the inertia keeping buyers with current tools?
- **Loss aversion vs. gain framing**: does "protect your data" outperform "unlock your productivity" for this persona?
- **Social proof sensitivity**: how much does this audience rely on peer testimony vs. independent evaluation?
- **Effort justification**: will this audience resist low-friction tools because they signal low value?
- **Sunk cost in current tools**: what investment (time, data, workflows) has the buyer already made in competitors?

---

## STEP 5 — SCENARIO DECISION MODEL (decision-modeler, loads m7)

**Task:** Build a structured decision model for market entry — presenting the mathematical structure of the choices, not a recommendation.

```
MARKET ENTRY DECISION TREE
============================
Option A: [enter as product X targeting segment Y with channel Z]
  P(success, 12mo):      [probability-weighted outcome]
  EV (12mo):             [expected value in revenue or user count]
  P10 / P50 / P90:       [pessimistic / base / optimistic scenarios]
  Key uncertainty:       [what single variable changes this most?]

Option B: [enter as product X targeting segment W with channel V]
  [same structure]

Option C: [enter as product X targeting segments Y + W simultaneously]
  [same structure — include the complexity cost of simultaneous multi-segment entry]

Multi-criteria comparison:
  Speed to first revenue:   A vs B vs C
  Capital efficiency:       A vs B vs C
  Competitive risk exposure: A vs B vs C
  Long-term market position: A vs B vs C
```

The decision model output goes directly into Phase 4 as the starting structure for the simulation.

---

## STEP 6 — SYNTHESIS (lead-stats, loads synthesis/)

Run the cross-module integrity check:

```
STATS INTEGRITY CHECK
======================
[ ] All market data points have trust tier + confidence score
[ ] No point estimate without uncertainty range
[ ] All probability claims show P(event) = X% [CI: low–high%]
[ ] T4/T5-only claims are flagged and not used as primary evidence
[ ] Divergences between Phase 1 estimates and sourced data are flagged
[ ] Behavioral validation completed for all Phase 1 buyer psychology claims
[ ] Decision model covers minimum 2 market entry options
[ ] All CSL items from Phase 2 are explicitly addressed (not resolved, but quantified)
```

PHASE-3-STATS package must contain:
1. Market data validation table (all claims, sources, trust tiers, CS scores, uncertainty ranges)
2. Probability models for top 5 opportunity signals
3. Risk quantification table for all risk signals (RPN + P(materialize))
4. Behavioral validation summary
5. Decision tree with P10/P50/P90 scenarios
6. Lead-stats confidence assessment: overall statistical picture quality (strong / adequate / data-thin)
7. Data gaps list: what we could not validate because T1/T2 sources do not exist yet — these become field research priorities

---

## HANDOFF TO PHASE 4

Hand PHASE-3-STATS to the simulation phase leads (decision-modeler + strategist from business team) along with:
- The decision tree (item 5)
- The top 5 OSS probability models (item 2)
- The behavioral validation summary (item 4)
- The data gaps list (item 7) — so the simulation knows what it is working without

---

## WHAT THIS PHASE DOES NOT DO

- Does not produce market entry recommendations — that is the simulation
- Does not evaluate the product's features — that is Business Strategy Destructuring (/destructuring-business)
- Does not analyze the user's own business performance data — scope rule applies
- Does not resolve contradictions between sources — surfaces all conflicts with both sources cited
- Does not produce a single number for any market claim — always a range with confidence level
