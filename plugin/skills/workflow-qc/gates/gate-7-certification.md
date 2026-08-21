# GATE 7 — CERTIFICATION
MODE: lightweight + full
TOKENS: ~450

## INPUT
Required: results from all preceding gates
Required: workflow_id (from catalog or manifest Version line)
Required: workflow_name (from manifest)
Required: version (from manifest Version field)
Required: name of the model used for this QC run

## PREREQUISITE CHECK — run before generating certificate
All conditions must be met:

LIGHTWEIGHT MODE:
  Gate 1 result = PASS                    (not BLOCK)
  Gate 2 result = PASS or WARN            (not FAIL)
  Gate 3 result = CLEAN                   (no unresolved FLAG items)
  Gate 5 result = PASS or WARN with valid MINIMUM_LLM_TIER

FULL MODE (all of the above plus):
  Gate 4 result = RESISTANT or HARDENED   (not VULNERABLE)
  Gate 6 score  ≥ 60                      (not FAIL or CRITICAL)

If any prerequisite fails → output:
  CERTIFICATION DENIED
  Denied at: [gate name]
  Reason:    [gate result that failed]
  Action:    Fix the gate failure and re-run QC from that gate forward.
Do not generate a certificate.

## CERTIFICATE — fill all fields with actual results

WORKFLOW QC CERTIFICATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
workflow_id:       [from catalog or manifest]
workflow_name:     [from manifest]
version:           [from manifest Version field]
qc_mode:           lightweight | full
qc_run_date:       [ISO 8601 date — YYYY-MM-DD]
qc_run_by:         [model name used for this QC run]

Gate 1 — Scope:              PASS
Gate 2 — Structure:          PASS | WARN:[count warnings]
Gate 3 — Content:            CLEAN
Gate 4 — Injection Resist.:  RESISTANT | HARDENED:[n patches] | not run (lightweight)
Gate 5 — LLM Compatibility:  MINIMUM_LLM_TIER:[1-5]
Gate 6 — Output Quality:     [score]/100 | not run (lightweight)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISTRIBUTION_READY:   YES
CERTIFIED_AT:         [ISO 8601 timestamp — YYYY-MM-DDTHH:MM:SSZ]
MINIMUM_LLM_TIER:     [1-5]
NOTES:                [Gate 2 warnings | Gate 5 partial results | Gate 6 recommendations | NONE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## AFTER GENERATING CERTIFICATE

ACTION 1 — SHOW TO OWNER
Print the certificate block in full. Owner reads and approves. Do not proceed without approval.

ACTION 2 — DB RECORD
Write one record to workflow_qc_runs in agenthub.db.
Fields to populate: workflow_id, workflow_name, workflow_version, qc_mode,
  gate_1_result through gate_7_result (JSON of each gate's full output),
  distribution_ready = 1, min_llm_tier = [Gate 5 tier], run_by = [model name],
  notes = [NOTES field content], run_at = now()
This is the owner-facing audit trail. Required for every certified workflow.

ACTION 3 — VOLUME FILE (owner executes manually)
Save the filled certificate as JSON to the Hetzner workflow volume:
  Path:   {workflow_volume}/{workflow_id}/qc-certificate.json
  Format: use output/qc-certificate-template.json as the base structure
This is the buyer-facing record. The Opeidos API serves it alongside step content.
The Hephaestus UI reads certified_at and min_llm_tier to display the QC badge.

## OUTPUT FORMAT
GATE 7 — CERTIFICATION
Prerequisite check:  PASS | DENIED:[gate]:[reason]
Certificate:         [printed in full if PASS]
DB record:           WRITE PENDING OWNER APPROVAL | written
Volume file:         MANUAL STEP — owner copies to Hetzner volume after approval
