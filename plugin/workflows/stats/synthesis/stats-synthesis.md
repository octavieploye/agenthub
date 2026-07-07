# SYNTHESIS — Statistics Team Final Output

Agent: lead-stats (with all domain module outputs loaded)
Purpose: Cross-check all findings, compute composite confidence, and produce the final deliverable.

---

## When to Load

Load after all relevant domain modules have completed.
Do not load earlier — synthesis requires all inputs.

---

## Pre-Synthesis Integrity Check

Before producing the final output, lead-stats must verify:

1. SOURCE CHECK
   All findings carry: source name + date + trust tier (T0–T5) + CS score.
   Any finding without a complete citation: remove from synthesis or label UNSOURCED.

2. CONFLICT CHECK
   Are there any CSL items (conflicts between sources on the same metric)?
   If yes: list all open CSL items at the top of the synthesis.
   Do not resolve CSL items — surface them for user decision.

3. DECAY CHECK
   Are any sources past their decay window?
   If yes: label those findings as EXPIRED SOURCE and reduce CS by 25.

4. UNCERTAINTY CHECK
   Do all quantitative claims carry +/- ranges or CIs?
   Any point estimate without uncertainty range: add "RANGE UNKNOWN" flag.

5. SCOPE CHECK
   Does any finding cross into action prescription or user-specific business analysis?
   If yes: reframe as "external reference benchmark" or remove.

---

## Composite Confidence Score

At synthesis, compute a composite CS for the overall output:
  Composite CS = weighted average of all input finding CS scores
  Weight by: relevance to the central question (lead-stats judgment)

Thresholds:
  Composite CS >= 70:  HIGH CONFIDENCE synthesis — findings may be cited as primary evidence
  Composite CS 50–69:  MODERATE CONFIDENCE — cite as supporting context, flag key uncertainties
  Composite CS 35–49:  LOW CONFIDENCE — directional only, explicit user warning required
  Composite CS < 35:   Do not synthesize — report INSUFFICIENT DATA and list gaps

---

## Synthesis Output Structure

Every synthesis output must follow this structure:

### SECTION 1 — Summary (lead-stats)
  One paragraph: what was analyzed, what the key finding is, overall confidence level.
  Format: "SYNTHESIS SUMMARY — [topic]
           Overall composite CS: [n]  ([HIGH / MODERATE / LOW] confidence)
           Key finding: [one sentence]
           Open conflicts (CSL): [n items — listed below / none]"

### SECTION 2 — Open Conflicts (CSL items)
  List all unresolved data conflicts.
  Format: "CSL [n] — [metric]: [Source A] says [X] vs [Source B] says [Y]. User decision required."

### SECTION 3 — Primary Findings
  Findings with CS >= 70, sourced and with uncertainty ranges.
  Format per finding: "[Finding] (T[x] CS: [n]) [value ± range or CI]"

### SECTION 4 — Supporting Context
  Findings with CS 50–69 — labeled as supporting only.
  Format: "SUPPORTING — [finding] (T[x] CS: [n]) — treat as directional"

### SECTION 5 — Weak Signals (Watchlist)
  Findings with CS 35–49 — not used in conclusions.
  Format: "WATCHLIST — [finding] (CS: [n]) — insufficient confidence to cite"

### SECTION 6 — Data Gaps
  Metrics that could not be sourced from T0–T3 within decay window.
  Format: "GAP — [metric]: no reliable source found. Recommended source: [suggestion]"

### SECTION 7 — Uncertainty Summary
  One paragraph describing the main sources of uncertainty in the synthesis.
  State the single finding that, if changed, would most alter the conclusions.

### SECTION 8 — Expired Sources (if any)
  List any sources used that are past their decay window.
  Format: "EXPIRED — [source, date, metric]. Used as historical baseline only."

---

## Prohibited in Synthesis

- No action recommendations ("you should do X")
- No analysis of the user's own business or projects
- No unsourced claims
- No point estimates without uncertainty ranges
- No conclusions that rest solely on CS < 50 inputs
- No resolution of CSL items — surface only

---

## Handoff Note

At the end of every synthesis:
  "This synthesis is a statistical reference. It describes the external world.
   Its application to specific decisions is the user's responsibility.
   For deeper analysis on any finding, specify which domain module to re-run."
