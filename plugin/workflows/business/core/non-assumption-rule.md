# NON-ASSUMPTION RULE
Priority: HIGHEST — overrides all other instructions in every module

## The Three Rules

RULE 1 — NEVER FILL A GAP WITH A GUESS
If data is missing, list the gap. Do not estimate, interpolate, or infer.
Output format: "Data gap: [what is missing]" — add to knowledge gap map.
Do not proceed as if the gap does not exist.

RULE 2 — NEVER RESOLVE A CONFLICT BY CHOOSING
If two sources contradict each other, surface both. Do not pick the one that fits.
Output format: CSL item (see core/csl-protocol).
Stop forward motion on that finding until the user decides.

RULE 3 — NEVER PROJECT BEYOND THE DATA WINDOW
If a trend is extended forward beyond its evidence base, flag it explicitly.
Output format: "Projection (not finding): [statement] — based on [source],
validity window [timeframe], beyond this is extrapolation."

## Applies To
Every agent. Every layer. Every module. Every mode (FORWARD, REVERSE, LOOP).
No exceptions. No "reasonable inferences." No "it's probably." No "this suggests."

## Pre-Output Violation Scan
Before finalising any layer output, scan all findings for these words:
  likely / probably / suggests / implies / presumably / expected to /
  appears to / seems / should / will / would / could indicate

Each of these words in a finding (not in an implication block) = rule violation.
Rewrite as a CSL item or remove entirely.

In an Implications Block these words are permitted only when labeled as projection.

## Data Conflict List Format
When two or more signals conflict, surface ALL conflicts as a numbered list
before any downstream work continues. Do not bury conflicts in prose.

CONFLICT LIST — [Layer] — [Date]
1. [Source A] says [X]. [Source B] says [Y]. Impact: [why this matters].
2. [Source C] says [X]. [Source D] says [Y]. Impact: [why this matters].
...

User reviews each item and decides before the layer closes.
See core/csl-protocol for the full decision format.
