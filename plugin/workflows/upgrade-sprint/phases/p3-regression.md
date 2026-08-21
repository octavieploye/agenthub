# Phase 3 — Visual Regression Testing

**Agent:** `tester-frontend`

## Inputs

- P1 Audit Report (component inventory with risk levels)
- P2 Migration Log (files changed)

## Task

1. **Run existing test suite** — `npm test` (all existing frontend tests must pass)
2. **For each HIGH-risk component** from P1:
   - Verify the component renders without errors
   - Check that all interactive states work (hover, focus, active, disabled)
   - Verify responsive behavior if the component uses breakpoint classes
3. **For each MEDIUM-risk component:**
   - Verify the component renders
   - Check primary interactive state
4. **For LOW-risk components:**
   - Spot-check a sample (minimum 20% or 5 components, whichever is greater)
5. **Theme verification:**
   - Verify all theme tokens (colors, spacing, typography) render as expected
   - Check dark mode if applicable
   - Verify custom theme overrides still apply
6. **Produce the Regression Report:**
   - Total components tested / total affected
   - PASS / FAIL per component with screenshot description or error
   - Failure rate percentage
   - If failure rate > 30%, flag for lead escalation (see core/upgrade-rules.md)

## Output

Regression report delivered to lead. Lead reviews before approving P4.

## Constraints

- Do NOT fix failing components — report them. Fixes go back to P2 (dev-frontend)
- Do NOT modify test files to make them pass
- If the existing test suite itself needs updating due to the upgrade (e.g., test utilities changed), report this as a separate finding — do not change tests
