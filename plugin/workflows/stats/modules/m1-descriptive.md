# MODULE M1 — Descriptive Statistics

Agent: quant-analyst
Purpose: Profile the distribution and structure of a dataset or research body before modeling.

---

## When to Load

Load M1 when:
  - Starting any quantitative analysis — always run descriptive stats first
  - Profiling market data, survey results, financial time series, or research meta-data
  - Checking data quality before running inference (M3) or risk modeling (M4)

---

## What to Produce

### 1. Central Tendency

For any numeric dataset or reported metric:
  - Mean (arithmetic, geometric if growth rates or ratios)
  - Median
  - Mode (if applicable to categorical or discrete data)
  - Note: state which is most appropriate and why (e.g., "median preferred due to skewed distribution")

Format: "Mean = [value] ± [SE]  |  Median = [value]  |  Skew: [direction]"

### 2. Spread and Variability

  - Standard deviation (SD) and variance
  - Range: [min – max]
  - Interquartile range (IQR): Q1–Q3
  - Coefficient of variation (CV = SD/Mean × 100) for relative variability comparison

Format: "SD = [value]  |  IQR: [Q1]–[Q3]  |  CV = [value]%"

### 3. Distribution Shape

  - Skewness (positive / negative / symmetric)
  - Kurtosis (leptokurtic / mesokurtic / platykurtic)
  - Distribution fit: Normal / Log-normal / Power law / Heavy-tailed / Bimodal
  - Flag heavy tails explicitly — these signal higher risk of extreme events

Format: "Distribution: [type]. Skewness: [value]. Kurtosis: [value]. Heavy tail risk: [yes/no]"

### 4. Outliers

  - Identify using IQR method (< Q1 − 1.5×IQR or > Q3 + 1.5×IQR)
  - Or Z-score method (|Z| > 3 for normally distributed data)
  - For each outlier: state the value, its distance from median in SDs, and whether it is likely data error vs. genuine extreme event

### 5. Missing Data

  - Report percentage of missing values per variable
  - Classify as: MCAR (missing completely at random) / MAR (missing at random) / MNAR (not at random)
  - State imputation method if used, or flag as gap if not imputable

---

## Output Format

Every M1 output must include:
  1. Dataset description: source, n, time period, geography, unit of measure
  2. Summary statistics table (mean, median, SD, IQR, min, max)
  3. Distribution profile (shape, skewness, outliers)
  4. Data quality flag: GOOD / MARGINAL / POOR (with reason)
  5. Trust tier and CS for the underlying data source

Example:
  "DESCRIPTIVE PROFILE — [metric name]
   Source: [name, date, T[x] CS: [n]]
   n = [sample size]  |  Period: [start–end]  |  Geography: [scope]
   Mean: [value] ± [SE]  |  Median: [value]  |  SD: [value]
   IQR: [Q1]–[Q3]  |  Range: [min]–[max]  |  CV: [value]%
   Distribution: [type]  |  Skew: [direction]  |  Heavy tail: [yes/no]
   Outliers: [n identified, method]
   Data quality: [GOOD / MARGINAL / POOR — reason]"

---

## Red Flags (flag before proceeding to M2/M3)

- n < 30: parametric statistics unreliable — flag and recommend non-parametric alternatives
- CV > 100%: extreme variability — means and CIs will be misleading
- Missing data > 20%: data quality is poor — state what conclusions cannot be drawn
- Bimodal distribution: may indicate two distinct subpopulations — do not aggregate without segment analysis
- Heavy tails (kurtosis > 3 for financial data): extreme event risk is higher than normal distribution would suggest
