# MEMORY INDEX
Last updated: [date — updated by data-architect after every deposit]
Total records: 0 business | 0 marketing | 0 cross-session

---

## HOW TO READ THIS INDEX

Each row is one deposited session or analysis output.
Columns:
  ID          — unique record identifier (see README.md for format)
  Date        — session close date (ISO 8601)
  Type        — BUS / MKT / XSS
  Project     — project name or slug
  Layer       — layer code (L6, M6, R5, XSS-OPP, XSS-RISK, etc.)
  Geo         — active geo tracks for this session
  Mode        — FORWARD / REVERSE / LOOP / ANALYSIS
  CS Range    — min–max confidence scores across findings
  Key Finding — one sentence — the most important output of this session
  Open Items  — count of open DRL + CSL items at session close
  File        — path to full archive record

---

## INDEX TABLE

<!-- data-architect appends one row per deposit below this line -->

| ID | Date | Type | Project | Layer | Geo | Mode | CS Range | Key Finding | Open Items | File |
|---|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | No records yet | — | — |

---

## QUICK FILTER GUIDE (for opportunity-analyst and risk-analyst)

To find records relevant to a query, scan these dimensions:

  By project:   filter column Project
  By topic:     search key finding column for keywords
  By recency:   sort by Date descending
  By quality:   filter CS Range ≥ 60 for high-confidence findings only
  By open risk: filter Open Items > 0 — sessions with unresolved gaps
  By geo:       filter Geo column for active market

  After identifying relevant record IDs: load the full file from the path in column File.
  Do NOT load all records — load only the records relevant to the current analysis.

---

## CROSS-SESSION PATTERN LOG

Patterns identified across 3+ records by opportunity-analyst or risk-analyst.
(data-architect appends confirmed patterns here after XSS record is deposited)

  No patterns identified yet.

---

## WAIVED DRL TRACKER

DRL items waived across all sessions — tracked here for later evidence accumulation.
When evidence for a waived item appears in a new record, risk-analyst flags for review.

  No waived DRL items tracked yet.
