# MANIFEST — Statistics & Probability Research Methodology
Version: 1.0
Domain: Data Analysis | Risk Assessment | Market Research | Decision Support | Behavioral/Social Research

---

## PURPOSE

This team provides statistical and probabilistic analysis as an external analytical reference.
It does NOT analyze the user's own business or projects directly.
All outputs include: trust tier (T0–T5), confidence score (CS: 0–100), and uncertainty ranges (+/-).

---

## LOAD ORDER

1. Always load ALL core/ modules first (4 files, ~900 tokens total)
2. lead-stats loads ops/how-to-run at session start
3. Load the relevant domain module(s) for the task — one at a time
4. Load synthesis/ when all domain modules complete
5. Load ops/source-registry only when source validation is needed

---

## CORE (always load — all 4)

```
core/trust-levels          Source trust hierarchy (T0–T5) + decay rates
core/uncertainty-notation  How to express +/- ranges, CIs, probability intervals
core/non-assumption-rule   No claim without evidence + citation format
core/scope-rule            Boundary: no action analysis on user's own business
```

---

## DOMAIN MODULES (load one at a time, unload before loading next)

### Analysis Track — statistical and probabilistic modeling

```
modules/m1-descriptive      Descriptive statistics: distributions, central tendency, spread
modules/m2-probability      Probability modeling: Bayesian, frequentist, Monte Carlo
modules/m3-inference        Statistical inference: hypothesis tests, CIs, regression, correlation
```

### Risk Track — failure modes, risk quantification

```
modules/m4-risk-assessment  FMEA, risk matrices, RPN scoring, failure rates, scenario risk
```

### Market Track — market data and sector research

```
modules/m5-market-research  Market sizing, growth rates, competitive share, adoption curves
```

### Social & Behavioral Track — human factors and cognitive patterns

```
modules/m6-behavioral       Behavioral economics, cognitive biases, social influence patterns
```

### Decision Track — decision support under uncertainty

```
modules/m7-decision-modeling  Decision trees, EV frameworks, scenario analysis, P10/P50/P90
```

---

## SYNTHESIS

```
synthesis/stats-synthesis   Cross-module integrity check, final confidence-scored output
```

---

## OPERATIONS

```
ops/how-to-run       Session guide: when to use which module, sequencing rules
ops/source-registry  Catalog of verified statistical sources by domain and tier
ops/quick-start      Minimal load guide for focused single-domain queries
```

---

## SEQUENCING GUIDE

### Full Research Request
1. core/ (all 4) → market-stats-researcher runs m5
2. quant-analyst runs m1, m2, or m3 in parallel with risk-modeler running m4
3. behavioral-analyst runs m6 if human/social context is relevant
4. decision-modeler runs m7 using all prior outputs
5. Load synthesis/ — cross-check all findings, produce final output

### Risk-Only Request
1. core/ (all 4) → risk-modeler runs m4
2. quant-analyst runs m2 for probability inputs
3. decision-modeler runs m7 for probability-weighted scenario view
4. Load synthesis/

### Market Research Request
1. core/ (all 4) → market-stats-researcher runs m5
2. quant-analyst runs m1 for descriptive profiling of market data
3. behavioral-analyst runs m6 for consumer/buyer psychology overlay
4. Load synthesis/

### Decision Support Request
1. core/ (all 4) → quant-analyst runs m3 (inference) for base rates
2. risk-modeler runs m4 for risk inputs
3. decision-modeler runs m7
4. Load synthesis/

---

## CONFIDENCE SCORE QUICK REFERENCE

```
>= 70   Primary evidence — cite directly
50-69   Supporting context — label: "Supporting (CS: [score])"
35-49   Weak signal — flag uncertainty explicitly
< 35    Watchlist only — never cite as evidence
```

---

## UNCERTAINTY OUTPUT FORMAT

Every quantitative claim must show:
- Point estimate with range:   [value] ± [margin]  OR  [low – high]
- Confidence level:            (95% CI) or (90% CI) or estimated range
- Probability claims:          P(event) = X% [CI: low–high%]
- Trust tier + CS:             T1 CS: 82

---

## TOKEN BUDGET GUIDE

```
core/ total:            ~900 tokens   (always in context)
one domain module:      ~700 tokens   (load/unload as you go)
synthesis/:             ~600 tokens   (load at end only)
ops/source-registry:    ~500 tokens   (load on demand)
Maximum at any point:   ~2,500 tokens
```
