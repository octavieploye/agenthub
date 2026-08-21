# GATE 6 — OUTPUT QUALITY REVIEW
MODE: full only
TOKENS: ~500
Requires: Mistral Large, Claude Sonnet 4.6, or Kimi K2.5+

## INPUT
Required: first workflow step instruction content
Required: declared OUTPUT FORMAT from the step file (the section listing required output fields)
Required: workflow manifest (for context on the workflow's purpose)

## SYNTHETIC TEST INPUT
Use this as the buyer's input for the simulation:
"I want to understand the market for sustainable packaging materials in the European Union.
My company produces biodegradable films. Tell me who the main competitors are,
where demand is growing fastest, and what regulatory shifts I should anticipate in the next 18 months."

## STEP 1 — RUN THE FIRST STEP
Feed: [synthetic test input] + [first step instruction content] to the model.
Collect the complete generated output. Do not edit or trim it.

## STEP 2 — SECTION PRESENCE CHECK
Compare the output against the step's declared OUTPUT FORMAT.
For each required section or field declared in the step:
  PRESENT:     Section exists and has content
  INCOMPLETE:  Section exists but is missing key sub-fields
  MISSING:     Section not found in output at all

## STEP 3 — QUALITY SCORE (0-100)
Apply this rubric to the collected output:

  +20  All required output sections PRESENT
  +20  Formatting clean (correct headers, tables, numbered lists where declared)
  +20  All scoring or confidence fields correctly populated (CS, TTA, or equivalent)
  +20  No forbidden content in the output (no PII, no internal entity names, no celebrity names)
  +10  Output is actionable — a buyer can use it without asking for clarification
  +10  No data presented as fact without attribution or source label

Deductions:
  -10  Each required section that is MISSING
  -10  Each scoring or confidence field that is absent when declared
  -20  Any forbidden content found in the output

Score floor: 0. Score ceiling: 100.
Score ≥ 60 = gate passes. Score < 60 = gate fails.

## STEP 4 — IMPROVEMENT RECOMMENDATIONS
For each deduction applied: state what specific change to the workflow step would fix it.
Recommendations must be actionable instructions — not generic observations.
Format: [Deduction reason] → [Specific fix] → [Expected score recovery: +N]

## STEP 5 — FORBIDDEN CONTENT CHECK ON OUTPUT
Scan the generated output using the same forbidden term list as Gate 1 Rule 2.
Also check for any PII patterns from Gate 3 Layer 1.
If found: CRITICAL — even a passing quality score does not override forbidden content in output.

## OUTPUT FORMAT
GATE 6 — OUTPUT QUALITY REVIEW
Model used for simulation:   [model name + tier]
Sections present:            [list]
Sections incomplete:         [list or NONE]
Sections missing:            [list or NONE]
Scoring fields populated:    YES | PARTIAL:[missing fields] | NO
Forbidden content in output: NONE | CRITICAL:[list]
Quality score:               [0-100]
Score breakdown:
  +[n]  [rubric item]
  -[n]  [rubric item]
  ...
Result:                      PASS (≥60) | FAIL (<60) | CRITICAL (forbidden content in output)
Recommendations:
  1. [deduction reason] → [specific fix] → [expected +N]
  2. [...]
