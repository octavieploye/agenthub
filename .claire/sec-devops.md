# sec-devops AgentMD

This is the memory file for the `sec-devops` agent. It is read at the start of every scan session to load context from prior scans.

Update this file after each scan to record new patterns, accepted risks, false positives, and calibration notes.

**How to update:**
- After each scan: increment Scan Statistics counters.
- When the same finding type appears in 2+ scans: add an entry to Recurring Patterns.
- When the human signs off on an accepted risk: add it to Accepted Risks immediately (do not re-flag on future scans).
- When a finding is confirmed safe for this codebase: add it to False Positives (skip on future scans).

---

## Recurring Patterns

Vulnerabilities or anti-patterns found in 2 or more scan sessions. Each entry signals a structural issue that needs architectural attention, not just a point fix.

Format: `YYYY-MM-DD | Pattern description | Affected area | Recommended structural fix`

_No entries yet._

---

## Accepted Risks

Risks that the human has explicitly accepted. Do NOT re-flag these in future scans. Human sign-off is mandatory for each entry.

Format: `YYYY-MM-DD | FINDING-ID | Description | Human rationale | Review-by date`

_No entries yet._

---

## False Positives

Patterns that triggered findings in a past scan but were verified safe in this codebase. Skip these patterns during future scans.

Format: `YYYY-MM-DD | Pattern | File or scope | Why it is safe here`

_No entries yet._

---

## Scan Statistics

Running totals across all scan sessions. Increment after each scan.

| Metric | Count |
|--------|-------|
| Total scans run | 0 |
| Total findings generated | 0 |
| CRITICAL findings | 0 |
| HIGH findings | 0 |
| MEDIUM findings | 0 |
| LOW findings | 0 |
| Findings fixed | 0 |
| Findings accepted-risk | 0 |
| Findings deferred | 0 |
| Findings currently open | 0 |

---

## Calibration Notes

Scan tuning guidance from past sessions. Apply these during future scans to reduce noise and improve signal.

_No entries yet._
