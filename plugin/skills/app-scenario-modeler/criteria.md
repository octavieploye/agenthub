# App Scenario Modeler — Evaluation Criteria

A complete scenario model passes all gates below. lead-scenario must self-check before writing output files.

## Gate 1 — Coverage
- [ ] All 6 discovery categories addressed (happy path, input variation, concurrency, state conflict, external failure, security)
- [ ] Minimum 8 scenarios for any non-trivial feature
- [ ] At least 1 scenario per category
- [ ] If CASCADE_RISK = yes: at least 3 cascade scenarios (Sc1..Scn)

## Gate 2 — Classification Integrity
- [ ] Every scenario has a Tier label (CORE / SECONDARY / EDGE / FRINGE)
- [ ] P_use reasoning stated for each — not arbitrary
- [ ] Cascade scenarios classified as SECONDARY or higher

## Gate 3 — Scenario Matrix Completeness
- [ ] Every scenario has: trigger, workflow, desired outcome, positive case, negative case, risk level, P_occurrence, P_failure, constraint hit
- [ ] No empty fields
- [ ] Negative case is specific — names exact failure mode and user-visible symptom
- [ ] Workflow steps use → chaining

## Gate 4 — Constraint Mapping
- [ ] Every constraint has a hard limit value (not vague — "p95 > 2s" not "slow")
- [ ] Every CRITICAL scenario maps to at least one constraint
- [ ] If user data involved: PII fields and retention policy stated
- [ ] Scenarios stressing multiple constraints simultaneously flagged

## Gate 5 — CORE Optimisation
- [ ] Every CORE scenario has an optimised workflow (not naive path)
- [ ] Long-term stack choice stated with reasoning
- [ ] At least one monitoring signal named per CORE scenario
- [ ] Failure resilience pattern stated (retry / idempotency / circuit breaker)

## Gate 6 — Edge Case Decisions
- [ ] Every EDGE/FRINGE scenario has Expected_impact calculated
- [ ] Decision stated with reasoning (IMPLEMENT / DEFER / MONITOR / SKIP / ESCALATE)
- [ ] No CRITICAL + FRINGE scenario marked SKIP without user sign-off
- [ ] Priority matrix ranks all scenarios by Expected_impact desc

## Gate 7 — Cascade File (when CASCADE_RISK = yes)
- [ ] Every cascade scenario has full chain mapped (Step 1 → Step 2 → ... → terminal)
- [ ] Happy cascade and overflow cascade both described
- [ ] Overflow fallback stated
- [ ] Non-technical user interaction described (what they see, what they choose)

## Quality Signals

**Good model:**
- Surprises reader with at least one scenario they hadn't considered
- Different stack recommendations for CORE vs EDGE tiers
- Risk Register has fewer than 6 items — calibrated, not inflated
- Cascade file shows exact time/capacity overflow point

**Weak model:**
- All scenarios are CORE
- All risk levels are the same
- Negative cases say "returns error" without specifics
- No concurrency or security scenarios present
- Cascade mapped as a single scenario rather than a chain
