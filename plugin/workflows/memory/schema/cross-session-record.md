# SCHEMA: Cross-Session Analysis Record
TYPE:   memory/schema — used by data-architect when depositing an analysis output
TOKENS: ~400

## PURPOSE
Standardized format for archiving a cross-session analysis produced by
opportunity-analyst or risk-analyst. These records are produced on-demand
or after enough records accumulate to trigger pattern detection.
File is saved to: memory/records/cross-session/[ID].md

## RECORD FORMAT

```markdown
---
id:            XSS-[YYYY-MM-DD]-[analyst-id]-[topic-slug]
type:          cross-session
analyst:       [opportunity-analyst / risk-analyst / both]
date:          [date analysis produced]
trigger:       [ON-DEMAND / AUTO-PATTERN — what triggered this analysis]
records-read:  [list of record IDs examined: BUS-..., MKT-..., XSS-...]
record-count:  [number of records examined]
topic:         [subject of the analysis — 1 sentence]
finding-type:  [OPPORTUNITY / RISK / PATTERN / CONTRADICTION / BLIND-SPOT]
confidence:    [aggregate CS — weighted average of source records]
action-flag:   [IMMEDIATE / WATCH / INFORM / ARCHIVE]
---

## ANALYSIS SUMMARY

Topic: [what was analyzed]
Records examined: [count] — spanning [date range]
Projects covered: [list of project slugs]
Geos covered: [list]

## CORE FINDING

[One clear statement of what was found — 2-3 sentences max]
Evidence: [which records support this — cite by ID]
Confidence: [CS score] — basis: [why this CS level]

## SUPPORTING EVIDENCE

  Record [ID]: [what this record contributed to the finding]
  Record [ID]: [what this record contributed]
  Record [ID]: [what this record contributed]

  Pattern requires minimum 2 records for PATTERN finding type.
  Contradiction requires 2 records making conflicting claims.
  Blind-spot requires 1+ record with a waived DRL on a topic now showing evidence.

## WHAT IS NOT SUPPORTED

[What the data does NOT support — equal weight to what it does support]
[Limits of the analysis — what records are missing, what geos are not covered]
[What would strengthen or weaken this finding]

## IMPLICATIONS (for relevant team)

For business team:
  [How this finding should inform a future business research session]
  [Which layer it would affect: F1/F2/F3/F4/F5/R1-R5]

For marketing team:
  [How this finding should inform a future marketing session]
  [Which layer it would affect: M1/M2/M3/M4/M5/M6/R1-R5]

## RECOMMENDED ACTION

Action flag: [IMMEDIATE / WATCH / INFORM / ARCHIVE]

  IMMEDIATE: brief user and relevant team lead — finding is actionable now
  WATCH:     park in memory/index.md pattern log — check at next relevant session
  INFORM:    surface in the next session briefing — no action required before then
  ARCHIVE:   finding is noted but no current project is affected

Specific next step: [one concrete action — who does what]
```

## DATA-ARCHITECT INSTRUCTIONS

1. Receive completed analysis from opportunity-analyst or risk-analyst
2. Complete the structured header (frontmatter) from the analysis
3. Verify all cited record IDs exist in memory/index.md
4. Verify the non-assumption rule: every finding cites at least one record ID
5. Save file as: memory/records/cross-session/[ID].md
6. Append one row to memory/index.md
7. If finding-type is PATTERN and confidence ≥ 60: add to index.md pattern log
8. If finding-type is BLIND-SPOT: cross-reference waived DRL tracker in index.md
9. If action-flag is IMMEDIATE: lead-data presents to user before end of session
10. Report deposit complete to lead-data

## FINDING TYPE DEFINITIONS

  OPPORTUNITY  — a specific gap, white space, or timing advantage visible across sessions
  RISK         — a threat, decaying signal, or market condition that affects multiple projects
  PATTERN      — a repeated behavior, buyer response, or market dynamic confirmed across 3+ records
  CONTRADICTION — two records make conflicting claims about the same topic — user must resolve
  BLIND-SPOT   — a topic that has been consistently absent or waived across sessions despite
                 accumulating indirect evidence that it matters
