# Security Log — Aggregate Audit Trail

This file records every finding across every `sec-devops` scan session, in chronological order.

It is:
- Read by `sec-devops` at the start of each scan to check for prior open findings in the current scope.
- Read by `git-ops` before every commit to check for unresolved CRITICAL findings.
- Appended by `sec-devops` after each scan (one row per new finding).

**Status vocabulary** (per UNIVERSAL-STANDARDS.md):
- `open` — finding detected, not yet addressed
- `fixed` — fix implemented and verified by tester
- `accepted-risk` — human has signed off; rationale in `.claire/sec-devops.md`
- `deferred` — acknowledged, scheduled for a future sprint; ticket reference required

**Rules:**
- Never delete rows. Status changes are edits to the Status column only.
- When a finding is resolved, update Status and add a date in the Resolved column.
- Link every row to the per-scan report that produced it.

---

## Finding Log

| Date | ID | Severity | Domain | Location | Status | Resolved | Report |
|------|----|----------|--------|----------|--------|----------|--------|
