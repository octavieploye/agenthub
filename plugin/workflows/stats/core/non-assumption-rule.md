# NON-ASSUMPTION RULE — Statistics Team

## The Rule

No quantitative claim may appear in any stats team output without:
  1. A named source (author, organization, publication, or dataset)
  2. A publication or access date (or "no date" explicitly noted)
  3. A trust tier (T0–T5)
  4. A confidence score (CS: 0–100)

If a claim cannot be sourced, it must be either:
  a) Removed from the output entirely, OR
  b) Labeled clearly: "UNSOURCED — basis is [team member inference / prior knowledge / logical deduction only]. CS: 0. Do not use as evidence."

---

## This Applies to All Team Members

- quant-analyst: every statistic, every parameter estimate, every distribution assumption must cite its source.
- risk-modeler: every failure rate, every severity score, every frequency estimate must cite published data or be labeled as "estimated."
- market-stats-researcher: every market size figure, growth rate, share percentage must carry its source tier.
- behavioral-analyst: every bias or behavioral pattern must cite a specific study, not a general claim.
- decision-modeler: every probability used in a decision tree must come from one of the above with a cited source.

---

## Inferences vs. Facts

A statistical model output is NOT a fact — it is a derived inference.
Label all model outputs explicitly:

  "MODEL OUTPUT — [model type, inputs, assumptions]. This is a derived estimate, not observed data.
   Sensitivity to key assumptions: [state what happens if assumption X changes by ±Y%]."

A correlation is NOT causation. When a correlation is found:
  "CORRELATION DETECTED — r = [value] (p < [threshold]). No causal direction established.
   Alternative explanations considered: [list]."

---

## Decay and Freshness Check

Before citing any source, verify it is within its decay window:
  T1 (official stats):    5 years
  T2 (peer-reviewed):     3 years
  T3 (institutional):     18 months
  T4 (industry reports):  12 months
  T5 (expert/press):      6 months

If a source is expired:
  a) Search for a more recent version first.
  b) If none found, cite the original with explicit date and label: "EXPIRED SOURCE — [date]. Treat as historical baseline only."
  c) Reduce CS by 25 for past-window data.

---

## Conflict Surfacing Rule (CSL)

When two sources contradict each other on the same metric:
  1. Show both, with tiers and CS scores.
  2. Create a conflict item (CSL):
     "CSL — [Metric]: [Source A] says [X] (T[n] CS: [n]) vs [Source B] says [Y] (T[n] CS: [n]). Unresolved. User decision required before this metric can be used in conclusions."
  3. Do NOT proceed past a CSL item without user acknowledgment.
  4. The lower-tier conflicting claim does not automatically lose — both are surfaced.

---

## Prohibition on Synthesis Guessing

When data is missing or insufficient:
  - Do NOT fill gaps with plausible-sounding numbers.
  - DO state: "INSUFFICIENT DATA — [metric] not available from any T0–T3 source within decay window. Cannot include in quantitative synthesis. Recommend sourcing from [suggested source type]."

When asked a question the team cannot answer with evidence:
  - Say so explicitly.
  - Identify what data would be needed to answer it.
  - Do not substitute narrative for missing evidence.
