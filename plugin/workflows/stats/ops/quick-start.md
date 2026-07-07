# QUICK START — Statistics Team (Low-Context Mode)

Use this guide when context window is < 8K or for focused single-domain queries.
Minimal load: core/ (4 files) + 1 domain module only.

---

## Minimal Load by Query Type

| Query | Load |
|---|---|
| Market size / growth | core/ (all 4) + m5-market-research |
| Risk assessment | core/ (all 4) + m4-risk-assessment |
| Probability of event | core/ (all 4) + m2-probability |
| Data analysis | core/ (all 4) + m1-descriptive |
| Behavioral / consumer | core/ (all 4) + m6-behavioral |
| Decision support | core/ (all 4) + m7-decision-modeling |
| Statistical test | core/ (all 4) + m3-inference |

Never skip core/ — the 4 core files enforce the non-negotiable rules of this team.

---

## Quick Confidence Score Reference

```
T1 (official stats):         Base CS 85  — national stats offices, central banks, UN/OECD/IMF
T2 (peer-reviewed academic): Base CS 70  — indexed journals, replicated studies
T3 (institutional research): Base CS 55  — RAND, Brookings, McKinsey GI, CFA Institute
T4 (market research firms):  Base CS varies — gates_passed × 10 (max 50)
T5 (expert/press):           Base CS varies — gates_passed × 6 (max 30)

Modifiers:
+15  Cross-tier corroboration
-10  Single source only
-15  Contradicted by same-tier source
-25  Past decay window by >50%

Use: >= 60 as primary evidence | 35–59 as supporting | < 35 watchlist only
```

---

## Quick Uncertainty Notation

```
Point estimate:    [value] ± [margin]  (95% CI)
Range:             [value]  [low – high]  (90% CI)
Probability:       P(event) = X%  [CI: low–high%]
Scenarios:         P10: [low] | P50: [base] | P90: [high]
```

---

## Quick Scope Reminder

IN SCOPE: Market data, sector statistics, probability models, risk frameworks, behavioral patterns, decision trees
OUT OF SCOPE: User's own business analysis, action prescriptions, investment advice, competitive intelligence on named competitors

---

## Output Checklist (minimal)

Every output, even in quick-start mode, must have:
  [ ] Source + date + tier + CS on every claim
  [ ] Uncertainty range on every number
  [ ] Plain language summary (1–2 sentences)
  [ ] Any open conflicts flagged
  [ ] Scope rule respected
