# UNCERTAINTY NOTATION — How to Express Statistical Uncertainty

## The Core Rule

NEVER present a number as a fact without showing its uncertainty.
A point estimate alone is not a finding — it is an invitation to false precision.
Every quantitative output must carry: the value, its range, and the confidence level.

---

## Standard Notation Formats

### Format 1 — Point estimate with symmetric margin
Use when: standard deviation or margin of error is symmetric around the mean.
Format:   [value] ± [margin]  (95% CI)
Example:  "Average household savings rate: 8.3% ± 1.4%  (95% CI, Eurostat 2024, T1 CS: 82)"

### Format 2 — Asymmetric range (low–high)
Use when: distribution is skewed or bounds are not symmetric.
Format:   [value]  [low – high range]  (95% CI)
Example:  "Market CAGR estimated at 6.2%  [4.8% – 8.1%]  (90% CI, T2 CS: 65)"

### Format 3 — Probability claim
Use when: expressing likelihood of an event or scenario.
Format:   P([event]) = [X]%  [CI: low–high%]  (basis: [method])
Example:  "P(recession within 12 months) = 34%  [CI: 22–48%]  (consensus model, T3 CS: 52)"

### Format 4 — Scenario range (P10/P50/P90)
Use when: three-scenario analysis (pessimistic / base / optimistic).
Format:
  P10 (pessimistic):  [value]
  P50 (base case):    [value]
  P90 (optimistic):   [value]
  Source: [citation, tier, CS]
Example:
  P10: €2.1B market size
  P50: €3.4B market size
  P90: €5.2B market size
  (Euromonitor 2025, T4 CS: 38 — directional only)

### Format 5 — Qualitative confidence label
Use when: no numeric CI is available but directional confidence can be stated.
Use sparingly — prefer numeric formats.
  High confidence (CS 70+):    [finding]  [HIGH CONF]
  Moderate confidence (CS 50–69): [finding]  [MOD CONF]
  Low confidence (CS 35–49):   [finding]  [LOW CONF — treat as directional]
  Below threshold (CS < 35):   Do not cite. Watchlist only.

---

## Statistical Test Reporting

When reporting hypothesis test results, always include:
  - Test statistic (t, z, F, chi-square, etc.)
  - p-value or p-range
  - Effect size (Cohen's d, r², eta², etc.)
  - Sample size (n)
  - Power (if available)

Format:  [finding] (t([df]) = [value], p [< / = ] [value], d = [effect size], n = [n])
Example: "Purchase intent increased significantly (t(248) = 3.12, p < 0.01, d = 0.39, n = 250)"

Significance threshold defaults:
  p < 0.05   statistically significant
  p < 0.01   highly significant
  p < 0.001  very highly significant
  p > 0.05   not statistically significant (do not interpret as "no effect")

---

## Common Mistakes to Avoid

NEVER:
  - Present a percentage without a denominator or sample reference
  - Use "approximately X" without a range
  - Interpret non-significant results as proof of no effect
  - Conflate statistical significance with practical significance (report effect size)
  - Average two estimates from different methodologies without flagging the combination
  - Extrapolate beyond the observed data range without explicit flagging

ALWAYS:
  - State what the CI means in plain language when presenting to non-statisticians
  - Flag when sample size is below threshold for reliable inference (n < 30 for parametric)
  - Distinguish between population parameters (Greek letters) and sample statistics
  - Note when data was collected vs. when the report was published (freshness gap)

---

## Plain Language Translation Rules

After every statistical output, include a plain language summary (1–2 sentences).
Format:
  Statistical result: [full notation]
  In plain terms: "[what this means for someone making a decision]"

Example:
  Statistical result: "P50 market size = €3.4B [CI: €2.8B–€4.1B] (90% CI, T3 CS: 58)"
  In plain terms: "The most likely market size is around €3.4 billion, but there is meaningful
  uncertainty — it could realistically be anywhere from €2.8B to €4.1B."

---

## Aggregating Uncertainty

When combining multiple uncertain inputs:
  1. Do not average confidence scores — report the range they span.
  2. If inputs have different confidence levels, weight conclusions toward higher-CS inputs.
  3. When combining P10/P50/P90 from multiple sources, show the composite range explicitly.
  4. Flag any aggregation that combines sources more than one tier apart as a "mixed-tier aggregate."

Format for mixed-tier aggregate:
  "MIXED-TIER AGGREGATE — inputs range from T[x] to T[y]. Combined CS: [lower bound of inputs]."
