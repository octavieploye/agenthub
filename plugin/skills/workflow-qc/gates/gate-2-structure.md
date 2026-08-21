# GATE 2 — STRUCTURE VALIDATION
MODE: lightweight + full
TOKENS: ~500

## INPUT
Required: workflow manifest.md content
Required: all step/module files referenced in the manifest

## TASK
Validate the workflow is structurally correct for server-side hosting on Hetzner.
Run all 6 checks. Collect all results before declaring final gate result.

## CHECK 1 — MANIFEST COMPLETENESS
Required sections in manifest.md (check for presence, not content):
  Version:           [present?]
  LOAD ORDER:        [present?]
  TOKEN BUDGET GUIDE: [present?]
Result: PASS | FAIL:missing-section:[section name]

## CHECK 2 — NO RELATIVE PATHS IN STEP CONTENT
Scan all step and module files for relative path references.
Patterns to flag:
  ../   or   ./   or   file:../   or   @../
These are dev-machine paths. They do not resolve on the Hetzner server volume.
Result: PASS | FAIL:relative-path:[filename]:[exact path found]

## CHECK 3 — TOKEN COUNTS DECLARED
Every module referenced in the manifest must declare its token count at the top of the file.
Accepted formats: TOKENS: ~N   or   Tokens: ~N   or   Token count: N
Result: PASS | WARN:missing-token-count:[filename]

## CHECK 4 — LOAD ORDER NON-CIRCULAR
Trace the manifest LOAD ORDER. Flag if any module references itself or creates a dependency loop.
A → B → A = circular. A → B → C = valid.
Result: PASS | FAIL:circular-reference:[module chain]

## CHECK 5 — FILE FORMAT COVERAGE
All files referenced in the manifest must use one of these extensions: .md / .json / .yaml
Flag any other extension found in a referenced path.
Result: PASS | FAIL:unsupported-format:[filename]

## CHECK 6 — SELF-CONTAINED STEPS
Step content must not depend on runtime filesystem reads.
Flag any instruction in a step file that says:
  "load file from"   "read from disk"   "import from"   "source from"
These break when the workflow runs on the buyer's machine without the dev environment.
Result: PASS | WARN:runtime-dependency:[filename]:[instruction quoted]

## RESULT LOGIC
PASS:  All 6 checks pass
WARN:  One or more WARN results, no FAIL results — proceed with warnings logged
FAIL:  Any CHECK returns FAIL — block distribution until fixed

## OUTPUT FORMAT
GATE 2 — STRUCTURE VALIDATION
Result:                PASS | WARN:[count] | FAIL:[count]
Check 1 Manifest:      [result]
Check 2 Paths:         [result]
Check 3 Token counts:  [result]
Check 4 Load order:    [result]
Check 5 File formats:  [result]
Check 6 Self-contained: [result]
Action required:       NONE | [numbered list of items to fix]
