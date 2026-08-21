# Core — Upgrade Rules

These rules apply to every agent working in the upgrade-sprint workflow.

## Non-Negotiable

1. **Never change dependency versions without user approval.** The target version is declared at intake. No agent may upgrade further or downgrade.
2. **Never change tests to pass.** If an existing test fails after upgrade, the upgrade broke a contract. Fix the code, not the test.
3. **Before/after inventory is mandatory.** Every component touched must have a before state (P1) and an after state (P3).
4. **No scope creep.** Only touch files affected by the dependency upgrade. Do not refactor, add features, or improve code you did not break.
5. **One dependency per sprint.** If multiple dependencies need upgrading (e.g., DaisyUI + Tailwind), run separate upgrade sprints unless the dependencies are tightly coupled and must move together.

## Breaking Change Resolution

When a breaking change is encountered:

1. **Document it** — file path, old API/class, new API/class, migration guide link
2. **Apply the migration** — use the official migration guide, not ad-hoc fixes
3. **Test the migration** — the component must render correctly after the change
4. **If no migration path exists** — STOP and report to lead. Do not invent workarounds.

## Rollback Rule

If more than 30% of components fail regression in P3, the lead must escalate to the user with a recommendation: continue fixing or rollback the upgrade entirely.
