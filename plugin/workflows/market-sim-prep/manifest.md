# MANIFEST — Market Intelligence Pre-Simulation Workflow
Version: 1.0
Trigger: Run at the start of any new product, offer, or market-entry initiative — BEFORE running /destructuring-business or any offer/positioning framework.
Output: A validated, statistically anchored intelligence package that feeds the Market Simulation and then Business Strategy Destructuring.

---

## PURPOSE

This workflow answers the question no offer framework can answer by itself:
**"Who is actually out there, what do they actually feel, and what does the market actually do when a product like this appears?"**

Business Strategy Destructuring (/destructuring-business) tells you how to engineer an offer once you know the market. This workflow tells you what the market is — and then, after the offer exists, simulates how it lands in specific human situations across specific countries and cultures.

The sequence is non-negotiable:
```
[Phase 1] Business Research Team          → Foundation layer + geo buying psychology
          ↓
[Phase 2] Data Analysis Team              → Structured intelligence package
          ↓
[Phase 3] Stats & Signals Team            → Quantitative validation + probability bounds
          ↓
[Phase 4] Pre-Offer Intelligence          → Cross-segment synthesis and opportunity ranking for Business Strategy Destructuring
          ↓
[Phase 5] Business Strategy Destructuring → Offer engineered on validated market reality (/destructuring-business)
          ↓
[Phase 6] Market Simulation               → 5–10 scenarios: real people, real countries, real cultural psychology
```

No step substitutes for a prior step. Stats without research produces numbers without ground. Research without stats produces narrative without probability. Business Strategy Destructuring without market intelligence produces offers built on assumptions. Simulation without a real offer produces scenarios that test nothing.

**Simulation is Phase 6 — not Phase 4.**
Phase 4 is pre-offer intelligence synthesis: it prepares the package that Business Strategy Destructuring needs. The simulation runs after the offer has been engineered via /destructuring-business, stress-testing it across real human situations in real countries with real cultural psychology about what spending money means.

---

## TEAM ASSIGNMENT

| Phase | Lead | Teammates | Max active simultaneously |
|---|---|---|---|
| 1 — Business Research | lead-business | market-researcher → business-analyst → strategist → positioning-expert | 3 |
| 2 — Data Analysis | lead-data | data-architect → opportunity-analyst + risk-analyst (parallel) | 3 |
| 3 — Statistical Validation | lead-stats | market-stats-researcher → quant-analyst + risk-modeler (parallel) → behavioral-analyst → decision-modeler | 3 |
| 4 — Pre-Offer Intelligence | lead-data + lead-business | opportunity-analyst, strategist, positioning-expert | 3 |
| 5 — Business Strategy Destructuring | lead-business (strategist) | destructuring agents: market-position → offer-architect → acquisition-analyst → unit-economics → monetization-architect (/destructuring-business) | 3 |
| 6 — Market Simulation | decision-modeler (stats) + strategist (business) + positioning-expert | scenario-modeler | 3 |

---

## TRIGGER CONDITIONS

Run this workflow when:
- A new product, offer, or service is being evaluated for market entry
- An existing product is being repositioned for a new audience or geography
- A pricing model change is under consideration
- A major strategic decision requires market validation before committing resources

Do NOT run this workflow for:
- Pure technical decisions (no market dimension)
- Internal tooling with no external audience
- Decisions already validated by a recent (< 90 days) completed run of this workflow on the same market

---

## INPUT REQUIRED TO START

Before Phase 1 begins, the operator must provide:

```
WORKFLOW INPUT BRIEF
====================
Product/Service:       [name and 1-sentence description]
Market territories:    [which geo tracks to activate: FR / EU / US / GLOBAL]
Known audiences:       [list ALL personas you believe could benefit — do not filter yet]
Known competitors:     [any you are already aware of — partial is fine]
Primary question:      [the one question this workflow must answer]
Secondary questions:   [up to 3 additional questions]
Time constraint:       [how many sessions/hours available for this workflow]
Prior research:        [any data-team records from previous sessions on related topics]
```

This brief is passed to lead-business at the start of Phase 1 and to lead-data at the start of Phase 2.

---

## LOAD ORDER — MASTER SEQUENCE

### Phase 1 (Business Research)
1. lead-business loads `market-sim-prep/phase-1-business-research.md`
2. lead-business loads business workflow manifest + core/ modules
3. Run REVERSE mode (R1→R5): start from what is known about the product/niche
4. Run FORWARD supplemental (F3 market segments + F5 buyer psychology minimum)
5. Run G-TRACK: for each activated geographic territory, research how that market buys — cultural buying psychology, trust signals, price relationship, emotional triggers, red flags
6. lead-business synthesizes → passes `PHASE-1-OUTPUT` (including geo buying psychology profiles) to lead-data

### Phase 2 (Data Analysis)
1. lead-data loads `market-sim-prep/phase-2-data-analysis.md`
2. lead-data loads memory/README.md + memory/index.md
3. data-architect runs deposit protocol on Phase 1 output
4. opportunity-analyst + risk-analyst run in parallel on deposited records
5. lead-data synthesizes → passes `PHASE-2-OUTPUT` to lead-stats

### Phase 3 (Statistical Validation)
1. lead-stats loads `market-sim-prep/phase-3-stats-validation.md`
2. lead-stats loads stats manifest + all 4 core/ modules
3. market-stats-researcher runs m5 (market research module) first
4. quant-analyst + risk-modeler run in parallel (m1+m2 / m4)
5. behavioral-analyst runs m6 (human/social context for buyer psychology)
6. decision-modeler runs m7 (EV framework for market entry scenarios)
7. lead-stats runs synthesis/ → passes `PHASE-3-OUTPUT` (confidence-scored statistical package)

### Phase 4 (Pre-Offer Intelligence)
1. Load `market-sim-prep/phase-4-pre-offer-intelligence.md`
2. lead-data + lead-business synthesize Phase 3 output into a clean intelligence package
3. Cross-segment opportunity ranking: which segments have highest potential, based on validated stats
4. Competitive synthesis: key threats and differentiation points per segment
5. Pre-destructuring brief: market benchmarks, pricing context, segment priority for Business Strategy Destructuring input
6. Produce `PHASE-4-OUTPUT` → passes to Phase 5 (Business Strategy Destructuring)

### Phase 5 (Business Strategy Destructuring)
1. Run `/destructuring-business` — takes PHASE-4-OUTPUT as primary intelligence input, not raw assumptions
2. Destructuring agents: market-position → offer-architect → acquisition-analyst → unit-economics → monetization-architect
3. The offer is engineered on validated market reality
4. Produce `BUSINESS-STRATEGY-OUTPUT` package → passes to Phase 6

### Phase 6 (Market Simulation)
1. Load `market-sim-prep/phase-6-simulation.md`
2. Compile geo buying psychology profiles for every activated geographic track (from Phase 1 G-track)
3. Build 5–10 scenario cards: each scenario = specific persona + country + pricing tier + market trend + recent event + economic situation + emotional trigger
4. For each scenario, simulate the full encounter: first reaction, objections, what closes, what loses, P(convert)
5. Run cross-scenario synthesis: stress-test map, cultural adaptation matrix, sequencing recommendation
6. Produce `SIMULATION-OUTPUT` → human reviews and confirms launch sequence

---

## OUTPUTS AND ARTIFACTS

Each phase produces a named output package deposited by the data team:

| Phase | Output name | Deposit location |
|---|---|---|
| 1 | `PHASE-1-RESEARCH-[product]-[date]` | memory/records/business/ |
| 2 | `PHASE-2-INTELLIGENCE-[product]-[date]` | memory/records/cross-session/ |
| 3 | `PHASE-3-STATS-[product]-[date]` | memory/records/business/ (stats section) |
| 4 | `PHASE-4-PREOFFER-[product]-[date]` | memory/records/business/ (pre-offer section) |
| 5 | `BUSINESS-STRATEGY-OUTPUT-[product]-[date]` | memory/records/business/ (business-strategy section) |
| 6 | `SIMULATION-OUTPUT-[product]-[date]` | memory/records/business/ (simulation section) |

---

## QUALITY GATES

A phase does not advance until its gate is passed.

**Gate 1 → Phase 2:** Phase 1 output contains: minimum 8 persona cards with pain in their own language; minimum 6 competitor cards; TAM estimate with source; geographic scope confirmed; geo buying psychology profile for each activated territory.

**Gate 2 → Phase 3:** Phase 2 output contains: all Phase 1 findings deposited with record IDs; at least 5 opportunity signals with CS scores; all CSL items classified; minimum 5 open questions for Phase 3.

**Gate 3 → Phase 4:** Phase 3 output contains: all market data with trust tier + confidence score + uncertainty range; probability models for top 5 opportunity signals; behavioral validation; decision tree with P10/P50/P90 for minimum 2 entry options.

**Gate 4 → Phase 5 (Business Strategy Destructuring):** Pre-offer intelligence output contains: cross-segment opportunity ranking; competitive synthesis; pricing context benchmarks from Phase 3; clear intelligence brief for destructuring agents.

**Gate 5 → Phase 6 (Simulation):** Business Strategy Destructuring output contains: complete offer with tiered ladder; acquisition channel map; unit economics; monetization model. The offer must be confirmed before simulation runs.

**Gate 6 → Human review:** Simulation output contains: minimum 5 scenario cards (all fields complete); cross-scenario synthesis (all 5 sections); sequencing recommendation with reasoning; at least 1 scenario with P(convert) below 30%.

---

## ANTI-PATTERNS — WHAT THIS WORKFLOW PROHIBITS

- Skipping Phase 1 because "we already know the market" — you know what you believe about the market. The workflow finds what is actually true.
- Running Phase 3 stats on Phase 1 data directly (without Phase 2 data structuring) — unstructured research produces unreliable statistics.
- Applying business strategy destructuring to a single audience segment before the simulation has compared multiple segments — the simulation exists to find the highest-response segment, not to confirm the pre-selected one.
- Treating a P50 adoption scenario as a plan — it is the midpoint of a range. P10 is what you must survive. P90 is what you must not over-commit to.
