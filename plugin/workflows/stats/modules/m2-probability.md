# MODULE M2 — Probability Modeling

Agent: quant-analyst
Purpose: Build explicit probability models for events, outcomes, and scenarios.

---

## When to Load

Load M2 when:
  - Estimating the likelihood of a future event or market scenario
  - Building a probabilistic model for risk-modeler or decision-modeler inputs
  - Converting historical frequency data into forward-looking probability estimates

---

## Core Approaches

### Frequentist Probability
Base probabilities on observed historical frequency.
  P(event) = (number of times event occurred) / (total observations)
  Required: n ≥ 30 for reliable frequency estimate. Flag if n < 30.
  Add uncertainty: P ± margin, where margin = 1.96 × √(P(1−P)/n) for 95% CI.

Example:
  "Historical recession probability (US, 1950–2023): P = 14.5% per year
   [CI: 10.2%–19.8%]  (NBER, T1 CS: 85)"

### Bayesian Probability
Use when prior knowledge exists and can be updated with new evidence.
  1. State the prior: P(event) = [prior probability, source, T[x] CS]
  2. State the likelihood: P(evidence | event) = [value, source]
  3. Update to posterior: P(event | evidence) via Bayes' theorem
  4. Always show sensitivity to prior choice — if prior changes from X to Y, posterior shifts from A to B

Example:
  "Prior P(market entry success) = 25% (industry base rate, T3 CS: 55)
   After updating with [positive market signal]: Posterior P = 38% [CI: 28–49%]
   Sensitivity: if prior = 15%, posterior = 26%; if prior = 35%, posterior = 51%"

### Monte Carlo Simulation
Use when multiple uncertain inputs combine to produce an outcome distribution.
  1. Define input variables with their distributions (mean, SD, and distribution type)
  2. Run N ≥ 1,000 simulations (state N in output)
  3. Report: P10 (10th percentile), P50 (median), P90 (90th percentile)
  4. Report: mean, SD of simulated output distribution
  5. Identify the top 3 input variables by sensitivity (tornado chart logic)

Output format:
  "MONTE CARLO RESULT — [outcome variable]
   N simulations: [n]
   P10: [value]  |  P50: [value]  |  P90: [value]
   Mean: [value]  |  SD: [value]
   Top drivers of uncertainty: [variable 1], [variable 2], [variable 3]
   Model assumptions: [list key distributional assumptions]"

---

## Probability Distribution Reference

Select the appropriate distribution based on the data type:

  Normal:         Continuous, symmetric, unbounded. Use for: aggregated outcomes, means.
  Log-normal:     Continuous, right-skewed, positive-only. Use for: prices, incomes, firm sizes.
  Poisson:        Discrete count events in fixed interval. Use for: failure counts, arrivals.
  Exponential:    Time between events. Use for: time-to-failure, service times.
  Binomial:       Count of successes in n trials with fixed P. Use for: conversion rates, adoption.
  Beta:           Probability of probability (0–1 bounded). Use for: Bayesian priors on rates.
  Pareto/Power:   Heavy-tailed, extreme events. Use for: financial losses, wealth distributions.
  Student's t:    Like normal but heavier tails. Use for: small samples (n < 30).

Always justify the distribution choice and note if the choice is uncertain.

---

## Joint and Conditional Probability

When modeling multiple related events:
  - State dependencies explicitly: are events independent or correlated?
  - If correlated: state the correlation coefficient and its source
  - Avoid the independence assumption unless explicitly verified
  - For tail risk: note that correlations typically increase during market stress

---

## Output Standards

Every probability estimate must show:
  1. P(event) = [X]%
  2. Confidence interval: [CI: low–high%]
  3. Method: [frequentist / Bayesian / simulation]
  4. Sample size or simulation count: n = [n]
  5. Source of base rate: [citation, T[x] CS]
  6. Key assumptions: [list]

Flag as "SPECULATIVE ESTIMATE" when:
  - No historical base rate is available
  - n < 30 for frequentist estimates
  - Model is purely theoretical with no empirical calibration
  In this case: CS cap at 35, label as directional only.
