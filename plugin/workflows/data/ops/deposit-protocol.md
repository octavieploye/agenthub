# MODULE: data/ops/deposit-protocol
TYPE:   Operations — step-by-step deposit guide for data-architect
OWNER:  data-architect
TOKENS: ~400

## PURPOSE
The authoritative procedure for depositing a session output into the unified memory folder.
This fires automatically after every business or marketing session synthesis closes.
data-architect follows this protocol exactly — no deviation.

## PRE-DEPOSIT CHECKLIST

Before depositing, confirm all of the following:
  [ ] Session synthesis (L6 or marketing L6) is complete and closed
  [ ] All CSL items in the session are resolved (or noted as unresolved in open-csl field)
  [ ] All DRL items are logged with status (Pending / Requested / Received / Waived)
  [ ] Originating team lead has confirmed the output is final

If the synthesis is not closed: do not deposit. A partial deposit is worse than no deposit.

## STEP-BY-STEP DEPOSIT PROCEDURE

### STEP 1 — RECEIVE SESSION OUTPUT
  Request from lead-business or lead-marketing:
    - Full L6 synthesis document (or marketing L6 equivalent)
    - Layer summaries: F1-F5 (or R1-R5) for business / M1-M6 (or R1-R5) for marketing
    - CSL decision log (all items + user decisions)
    - DRL item log (all items + status + user decisions)
    - Active geo tracks for the session
    - Session mode (FORWARD / REVERSE / LOOP)
    - Project name

### STEP 2 — GENERATE RECORD ID
  Format: [TYPE]-[YYYY-MM-DD]-[project-slug]-[layer-code]
    TYPE: BUS for business / MKT for marketing
    Date: session close date (not deposit date)
    Project slug: lowercase, hyphens, no spaces (e.g., fintech-saas, fr-hr-niche)
    Layer code: L6 for full forward / R5 for full reverse / specific code if partial

  Example: BUS-2026-06-24-fintech-saas-L6

  Check memory/index.md to confirm this ID does not already exist.

### STEP 3 — CREATE STRUCTURED SUMMARY
  Load the correct schema:
    Business: memory/schema/business-record.md
    Marketing: memory/schema/marketing-record.md

  Complete every field in the schema structured summary section.
  If a field is not available (e.g., ICP Profile not completed): write "Not completed this session"
  CS range: find the lowest and highest CS scores across all session findings.

### STEP 4 — COMPILE SIGNALS FOR CROSS-SESSION ANALYSIS
  This section is critical. Identify:
    - Waived DRL items (missing data accepted without resolution)
    - Findings with CS < 60 that could not be validated
    - Assumptions that were made and flagged but not resolved
    - Competitor moves with broad implications
    - Macro signals with multi-geo implications

  These are the items opportunity-analyst and risk-analyst will look for across sessions.

### STEP 5 — APPEND RAW OUTPUT
  Paste the full L6 synthesis below the structured summary.
  Include all layer summaries that were produced.
  Do not edit or compress — preserve as received.

### STEP 6 — SAVE RECORD FILE
  Path: memory/records/[type]/[ID].md
  File name: [ID].md (same as the record ID)

### STEP 7 — UPDATE INDEX.MD
  Append one row to the INDEX TABLE in memory/index.md:
  | [ID] | [date] | [BUS/MKT] | [project] | [layer] | [geos] | [mode] | [CS min–max] | [key finding — 1 sentence] | [open DRL count + open CSL count] | memory/records/[type]/[ID].md |

  Key finding: the single most important output of the session — one sentence, sourced.

### STEP 8 — UPDATE WAIVED DRL TRACKER
  If any DRL items in this session were resolved as "Waive — accept unknown":
    Add to the waived DRL tracker section in memory/index.md:
    Format: [DR-ID] — [project] — [what was waived] — [date waived]

### STEP 9 — REPORT COMPLETE
  Report to lead-data: "Deposit complete — [ID] — [record count in memory now: N]"
  lead-data closes the session and confirms to originating team lead.

## POST-DEPOSIT PATTERN CHECK

After every 5th deposit into memory (i.e., when record count reaches 5, 10, 15...):
  data-architect flags to lead-data: "Pattern check threshold reached — [N] records now in memory"
  lead-data decides: dispatch opportunity-analyst and/or risk-analyst for pattern scan
  This is the auto-pattern detection trigger.
