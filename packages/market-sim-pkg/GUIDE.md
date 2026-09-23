# Market Intelligence Workflow — Field Guide

---

## Deploy into any project

```zsh
./add-to-project.sh /path/to/your-project
```

That's it. Slash commands and workflow files land in the project. Nothing else needed.

---

## The sequence — never skip, never reorder

```
Phase 1   Business Research + Geo Buying Psychology
          ↓ Gate 1
Phase 2   Data Analysis
          ↓ Gate 2
Phase 3   Statistical Validation
          ↓ Gate 3
Phase 4   Pre-Offer Intelligence
          ↓ Gate 4
Phase 5   [source] Offer Engineering
          ↓ Gate 5  ← offer must exist before simulation runs
Phase 6   Market Simulation  (5–10 scenarios, real countries, real psychology)
          ↓
     Human confirms launch sequence
```

[source] without Phase 1–4 = engineering an offer for an imagined market.
Simulation without Phase 5 = testing an offer that doesn't exist yet.

---

## Run it — two ways

**Slash commands (inside Claude Code session):**

| Command | What it does |
|---|---|
| `/market-sim-start` | Full workflow — collects INPUT BRIEF, runs all 6 phases |
| `/market-sim-p1` | Phase 1 only — business research + geo psychology |
| `/market-sim-p2` | Phase 2 only — data analysis |
| `/market-sim-p3` | Phase 3 only — statistical validation |
| `/market-sim-p4` | Phase 4 only — pre-offer intelligence package |
| `/market-sim-p5` | Phase 5 only — [source] offer engineering |
| `/market-sim-p6` | Phase 6 only — market simulation scenarios |

**CLI (automated, all 6 phases unattended):**

```zsh
# Full run — opens editor for INPUT BRIEF
./market-sim-run.sh myproduct

# Full run — brief already written
./market-sim-run.sh --brief brief.md myproduct

# Resume from a specific phase (outputs from earlier phases must exist)
./market-sim-run.sh --from 5 --run-dir .market-sim-runs/20260629-1400-myproduct
```

Outputs land in `.market-sim-runs/YYYYMMDD-HHMM-productname/` — one file per phase.

---

## INPUT BRIEF — fill this before Phase 1

```
WORKFLOW INPUT BRIEF
====================
Product/Service:       [name + one sentence]
Market territories:    [FR / DE / US / GLOBAL / specific countries]
Known audiences:       [list all — do not filter yet]
Known competitors:     [partial is fine]
Primary question:      [the one question this run must answer]
Secondary questions:   [up to 3]
Time constraint:       [sessions/hours available]
Prior research:        [any prior data-team records on this topic]
```

---

## Phase 1 — what it produces

- 8+ persona cards (pain in their own language, not product language)
- 6+ competitor cards (including free tools with large user base)
- Market map (TAM / SAM / SOM + source)
- Macro force scan (regulatory, economic, tech, geo signals)
- 3+ additional segments the brief didn't mention
- Buyer psychology maps for top 5 personas
- **Geo buying psychology profile for every activated territory** (G-track)

Gate 1 fails if: fewer than 8 personas, fewer than 6 competitors, no TAM source, no geo profiles.

---

## Phase 6 — the simulation (what it actually is)

Not probability bands. Not TAM percentages.

A scenario is: **a specific person, in a specific country, at a specific cultural moment, encountering the [source] offer for the first time** — with their full psychology modeled. First reaction. Objections in sequence. What closes them. What loses them. P(convert).

**Each scenario varies across 7 axes:**
- Persona (from Phase 1)
- Country / culture
- [source] offer tier (from Phase 5)
- Market trend context (from Phase 3)
- Recent event
- Economic situation (comfortable / constrained / growth / survival)
- Emotional trigger (what brought them here today)

**Required in every simulation run:**
- At least 1 EU-frame scenario (buying = spending, makes me poorer)
- At least 1 US-frame scenario (buying = investment, what's my ROI)
- At least 1 non-Western scenario
- At least 1 constrained-budget scenario
- At least 1 scenario where P(convert | offer as-is) is below 30%

Gate 6 fails if any of these are missing.

---

## Country buying psychology — what's built in

Phase 6 ships with profiles for all of these. Phase 1 G-track research deepens them for your specific product.

| Region | Covered |
|---|---|
| Western Europe | France, Germany, Nordics (SE/NO/DK/FI), Italy, Spain, Netherlands |
| Eastern Europe | Poland, Czech Republic, Hungary, Romania |
| Middle East | UAE, Saudi Arabia, Qatar |
| North Africa | Morocco, Algeria, Tunisia, Egypt |
| West/Central Africa | Nigeria, Ghana, Kenya |
| Southern Africa | South Africa |
| East Asia | Japan, South Korea, China |
| Southeast Asia | Singapore, Thailand, Vietnam, Indonesia, Malaysia |
| South Asia | India |
| Pacific | Australia |
| North America | United States |

**The divide that shapes everything:**

EU frame — buying = spending, makes me poorer, more work, more dependency. Proof burden on seller. Urgency tactics close the conversation.

US frame — buying = investment, opens opportunity. ROI framing. Pain of inaction is as powerful as gain framing.

Neither frame applies cleanly outside these two regions. Japan, India, Nigeria, Gulf States each have their own structural orientation. The profiles in Phase 6 name them explicitly.

---

## Gates — what each one checks

**Gate 1** (Phase 1 → 2): 8+ personas, 6+ competitors, TAM with source, geo psychology profiles for all activated territories.

**Gate 2** (Phase 2 → 3): All Phase 1 findings deposited with record IDs, 5+ opportunity signals with CS scores, all CSL items classified, 5+ open questions for Phase 3.

**Gate 3** (Phase 3 → 4): All data points have trust tier + confidence score + uncertainty range. No point estimate without range. Probability models for top 5 signals.

**Gate 4** (Phase 4 → 5): Cross-segment opportunity ranking complete, competitive synthesis complete, pricing benchmarks from Phase 3 included, clear intelligence brief for [source].

**Gate 5** (Phase 5 → 6): Tiered offer ladder with 2+ tiers, acquisition map for top 3 segments, unit economics complete, market position specific, [source] notes (what assumptions to test in simulation).

**Gate 6** (Simulation → Human): 5+ scenario cards all fields complete, no two scenarios vary on fewer than 3 axes, cross-scenario synthesis complete (all 5 sections), sequencing recommendation with reasoning.

A phase does not advance until its gate passes. Fix first, then hand off.

---

## What this workflow does not do

- Does not recommend a target market — the simulation produces a ranked output; human confirms
- Does not produce marketing copy — the cultural adaptation matrix in Phase 6 informs copy, it is not copy
- Does not replace [source] — Phase 5 engineers the offer; Phase 6 tests it
- Does not invent buyer behavior — all psychology traces to Phase 1 sourced research or Phase 6 built-in profiles (flagged `[estimated]` where thin)

---

## Update the package

Edit source files in `agenthub/market-sim-pkg/`. Re-run `add-to-project.sh` in any project to overwrite with the latest version.
