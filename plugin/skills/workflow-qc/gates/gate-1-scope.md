# GATE 1 — SCOPE CLASSIFICATION
MODE: lightweight + full
TOKENS: ~400

## INPUT
Required: workflow manifest.md path and content
Required: workflow root folder path

## TASK
Determine if this workflow is authorized for Opeidos distribution.
Run all three rules. Report all findings before declaring result.

## RULE 1 — AUTO-BLOCK PATHS
If the workflow folder path contains any of these segments → BLOCK immediately:
  brain/
  memory/records/
  memory/schema/
Output: BLOCK:path:[matched segment]:[full path]
Do not run Rules 2 or 3 if Rule 1 triggers.

## RULE 2 — FORBIDDEN TERM SCAN
Scan all files in the workflow folder for these exact strings (case-insensitive):
  optimaeus
  hephaestus
  demiurge
  anamnesis
  cerberus
  logos       — flag only when used as an entity name (standalone "Logos" or "the Logos entity")
  hermes      — flag only when used as an entity name (not as a Greek mythology reference in generic text)
  agenthub    — flag only when used as a product identifier ("use agenthub", "open agenthub", "in agenthub")

For each match: BLOCK:[term]:[filename]:[context — 10 words around it]

## RULE 3 — OWNER DATA SCAN
Scan all files for patterns that indicate operator-specific personal content:
  - References to the operator's specific named projects by internal codename
  - Personal scheduling or calendar data
  - Internal team member names used as agents or personas
  - Phrases: "my ecosystem", "our entities", "the five entities", "the neuronal system"
  - References to specific private strategy decisions (sprint names, internal milestones)

For each match: BLOCK:owner-data:[description]:[filename]

## RESULT LOGIC
PASS:  No Rule 1, 2, or 3 triggers found
BLOCK: Any Rule 1, 2, or 3 trigger found — list all before declaring BLOCK

## OUTPUT FORMAT
GATE 1 — SCOPE CLASSIFICATION
Result:               PASS | BLOCK
Scanned files:        [count]
Auto-block path:      NONE | BLOCK:[path]
Forbidden terms:      NONE | [list of BLOCK items]
Owner data:           NONE | [list of BLOCK items]
Distributable:        YES | NO
Action required:      NONE | [list of items to fix]
