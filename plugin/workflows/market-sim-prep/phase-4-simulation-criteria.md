# Phase 4 — Market Simulation Criteria
Leads: decision-modeler (stats team) + strategist (business team)
Input: PHASE-3-STATS package + PHASE-2-OUTPUT
Output: SIMULATION-OUTPUT package → Business strategy destructuring agents (/destructuring-business)

---

## OBJECTIVE

Simulate how the market would actually behave when this product enters it. Not what we hope. Not the pitch. What the market does — the responses, the resistances, the unexpected vectors, the segment that converts when we thought another one would.

This is not a plan. It is a stress test of every assumption the prior three phases built.

---

## WHAT A MARKET SIMULATION IS (AND IS NOT)

**It IS:**
- A structured behavioral model of how multiple audience segments respond to a specific product entering their world
- A set of adoption scenarios (P10/P50/P90) per segment, grounded in Phase 3 probability work
- A competitive response model: what do existing players do when this product enters?
- A sensitivity analysis: which single variable, if wrong, collapses the entry?
- A friction map: where does adoption slow, stall, or reverse?

**It is NOT:**
- A revenue forecast (that requires validated CAC/LTV from Business Strategy Destructuring, which comes after)
- A marketing plan
- A go/no-go decision (the simulation informs the decision; it does not make it)
- A single scenario presented as the plan (always P10/P50/P90 — never P50-only)

---

## SIMULATION ARCHITECTURE

The simulation models four forces simultaneously for each segment being evaluated:

```
FORCE 1: PULL FORCES (toward adoption)
  → How strong is the pain this product relieves?
  → How visible is the solution (does the persona know to look for this)?
  → How immediate is the relief (time-to-value after first use)?
  → How strong is the identity shift (who does the persona become by using it)?

FORCE 2: FRICTION FORCES (against adoption)
  → How much effort does adoption require (installation, learning, behavior change)?
  → How strong is the status quo bias (what are they giving up)?
  → How large is the sunk cost in current tools?
  → How high is the price barrier relative to perceived value?

FORCE 3: COMPETITIVE FORCES (alternatives capturing the same buyer)
  → Who else addresses this pain? How much better/worse are they?
  → What is the probability a well-funded competitor moves into this space within 12 months?
  → What is the switching cost from the most likely incumbent?
  → What is the word-of-mouth velocity in this segment (network effects / community tightness)?

FORCE 4: AMPLIFIER FORCES (forces that accelerate adoption beyond organic)
  → Are there regulatory or deadline tailwinds that create urgency?
  → Are there community or platform effects that spread word-of-mouth?
  → Is there a specific event or moment (product launch, news cycle, annual period) that concentrates attention?
  → Does early adopter success produce visible social proof that accelerates the next wave?
```

---

## SIMULATION CRITERIA — WHAT EACH SEGMENT MODEL MUST PRODUCE

For each audience segment identified in Phase 1 and validated in Phases 2–3, produce:

```
SEGMENT SIMULATION MODEL
=========================
Segment ID:            [persona name from Phase 1]
Population (TAM):      [validated by Phase 3 with trust tier + CS]
Pull force composite:  [weighted score 1–10, derived from Phase 1 F5 + Phase 3 behavioral]
Friction force composite: [weighted score 1–10, derived from Phase 1 R1 + Phase 3 behavioral]
Net force vector:      [Pull minus Friction — positive = tailwind; negative = headwind]
Competitive pressure:  [low / medium / high — from Phase 2 R2 + Phase 3 risk model]
Amplifier presence:    [list any active amplifiers for this segment right now]

ADOPTION CURVE MODELING:
  Category stage:      [from Phase 3 m5 — early adopter / early majority / late majority]
  Adoption S-curve fit: [which diffusion model applies: Rogers / Bass / Epidemic]

  P10 scenario (pessimistic):
    Assumption set:    [what is wrong / harder than expected in P10]
    Adoption rate:     [% of reachable SAM in 12 months]
    Trigger to reach P10 from P50: [what single thing causes this?]

  P50 scenario (base):
    Assumption set:    [what must be true for the base case]
    Adoption rate:     [% of reachable SAM in 12 months]
    Conversion chain:  [awareness → trial → activation → retention — % at each step]

  P90 scenario (optimistic):
    Assumption set:    [what goes right in P90 that isn't guaranteed]
    Adoption rate:     [% of reachable SAM in 12 months]
    Amplifier required: [what additional force is needed to reach P90?]

SENSITIVITY ANALYSIS:
  Variable 1 (most sensitive): [name it] → if wrong by [X], moves from P50 to P10
  Variable 2:                  [name it] → if wrong by [Y], moves from P50 to P10

COMPETITIVE RESPONSE MODEL:
  Most likely response (12mo): [what does the strongest competitor do?]
  P(this response):           [probability — from Phase 3 risk model]
  Impact on adoption:         [reduces P50 adoption by ~X%]
  Counter-signal:             [what in our product makes this response ineffective?]
```

---

## CROSS-SEGMENT COMPARISON

After individual segment simulations are complete, run the cross-segment comparison:

```
SEGMENT RANKING TABLE
======================
For each segment: Pull score / Friction score / Net vector / Adoption P50 / Competitive pressure / Amplifier availability

Ranking criteria (in order of priority):
  1. Net force vector (highest positive = most natural market pull)
  2. Adoption rate P50 (highest reachable SAM %)
  3. Competitive pressure (lowest pressure = clearest lane)
  4. Time-to-P50 adoption (fastest = most cash-efficient)

Output: ordered ranking of segments by simulation performance — NOT a recommendation.
The ranking informs; the operator decides.
```

---

## SOVEREIGNTY DIMENSION — SPECIFIC SIMULATION REQUIREMENT

For products in the Optimaeus portfolio (AgentHub, Optimaeus, Opeidos), always run a specific sovereignty dimension check:

```
SOVEREIGNTY SIGNAL TEST
========================
Question 1: For each segment — is sovereignty a PURCHASE DRIVER or a PURCHASE FILTER?
  Purchase driver: the persona actively seeks sovereignty; will not buy cloud-first alternatives
  Purchase filter: the persona accepts sovereignty as a positive differentiator, but it is not the primary motivation

Question 2: What % of each segment's TAM is reachable with a sovereignty-PRIMARY message vs. a capability-PRIMARY message?
  Estimated ratio: [driver %] vs. [filter %]
  Source: Phase 3 behavioral model

Question 3: Is there a regulatory event (EU AI Act, GDPR enforcement action, specific sector mandate) that converts sovereignty from FILTER to DRIVER for a specific segment within 12 months?
  Yes / No — with timing and probability if Yes

Simulation adjustment:
  Segments where sovereignty = driver: amplifier force score +2
  Segments where sovereignty = filter: no adjustment (capability must lead)
  Segments where a regulatory event converts filter → driver within 12mo: amplifier force score +1 now, +2 when event fires
```

---

## GLOBAL TREND CROSS-CHECK

Before finalizing the simulation output, cross-check the segment models against the 5 global macro forces most relevant to these products:

**Force 1 — AI adoption acceleration** (2024–2026): mainstream AI usage is growing at 35–50% YoY across professional categories. What does this mean for each segment's baseline adoption rate? Does the simulation already account for this tailwind?

**Force 2 — AI tool fatigue and consolidation**: buyers who adopted 3–6 AI tools in 2023–2024 are now consolidating. They will not add a 7th tool unless it clearly replaces multiple. Does the product eliminate a tool from the buyer's stack, or add to it? Elimination = tailwind; addition = friction.

**Force 3 — Sovereignty as growing concern**: not yet a purchase driver for most; will be within 36 months as regulation and incidents accumulate. The simulation should model the segment's current state AND a 24-month forward state where sovereignty concern is +30% higher.

**Force 4 — LLM commoditization**: the quality gap between local/sovereign models and frontier cloud models is closing at approximately 18-month intervals. Products that require frontier models to function are more vulnerable to this force than products that work with any model. Rate each product's exposure: high / medium / low.

**Force 5 — Productivity ROI pressure**: companies and individuals are scrutinizing AI tool ROI more than in 2023. A tool must demonstrate measurable time or cost savings within the first 30 days to survive the review cycle. Does each segment simulation account for the 30-day activation threshold?

---

## SIMULATION OUTPUT PACKAGE (SIMULATION-OUTPUT)

The SIMULATION-OUTPUT delivered to the business strategy destructuring agents must contain:

```
SIMULATION-OUTPUT CHECKLIST
============================
[ ] Segment simulation models for ALL segments from Phase 1 (minimum 8)
[ ] Cross-segment ranking table
[ ] Sovereignty signal test for each segment
[ ] Global trend cross-check completion confirmation
[ ] Top 3 segments by simulation performance (named, not recommended)
[ ] The 3 highest-sensitivity variables across all segments
[ ] Competitive response models for the top 3 segments
[ ] Decision-modeler assessment: which scenario assumptions are most fragile?
[ ] Strategist assessment: "What did this simulation reveal that our prior intuition missed?"
[ ] DATA GAPS NOTE: list any findings based on T4/T5 sources only — flag for post-validation
```

---

## HANDOFF TO BUSINESS STRATEGY DESTRUCTURING

When SIMULATION-OUTPUT is complete, the business strategy destructuring agents receive (via /destructuring-business):

- SIMULATION-OUTPUT (full package)
- PHASE-3-STATS (for unit economics base rates)
- The top 3 segments ranked by simulation performance (as starting context for Market Position agent)

The destructuring agents run REVERSE from this point: they know the market now. They are engineering the offer, the acquisition channel, the economics, and the monetization for a specific audience that the simulation has validated. This is not the same as running business strategy destructuring on intuition. The validation changes everything.

---

## WHAT THIS PHASE DOES NOT DO

- Does not produce a go-to-market plan — that follows Business Strategy Destructuring
- Does not make a product prioritization decision — that is the operator's call after seeing the simulation
- Does not set a launch date — the simulation informs timing; it does not dictate it
- Does not replace market testing with real buyers — it is a pre-launch model, not a substitute for real signal
- Does not present a single scenario as the plan — always P10/P50/P90
