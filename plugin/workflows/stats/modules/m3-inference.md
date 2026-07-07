# MODULE M3 — Statistical Inference

Agent: quant-analyst
Purpose: Test hypotheses, establish relationships, and draw evidence-based conclusions from data.

---

## When to Load

Load M3 when:
  - Testing whether an observed difference or relationship is statistically significant
  - Estimating parameters of a population from a sample
  - Validating a claim made by a source against statistical evidence
  - Establishing direction and strength of relationships between variables

---

## Hypothesis Testing Protocol

### Step 1 — State hypotheses explicitly
  H₀ (null): [no effect / no difference / no relationship]
  H₁ (alternative): [directional or non-directional claim to test]

### Step 2 — Select test based on data type

  | Comparison | Data Type | Test |
  |---|---|---|
  | Two group means | Continuous, normal | Independent t-test |
  | Two group means | Continuous, non-normal | Mann-Whitney U |
  | Pre/post same group | Continuous | Paired t-test |
  | Three+ groups | Continuous | ANOVA + post-hoc |
  | Proportions | Categorical | Chi-square or Z-test |
  | Rank/ordinal | Ordinal | Kruskal-Wallis |
  | Time series | Continuous | ADF stationarity + regression |
  | Correlation | Continuous | Pearson r (normal) / Spearman ρ (non-normal) |

### Step 3 — Report full test result

Format:
  "HYPOTHESIS TEST — [what was tested]
   Test: [test name]  |  n = [sample size]
   Statistic: [t / F / χ² / etc.] = [value]  |  df = [value]
   p-value: [exact value or < threshold]
   Effect size: [Cohen's d / r² / eta² / Cramér's V] = [value]
   Decision: [Reject H₀ / Fail to reject H₀] at α = [0.05 / 0.01]
   Interpretation: [plain language statement of what this means]"

### Step 4 — Practical significance check

Statistical significance ≠ practical significance.
Always report effect size and interpret it:
  - Cohen's d: 0.2 = small, 0.5 = medium, 0.8 = large
  - r² / eta²: 0.01 = small, 0.06 = medium, 0.14 = large
  - If p < 0.05 but effect size is small: "Statistically significant but practically negligible."

---

## Confidence Intervals

For any estimated parameter:
  Format: [estimate] ± [margin]  (95% CI: [low – high])
  Always report the CI alongside the p-value — CIs contain more information.
  Interpret: "We are 95% confident the true [parameter] lies between [low] and [high]."

---

## Regression Analysis

When testing relationships between variables:

### Simple Linear Regression
  Output: β₀ (intercept), β₁ (slope), R², p-value for slope, SE of estimate
  Format: "Y = β₀ + β₁X  (R² = [value], β₁ p [< / =] [value], n = [n])"
  Interpret: "A 1-unit increase in X is associated with a [β₁] change in Y [CI: low–high]."

### Multiple Regression
  Report: adjusted R², VIF for multicollinearity (VIF > 5 = concern, VIF > 10 = serious)
  Flag if residuals are non-normal (Shapiro-Wilk test) — affects CI validity.

### Correlation
  Report: r (Pearson) or ρ (Spearman), p-value, n
  Explicitly state: "Correlation does not imply causation."
  If causal claim is needed: require experimental or quasi-experimental design.

---

## Multiple Testing Problem

When conducting more than one test:
  Apply Bonferroni correction: use α/k where k = number of tests
  Or report FDR-adjusted p-values (Benjamini-Hochberg)
  Without correction: "WARNING — multiple comparisons without correction. Interpret with caution."

---

## Sample Size Guidance

For planning or flagging inadequate samples:
  Minimum for parametric tests: n ≥ 30
  For detecting medium effect (d = 0.5) at 80% power: n ≥ 64 per group
  For detecting small effect (d = 0.2) at 80% power: n ≥ 394 per group
  Survey accuracy: ±3% margin at 95% CI requires n ≈ 1,067

Flag any study where n is below the power requirement as "UNDERPOWERED."
Underpowered studies may show real effects as non-significant (Type II error risk).

---

## Limitations to Always State

At the end of every inference module output:
  1. Sample representativeness: is the sample generalizable to the population of interest?
  2. Temporal validity: are findings from the data period still applicable today?
  3. Causal claims: explicitly state if the design cannot establish causation
  4. Replication status: has the finding been replicated? (for T2 sources: note if single study)
