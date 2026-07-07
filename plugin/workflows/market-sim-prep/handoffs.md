# Handoff Protocols — Market Intelligence Pre-Simulation Workflow

This file defines exactly what passes between phases. Every handoff is a contract: the sending phase guarantees specific outputs; the receiving phase can rely on them without re-verifying.

---

## HANDOFF 1: BUSINESS → DATA (Phase 1 → Phase 2)

**Sender:** lead-business
**Receiver:** lead-data
**Trigger:** Gate 1 passes (all checklist items in Phase 1 complete)

**Package contents:**
```
PHASE-1-OUTPUT/
  personas/          — 8+ persona cards (R1 format)
  competitors/       — 6+ competitor cards (R2 format)
  market-map.md      — TAM/SAM/SOM + growth rate + white space (R3 format)
  macro-forces.md    — Regulatory / economic / tech / social + geo signals (R4/R5)
  segment-scan.md    — 3+ additional segment descriptions (F3)
  buyer-psychology/  — Psychology maps for top 5 personas (F5 format)
  ceo-review.md      — ceo-advisor final assessment
  csl-items.md       — All conflict/contradiction flags from Phase 1
  open-questions.md  — Top 3 questions Phase 1 could not answer
```

**Gate 1 check (lead-business runs before handing off):**
- [ ] Minimum 8 persona cards complete with pain language sourced from real buyer content
- [ ] Minimum 6 competitor cards complete (including at least 1 free tool with large user base)
- [ ] Market map has at least 1 TAM estimate with source named
- [ ] Geographic scope confirmed (which geo tracks were activated)
- [ ] ceo-advisor has reviewed — no veto outstanding
- [ ] All CSL items documented in csl-items.md

If any item fails: do not hand off. Fix first.

---

## HANDOFF 2: DATA → STATS (Phase 2 → Phase 3)

**Sender:** lead-data
**Receiver:** lead-stats
**Trigger:** Gate 2 passes (all records deposited, opportunity + risk analysis complete)

**Package contents:**
```
PHASE-2-OUTPUT/
  deposit-confirmation.md    — record IDs, index updated confirmation
  opportunity-signals.md     — all OSS cards with CS scores
  risk-signals.md            — all RSS cards with severity/probability estimates
  csl-resolution.md          — all Phase 1 CSL items now classified as opportunities or risks
  cross-session.md           — prior session findings (confirmations + new contradictions)
  open-questions-for-stats.md — minimum 5 specific questions for Phase 3 (the stats work agenda)
  lead-data-assessment.md    — research quality rating + recommended Phase 3 focus
```

**Gate 2 check (lead-data runs before handing off):**
- [ ] All Phase 1 outputs deposited as records in memory/records/
- [ ] memory/index.md updated with all new record IDs
- [ ] Minimum 5 opportunity signals (OSS cards) with CS scores
- [ ] All Phase 1 risk signals classified and RSS cards created
- [ ] All Phase 1 CSL items appear in risk-signals.md as [contradiction] type
- [ ] Open questions list has minimum 5 specific, answerable questions for Phase 3

If any item fails: do not hand off. Fix first.

---

## HANDOFF 3: STATS → SIMULATION (Phase 3 → Phase 4)

**Sender:** lead-stats
**Receiver:** decision-modeler (stats) + strategist (business team)
**Trigger:** Gate 3 passes (integrity check complete, all outputs produced)

**Package contents:**
```
PHASE-3-STATS/
  market-data-validation.md     — all claims with trust tier + CS + uncertainty range
  probability-models/           — top 5 OSS probability models (P(entry success))
  risk-quantification.md        — all RSS cards with RPN + P(materialize 12mo/36mo)
  behavioral-validation.md      — buyer psychology validated against behavioral economics
  decision-tree.md              — P10/P50/P90 scenarios for minimum 2 entry options
  lead-stats-assessment.md      — overall data quality + data gaps list
  data-gaps.md                  — findings that rest on T4/T5 only — flagged for monitoring
```

**Gate 3 check (lead-stats runs before handing off):**
- [ ] All market data points have trust tier + CS + uncertainty range — no exceptions
- [ ] No point estimate without range anywhere in the package
- [ ] Probability models complete for top 5 OSS signals
- [ ] Behavioral validation covers all Phase 1 buyer psychology claims
- [ ] Decision tree has minimum 2 entry options with P10/P50/P90 each
- [ ] All T4/T5-only findings flagged in data-gaps.md

If any item fails: do not hand off. Fix first.

---

## HANDOFF 4: SIMULATION → BUSINESS STRATEGY DESTRUCTURING (Phase 4 → destructuring agents)

**Sender:** decision-modeler + strategist
**Receiver:** Business strategy destructuring agents (Market Position → Offer Architect → Acquisition Analyst → Unit Economics → Monetization Architect) — run /destructuring-business
**Trigger:** Gate 4 passes (all segment simulations complete, cross-segment comparison done)

**Package contents:**
```
SIMULATION-OUTPUT/
  segment-models/              — full simulation model for each persona segment
  cross-segment-ranking.md     — ranked table (NOT a recommendation)
  sovereignty-signal-test.md   — sovereignty as driver vs. filter per segment
  global-trends-check.md       — 5 forces cross-check results
  competitive-response/        — competitor response models for top 3 segments
  sensitivity-analysis.md      — top 3 most sensitive variables across all segments
  decision-modeler-note.md     — which assumptions are most fragile
  strategist-note.md           — what the simulation revealed that intuition missed
  data-gaps-inherited.md       — carried forward from Phase 3 gaps list
```

**Gate 4 check (decision-modeler + strategist run jointly before handing off):**
- [ ] Segment simulations complete for ALL personas from Phase 1 (minimum 8)
- [ ] Cross-segment ranking table complete
- [ ] Sovereignty signal test complete for all segments
- [ ] Global trends cross-check complete (all 5 forces addressed)
- [ ] Competitive response models for top 3 ranked segments
- [ ] Data gaps list carried forward
- [ ] Both decision-modeler and strategist notes present

If any item fails: do not hand off. Fix first.

---

## HANDOFF 5: BUSINESS STRATEGY DESTRUCTURING → SIMULATION (Phase 5 → Phase 6)

**Sender:** Business strategy destructuring agent team (offer-architect, acquisition-analyst, unit-economics, market-position, monetization-architect) — /destructuring-business
**Receiver:** decision-modeler (stats) + strategist (business) + positioning-expert
**Trigger:** Gate 5 passes — business strategy destructuring offer is complete and confirmed by human

**Package contents:**
```
BUSINESS-STRATEGY-OUTPUT/
  offer-tiers.md            — complete tiered offer ladder with pricing per tier
  acquisition-map.md        — channels per persona segment, with cost estimates
  unit-economics.md         — LTV, CAC, payback period, margin per tier
  market-position.md        — niche definition, differentiation statement, competitive moat
  monetization-model.md     — pricing architecture, upsell logic, churn assumptions
  strategy-notes.md         — which assumptions are most critical to test in Phase 6 simulation
```

**Gate 5 check (strategist runs before handing off to simulation):**
- [ ] Tiered offer ladder is complete with at least 2 distinct tiers
- [ ] Each tier has a defined price point with reasoning grounded in Phase 3 benchmarks
- [ ] Acquisition map covers at least the top 3 persona segments from Phase 1
- [ ] Unit economics table is complete (LTV / CAC / payback / margin)
- [ ] Market position statement is specific — not generic differentiation
- [ ] Strategy notes identify which assumptions most need simulation testing

If any item fails: do not hand off to simulation. Fix first.

---

## BUSINESS STRATEGY INPUT CONTRACT (Phase 4 → Phase 5)

When the Business Strategy Destructuring Market Position agent receives the PHASE-4-PREOFFER package, it does not start from scratch. It starts from the cross-segment opportunity ranking and the validated intelligence brief. Specifically:

- **Market Position agent** starts with the top-ranked segment from Phase 4 and runs its niche criteria test against the validated data (not raw assumptions)
- **Offer Architect** uses Phase 3's behavioral validation of buyer psychology to anchor the dream outcome — if the psychology does not match, the promise is wrong
- **Acquisition Analyst** maps channels against the segment's discovery channel (from Phase 1 persona cards) AND the behavioral social proof sensitivity (from Phase 3)
- **Unit Economics** uses Phase 3's market benchmarks (average contract value, churn rate benchmarks) instead of categorical estimates
- **Monetization Architect** uses Phase 4's competitive synthesis to evaluate whether the proposed ladder will survive the incumbent's counter-move

---

## SIMULATION INPUT CONTRACT (Phase 5 → Phase 6)

When the simulation team receives the BUSINESS-STRATEGY-OUTPUT package, it does not build scenarios from scratch. It tests the engineered offer against real human situations. Specifically:

- **Scenario construction** starts from the business strategy destructuring offer tiers — each scenario assigns a specific tier to the buyer
- **Geo buying psychology** comes from Phase 1 G-track profiles — not invented in Phase 6
- **Persona cards** come from Phase 1 R1 research — not recreated in Phase 6
- **Market trend context** comes from Phase 3 validated signals — not assumed in Phase 6
- **P(convert) estimates** are grounded in Phase 3 behavioral validation — informed by cultural psychology profiles, not just statistics
- **strategy-notes.md** from Phase 5 defines which assumptions Phase 6 must specifically test

The simulation tests whether the destructured business strategy offer lands in reality. Without Phase 5, there is nothing to test. Without Phase 1 geo psychology, the scenarios invent behavior. Without Phase 3 behavioral validation, the probabilities are guesses.

---

## FAILURE MODES AND RECOVERY

**If Phase 1 output is thin (fewer than 8 personas, sparse competitor research):**
Do not proceed to Phase 2. Return to Phase 1 with specific gaps named. A thin Phase 1 produces unreliable Phase 2 patterns and uncalibratable Phase 3 statistics. The simulation will be built on air.

**If Phase 3 cannot find T1/T2 sources for a key market claim:**
Proceed with the bottom-up estimate (labeled T4/CS: 40–55) and flag it prominently in the data-gaps.md. The simulation must widen its uncertainty range for any model built on this claim. The Phase 4 P10 scenario must account for the data gap by widening the pessimistic bound.

**If the simulation produces negative net force vectors for ALL segments:**
Do not proceed to Business Strategy Destructuring. This is a signal that the product-market fit assumption needs revisiting at the product level, not the offer level. Business strategy destructuring cannot engineer an offer that the market consistently pushes back against. Return to the app rationale evaluation before continuing.

**If the simulation produces P50 adoption rates below 0.1% of SAM for all segments:**
Flag and escalate. Below 0.1% in 12 months across all segments suggests either a misidentified SAM, a product capability mismatch with the market, or a launch strategy gap that business strategy destructuring alone cannot close. Name the specific cause before proceeding.
