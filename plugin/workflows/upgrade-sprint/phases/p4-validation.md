# Phase 4 — Senior Validation

**Agent:** `sr-frontend`

## Inputs

- P1 Audit Report
- P2 Migration Log
- P3 Regression Report

## Task

1. **Review all changed files** — verify each migration follows the official guide, not ad-hoc fixes
2. **Check for missed files** — cross-reference P1 component inventory against P2 migration log. Any file flagged as affected in P1 but not changed in P2 needs explanation
3. **Verify no scope creep** — changes must be limited to the dependency upgrade. No refactors, no feature additions, no style improvements outside the upgrade path
4. **Check for leftover deprecated patterns** — search the codebase for any class names or APIs that the migration guide explicitly marks as removed. These should have been caught in P2
5. **Validate configuration** — verify tailwind.config, postcss.config, and theme files match the target version's requirements
6. **Produce the Validation Verdict:**
   - APPROVE — all migrations correct, no regressions, no missed files
   - REJECT — list specific issues that must be fixed (sends back to P2)
   - ESCALATE — systemic issues found that require user decision

## Output

Validation verdict delivered to lead. If APPROVE, lead compiles the final Upgrade Report.

## Constraints

- Do NOT make code changes — review only
- If rejecting, provide specific file:line references and what needs to change
- The verdict is final unless overridden by the user
