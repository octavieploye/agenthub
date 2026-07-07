# MODULE M7 — Decision Modeling Under Uncertainty

Agent: decision-modeler
Purpose: Structure decisions with probabilistic outcomes so clients can evaluate trade-offs clearly.

---

## When to Load

Load M7 as the final domain module — it consumes outputs from M1–M6.
Load when:
  - The user needs to compare two or more courses of action under uncertainty
  - Expected value calculations are needed
  - Scenario-based planning with probability weights is requested
  - A decision must be made with incomplete information

---

## Core Rule

This module NEVER recommends a decision.
It presents the mathematical structure of choices: outcomes, probabilities, and expected values.
The user decides. The team quantifies.

---

## Decision Tree Framework

### Structure

A decision tree has:
  - Decision nodes (squares): points where a choice is made
  - Chance nodes (circles): points where an outcome is determined by probability
  - Terminal nodes: final outcomes with assigned values

### Input Requirements

Before building a decision tree:
  1. List all decision options (from user or problem context)
  2. For each option, list possible outcomes from M4 (risk-modeler)
  3. For each outcome, source a probability from M2 (quant-analyst) or M4
  4. For each outcome, assign a value (financial or quantitative proxy)
  5. All probabilities at each chance node must sum to 1.0 — verify this

### Expected Value Calculation

  EV(option) = Σ [P(outcome_i) × Value(outcome_i)]

  Report for each option:
    EV = [calculated value]
    Variance = Σ [P(outcome_i) × (Value(outcome_i) − EV)²]
    SD = √Variance  (risk of this option)

### Decision Tree Output Format

  "DECISION TREE — [decision context]

   Option A: [description]
     Outcome 1: P = [X]% × Value = [Y] → Contribution: [P×Y]
     Outcome 2: P = [X]% × Value = [Y] → Contribution: [P×Y]
     EV(A) = [sum]  |  SD(A) = [value]

   Option B: [description]
     Outcome 1: P = [X]% × Value = [Y] → Contribution: [P×Y]
     Outcome 2: P = [X]% × Value = [Y] → Contribution: [P×Y]
     EV(B) = [sum]  |  SD(B) = [value]

   Comparison:
     Higher EV:        Option [A/B] by [difference]
     Lower risk (SD):  Option [A/B]
     EV-risk trade-off: [describe tension if EV-maximizing option is also higher risk]

   Source of probabilities: [cite M2/M4 outputs with T[x] CS]
   Key assumption: [most sensitive input — state what changes if it shifts by ±20%]"

---

## Scenario Analysis (P10/P50/P90)

For strategy or planning contexts where a full decision tree is not feasible:
  Define three probability-weighted scenarios:

  P10 (pessimistic / downside):
    Probability: ~10% chance outcome is this bad or worse
    Inputs: use adverse assumptions from M4 risk scenarios
    Outcome value: [quantified]

  P50 (base case):
    Probability: median expectation
    Inputs: use central estimates from M1/M3
    Outcome value: [quantified]

  P90 (optimistic / upside):
    Probability: ~10% chance outcome is this good or better
    Inputs: use optimistic-end estimates from M5 market research
    Outcome value: [quantified]

  Expected value = 0.25 × P10 + 0.50 × P50 + 0.25 × P90
  (weights can be adjusted with rationale — state adjustment and reason)

---

## Multi-Criteria Analysis (MCA)

Use when the decision involves multiple dimensions that cannot all be reduced to a single monetary value.

  Step 1 — Define criteria (e.g., financial return, risk exposure, speed, compliance burden)
  Step 2 — Weight criteria (user-defined weights that sum to 100%)
  Step 3 — Score each option on each criterion (1–10 scale, anchored by data where possible)
  Step 4 — Calculate weighted score for each option

  Output: "Option A scores [X/100] vs Option B [Y/100] on the stated criteria weighting."
  Caveat: "Criteria weights reflect the user's priorities — different weights produce different rankings."

---

## Sensitivity Analysis

For every EV or scenario output, test the single most impactful input:
  "SENSITIVITY CHECK — [key variable]
   Base case assumption: [value] → EV = [X]
   If [variable] changes by −20%: EV = [Y]  (change: [Z])
   If [variable] changes by +20%: EV = [W]  (change: [V])
   Conclusion: [Is the decision robust to this variable? Does the ranking change?]"

---

## When Data Is Insufficient

If probabilities cannot be sourced reliably (all inputs CS < 50):
  "INSUFFICIENT PROBABILITY DATA — Cannot produce a reliable decision tree.
   Available: [what we have]
   Missing: [what is needed and where it could be sourced]
   Alternative: Qualitative scenario comparison only, labeled as non-quantified."

Never substitute guessed probabilities for missing data.
