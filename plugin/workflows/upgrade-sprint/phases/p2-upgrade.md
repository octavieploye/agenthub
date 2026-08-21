# Phase 2 — Execute Upgrade

**Agent:** `dev-frontend`

## Inputs

- P1 Audit Report (component inventory, breaking changes list, migration guide)
- User-approved target version

## Task

1. **Update `package.json`** — change the dependency version to the target. Run `npm install`.
2. **Update configuration** — apply any config file changes from the migration guide (tailwind.config, postcss.config, theme files)
3. **Fix breaking changes** — work through the P1 breaking changes list systematically:
   - For each affected file, apply the migration (class rename, API change, import change)
   - Log every change: `file:line — old → new — migration guide reference`
4. **Type-check** — run `tsc --noEmit` (or equivalent) to catch any TypeScript errors introduced by the upgrade
5. **Build check** — run `npm run build` to verify the app compiles cleanly
6. **Produce the Migration Log:**
   - Every file changed, with before/after for each change
   - Any file that could NOT be migrated (blocked — with reason)
   - Build output (pass/fail)
   - TypeScript errors resolved

## Output

Migration log delivered to lead. Lead reviews before approving P3.

## Constraints

- Only touch files listed in the P1 audit as affected
- Follow the official migration guide — no custom workarounds unless the guide has no answer
- If build fails after all migrations applied, STOP and report to lead with the error
